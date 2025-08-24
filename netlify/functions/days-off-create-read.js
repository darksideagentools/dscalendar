const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const cookie = require('cookie');

const { DATABASE_URL, JWT_SECRET } = process.env;

// A shared utility to verify the user's token and return their data
function verifyUser(event) {
  const cookies = event.headers.cookie ? cookie.parse(event.headers.cookie) : {};
  const sessionToken = cookies.session;
  if (!sessionToken) return null;

  try {
    return jwt.verify(sessionToken, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

async function handleGet(event, client, userData) {
    const { month, year } = event.queryStringParameters;
    if (!month || !year) {
        return { statusCode: 400, body: JSON.stringify({ message: 'Month and year are required.' }) };
    }

    // Get all approved days off for the user's shift in the given month
    const shiftDaysOffQuery = `
        SELECT TO_CHAR(date, 'YYYY-MM-DD') as date, COUNT(id)
        FROM days_off
        WHERE status = 'approved'
          AND user_id IN (SELECT id FROM users WHERE shift = $1)
          AND EXTRACT(MONTH FROM date) = $2
          AND EXTRACT(YEAR FROM date) = $3
        GROUP BY date;
    `;
    const shiftDaysOffResult = await client.query(shiftDaysOffQuery, [userData.shift, month, year]);
    
    const shiftDayCounts = shiftDaysOffResult.rows.reduce((acc, row) => {
        acc[row.date] = parseInt(row.count, 10);
        return acc;
    }, {});

    // Get all of the current user's days off (pending and approved)
    const myDaysOffQuery = `
        SELECT TO_CHAR(date, 'YYYY-MM-DD') as date, status
        FROM days_off
        WHERE user_id = $1;
    `;
    const myDaysOffResult = await client.query(myDaysOffQuery, [userData.userId]);

    return {
        statusCode: 200,
        body: JSON.stringify({
            shiftDayCounts,
            myDaysOff: myDaysOffResult.rows
        })
    };
}

async function handlePost(event, client, userData) {
    const { dates } = JSON.parse(event.body);
    if (!Array.isArray(dates) || dates.length === 0) {
        return { statusCode: 400, body: JSON.stringify({ message: 'An array of dates is required.' }) };
    }

    await client.query('BEGIN'); // Start transaction

    try {
        // Check 4-day limit
        const myDaysOffQuery = "SELECT COUNT(id) FROM days_off WHERE user_id = $1 AND (status = 'pending' OR status = 'approved')";
        const myDaysOffResult = await client.query(myDaysOffQuery, [userData.userId]);
        const currentDaysOffCount = parseInt(myDaysOffResult.rows[0].count, 10);

        if (currentDaysOffCount + dates.length > 4) {
            await client.query('ROLLBACK');
            return { statusCode: 400, body: JSON.stringify({ message: `You can only have up to 4 days off. You currently have ${currentDaysOffCount}.` }) };
        }

        for (const date of dates) {
            // Check 2-person limit for the shift on the requested day
            const shiftDayCountQuery = `
                SELECT COUNT(id) FROM days_off 
                WHERE date = $1 AND status = 'approved' AND user_id IN (SELECT id FROM users WHERE shift = $2);
            `;
            const shiftDayCountResult = await client.query(shiftDayCountQuery, [date, userData.shift]);
            const shiftDayCount = parseInt(shiftDayCountResult.rows[0].count, 10);

            if (shiftDayCount >= 2) {
                await client.query('ROLLBACK');
                return { statusCode: 400, body: JSON.stringify({ message: `Cannot request ${date} as it is already fully booked for your shift.` }) };
            }

            // Insert the new day off request
            const insertQuery = "INSERT INTO days_off (user_id, date, status) VALUES ($1, $2, 'pending')";
            await client.query(insertQuery, [userData.userId, date]);
        }

        await client.query('COMMIT'); // Commit transaction
        return { statusCode: 201, body: JSON.stringify({ message: 'Day off requests submitted successfully.' }) };

    } catch (err) {
        await client.query('ROLLBACK'); // Rollback on any error
        console.error('[API_ERROR] handlePost days-off:', err);
        return { statusCode: 500, body: JSON.stringify({ message: 'Failed to submit requests.' }) };
    }
}

exports.handler = async function(event, context) {
  const userData = verifyUser(event);
  if (!userData || userData.shift === 'pending') {
    return { statusCode: 403, body: JSON.stringify({ message: 'Forbidden.' }) };
  }

  const pool = new Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();

  try {
    if (event.httpMethod === 'GET') {
      return await handleGet(event, client, userData);
    } else if (event.httpMethod === 'POST') {
      return await handlePost(event, client, userData);
    }
    return { statusCode: 405, body: 'Method Not Allowed' };
  } catch (err) {
    console.error('[API_ERROR] days-off-create-read:', err);
    return { statusCode: 500, body: JSON.stringify({ message: 'Server error.' }) };
  } finally {
    client.release();
  }
};

