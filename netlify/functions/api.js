const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const crypto = require('crypto');

const { DATABASE_URL, TELEGRAM_BOT_TOKEN, JWT_SECRET, ADMIN_TELEGRAM_ID } = process.env;

// --- UTILITY FUNCTIONS ---
function verifyTelegramHash(data) {
  const secretKey = crypto.createHash('sha256').update(TELEGRAM_BOT_TOKEN).digest();
  const checkString = Object.keys(data).filter(key => key !== 'hash').map(key => `${key}=${data[key]}`).sort().join('\n');
  const hmac = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');
  return hmac === data.hash;
}

// --- ACTION HANDLERS ---

async function handleAuth(eventBody, client) {
  const userData = JSON.parse(eventBody);
  if (!verifyTelegramHash(userData)) {
    return { statusCode: 403, body: JSON.stringify({ message: 'Invalid hash. Authentication failed.' }) };
  }

  const adminIds = (ADMIN_TELEGRAM_ID || '').split(',').map(id => id.trim());
  const isAdmin = adminIds.includes(String(userData.id));
  const initialShift = isAdmin ? 'Morning' : 'pending';

  const upsertQuery = `
    INSERT INTO users (id, first_name, last_name, username, is_admin, shift)
    VALUES ($1, $2, $3, $4, $5, $6)
    ON CONFLICT (id) DO UPDATE SET
      first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, username = EXCLUDED.username, is_admin = EXCLUDED.is_admin,
      shift = CASE WHEN users.shift = 'pending' AND EXCLUDED.is_admin = TRUE THEN 'Morning' ELSE users.shift END;
  `;
  await client.query(upsertQuery, [userData.id, userData.first_name, userData.last_name, userData.username, isAdmin, initialShift]);

  const { rows } = await client.query('SELECT shift, is_admin FROM users WHERE id = $1', [userData.id]);
  const user = rows[0];

  const token = jwt.sign({ userId: userData.id, shift: user.shift, isAdmin: user.is_admin }, JWT_SECRET, { expiresIn: '7d' });
  const sessionCookie = cookie.serialize('session', token, { httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: 60 * 60 * 24 * 7 });

  return {
    statusCode: 200,
    headers: { 'Set-Cookie': sessionCookie },
    body: JSON.stringify({ id: userData.id, firstName: userData.first_name, shift: user.shift, isAdmin: user.is_admin })
  };
}

async function handleGetUserInfo(userData, client) {
  const { rows } = await client.query('SELECT id, first_name, last_name, username, shift, is_admin FROM users WHERE id = $1', [userData.userId]);
  if (rows.length === 0) {
    return { statusCode: 404, body: JSON.stringify({ message: 'User not found' }) };
  }
  const user = rows[0];
  const userInfo = { id: user.id, firstName: user.first_name, lastName: user.last_name, username: user.username, shift: user.shift, isAdmin: user.is_admin };
  return { statusCode: 200, body: JSON.stringify({ user: userInfo }) };
}

async function handleGetCalendar(userData, client, queryParams) {
  const { month, year } = queryParams;
  if (!month || !year) {
    return { statusCode: 400, body: JSON.stringify({ message: 'Month and year are required.' }) };
  }
  const shiftDaysOffQuery = `
      SELECT TO_CHAR(date, 'YYYY-MM-DD') as date, COUNT(id) FROM days_off
      WHERE status = 'approved' AND user_id IN (SELECT id FROM users WHERE shift = $1)
      AND EXTRACT(MONTH FROM date) = $2 AND EXTRACT(YEAR FROM date) = $3 GROUP BY date;
  `;
  const shiftDaysOffResult = await client.query(shiftDaysOffQuery, [userData.shift, month, year]);
  const shiftDayCounts = shiftDaysOffResult.rows.reduce((acc, row) => { acc[row.date] = parseInt(row.count, 10); return acc; }, {});

  const myDaysOffQuery = "SELECT TO_CHAR(date, 'YYYY-MM-DD') as date, status FROM days_off WHERE user_id = $1;";
  const myDaysOffResult = await client.query(myDaysOffQuery, [userData.userId]);

  return { statusCode: 200, body: JSON.stringify({ shiftDayCounts, myDaysOff: myDaysOffResult.rows }) };
}

