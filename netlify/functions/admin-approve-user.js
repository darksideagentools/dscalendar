const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const cookie = require('cookie');

const { DATABASE_URL, JWT_SECRET } = process.env;

// This function can be refactored into a shared utility
async function verifyAdmin(event) {
  const cookies = event.headers.cookie ? cookie.parse(event.headers.cookie) : {};
  const sessionToken = cookies.session;
  if (!sessionToken) return false;

  try {
    const decoded = jwt.verify(sessionToken, JWT_SECRET);
    return decoded.isAdmin;
  } catch (err) {
    return false;
  }
}

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  if (!await verifyAdmin(event)) {
    return { statusCode: 403, body: JSON.stringify({ message: 'Forbidden: Admins only.' }) };
  }

  const pool = new Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();

  try {
    const { userId, shift } = JSON.parse(event.body);

    if (!userId || !['Night', 'Morning', 'Evening'].includes(shift)) {
      return { statusCode: 400, body: JSON.stringify({ message: 'Invalid userId or shift provided.' }) };
    }

    const { rows } = await client.query("UPDATE users SET shift = $1 WHERE id = $2 AND shift = 'pending' RETURNING id, shift", [shift, userId]);

    if (rows.length === 0) {
        return { statusCode: 404, body: JSON.stringify({ message: 'User not found or was not pending approval.' }) };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ message: `User ${rows[0].id} approved for ${rows[0].shift} shift.` })
    };
  } catch (err) {
    console.error('[API_ERROR] admin-approve-user:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to approve user.' })
    };
  } finally {
    client.release();
  }
};
