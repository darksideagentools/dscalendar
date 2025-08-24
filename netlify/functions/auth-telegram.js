const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const cookie = require('cookie');
const crypto = require('crypto');

const { DATABASE_URL, TELEGRAM_BOT_TOKEN, JWT_SECRET, ADMIN_TELEGRAM_ID } = process.env;

// Function to verify the hash from Telegram
function verifyTelegramHash(data) {
  const secretKey = crypto.createHash('sha256').update(TELEGRAM_BOT_TOKEN).digest();
  const checkString = Object.keys(data)
    .filter(key => key !== 'hash')
    .map(key => `${key}=${data[key]}`)
    .sort()
    .join('\n');
  const hmac = crypto.createHmac('sha256', secretKey).update(checkString).digest('hex');
  return hmac === data.hash;
}

exports.handler = async function(event, context) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const userData = JSON.parse(event.body);

    if (!verifyTelegramHash(userData)) {
      return { statusCode: 403, body: JSON.stringify({ message: 'Invalid hash. Authentication failed.' }) };
    }

    const pool = new Pool({ connectionString: DATABASE_URL });
    const client = await pool.connect();

    try {
      console.log('--- Starting Auth Function ---');
      const adminIds = (ADMIN_TELEGRAM_ID || '').split(',').map(id => id.trim());
      console.log('Admin IDs from ENV:', adminIds);

      const isAdmin = adminIds.includes(String(userData.id));
      console.log(`Incoming User ID: ${userData.id}, Is Admin: ${isAdmin}`);

      const initialShift = isAdmin ? 'Morning' : 'pending'; // Admins get a default shift
      console.log(`Assigning initial shift: ${initialShift}`);

      // Upsert user: Insert if new, update if exists. Also fixes admins stuck in pending.
      const upsertQuery = `
        INSERT INTO users (id, first_name, last_name, username, is_admin, shift)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (id) DO UPDATE SET
          first_name = EXCLUDED.first_name,
          last_name = EXCLUDED.last_name,
          username = EXCLUDED.username,
          is_admin = EXCLUDED.is_admin,
          shift = CASE
                    WHEN users.shift = 'pending' AND EXCLUDED.is_admin = TRUE THEN 'Morning'
                    ELSE users.shift
                  END;
      `;
      await client.query(upsertQuery, [userData.id, userData.first_name, userData.last_name, userData.username, isAdmin, initialShift]);

      // Get the user's current shift (it might not be pending if they were approved)
      const { rows } = await client.query('SELECT shift, is_admin FROM users WHERE id = $1', [userData.id]);
      const user = rows[0];

      // Create JWT
      const token = jwt.sign(
        { userId: userData.id, shift: user.shift, isAdmin: user.is_admin },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      // Set JWT in a secure cookie
      const sessionCookie = cookie.serialize('session', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 7 // 1 week
      });

      return {
        statusCode: 200,
        headers: { 'Set-Cookie': sessionCookie },
        body: JSON.stringify({ id: userData.id, firstName: userData.first_name, shift: user.shift, isAdmin: user.is_admin })
      };

    } finally {
      client.release();
    }
  } catch (err) {
    console.error('[AUTH_ERROR]', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Server error during authentication.', error: err.message })
    };
  }
};
