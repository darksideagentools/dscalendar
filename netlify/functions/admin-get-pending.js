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
  if (!await verifyAdmin(event)) {
    return { statusCode: 403, body: JSON.stringify({ message: 'Forbidden: Admins only.' }) };
  }

  const pool = new Pool({ connectionString: DATABASE_URL });
  const client = await pool.connect();

  try {
    const { rows } = await client.query("SELECT id, first_name, last_name, username FROM users WHERE shift = 'pending' ORDER BY created_at ASC");
    return {
      statusCode: 200,
      body: JSON.stringify(rows)
    };
  } catch (err) {
    console.error('[API_ERROR] admin-get-pending:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to fetch pending users.' })
    };
  } finally {
    client.release();
  }
};
