const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const cookie = require('cookie');

const { DATABASE_URL, JWT_SECRET } = process.env;

exports.handler = async function(event, context) {
  try {
    const cookies = event.headers.cookie ? cookie.parse(event.headers.cookie) : {};
    const sessionToken = cookies.session;

    if (!sessionToken) {
      return { statusCode: 401, body: JSON.stringify({ message: 'No active session' }) };
    }

    const decoded = jwt.verify(sessionToken, JWT_SECRET);

    const pool = new Pool({ connectionString: DATABASE_URL });
    const client = await pool.connect();

    try {
      const { rows } = await client.query('SELECT id, first_name, last_name, username, shift, is_admin FROM users WHERE id = $1', [decoded.userId]);
      if (rows.length === 0) {
        return { statusCode: 404, body: JSON.stringify({ message: 'User not found' }) };
      }

      const user = rows[0];
      // Rename keys for frontend consistency
      const userInfo = {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        username: user.username,
        shift: user.shift,
        isAdmin: user.is_admin
      };

      return {
        statusCode: 200,
        body: JSON.stringify({ user: userInfo })
      };
    } finally {
      client.release();
    }
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      return { statusCode: 401, body: JSON.stringify({ message: 'Invalid token' }) };
    }
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Server error', error: err.message })
    };
  }
};