async function handleRequestDaysOff(userData, client, eventBody) {
  const { dates } = JSON.parse(eventBody);
  if (!Array.isArray(dates) || dates.length === 0) {
    return { statusCode: 400, body: JSON.stringify({ message: 'An array of dates is required.' }) };
  }
  await client.query('BEGIN');
  try {
    const myDaysOffQuery = "SELECT COUNT(id) FROM days_off WHERE user_id = $1 AND (status = 'pending' OR status = 'approved')";
    const myDaysOffResult = await client.query(myDaysOffQuery, [userData.userId]);
    const currentDaysOffCount = parseInt(myDaysOffResult.rows[0].count, 10);
    if (currentDaysOffCount + dates.length > 4) {
      await client.query('ROLLBACK');
      return { statusCode: 400, body: JSON.stringify({ message: `You can only have up to 4 days off. You currently have ${currentDaysOffCount}.` }) };
    }
    for (const date of dates) {
      const shiftDayCountQuery = `SELECT COUNT(id) FROM days_off WHERE date = $1 AND status = 'approved' AND user_id IN (SELECT id FROM users WHERE shift = $2);`;
      const shiftDayCountResult = await client.query(shiftDayCountQuery, [date, userData.shift]);
      const shiftDayCount = parseInt(shiftDayCountResult.rows[0].count, 10);
      if (shiftDayCount >= 2) {
        await client.query('ROLLBACK');
        return { statusCode: 400, body: JSON.stringify({ message: `Cannot request ${date} as it is already fully booked for your shift.` }) };
      }
      const insertQuery = "INSERT INTO days_off (user_id, date, status) VALUES ($1, $2, 'pending')";
      await client.query(insertQuery, [userData.userId, date]);
    }
    await client.query('COMMIT');
    return { statusCode: 201, body: JSON.stringify({ message: 'Day off requests submitted successfully.' }) };
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[API_ERROR] handleRequestDaysOff:', err);
    return { statusCode: 500, body: JSON.stringify({ message: 'Failed to submit requests.' }) };
  }
}

// --- MAIN HANDLER ---

exports.handler = async function(event, context) {
  const { action } = event.queryStringParameters;
  const pool = new Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();

  try {
    if (event.httpMethod === 'POST' && action === 'auth-telegram') {
      return await handleAuth(event.body, client);
    }

    let userData;
    try {
      const cookies = event.headers.cookie ? cookie.parse(event.headers.cookie) : {};
      const sessionToken = cookies.session;
      if (!sessionToken) throw new Error('No session token');
      userData = jwt.verify(sessionToken, JWT_SECRET);
    } catch (err) {
      return { statusCode: 401, body: JSON.stringify({ message: 'Unauthorized' }) };
    }

    if (event.httpMethod === 'GET' && action === 'user-info') {
      return await handleGetUserInfo(userData, client);
    }

    if (userData.shift === 'pending') {
      return { statusCode: 403, body: JSON.stringify({ message: 'Forbidden: User is pending approval.' }) };
    }

    switch (action) {
      case 'get-calendar':
        return await handleGetCalendar(userData, client, event.queryStringParameters);
      case 'request-days-off':
        return await handleRequestDaysOff(userData, client, event.body);
      default:
        return { statusCode: 404, body: JSON.stringify({ message: 'Action not found' }) };
    }
  } catch (err) {
    console.error('[API_ERROR]', err);
    return { statusCode: 500, body: JSON.stringify({ message: 'Server Error' }) };
  } finally {
    client.release();
  }
};
