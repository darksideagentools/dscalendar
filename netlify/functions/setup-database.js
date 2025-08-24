const { Pool } = require('pg');

exports.handler = async function(event, context) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'DATABASE_URL environment variable is not set.' })
    };
  }

  const pool = new Pool({
    connectionString,
  });

  const client = await pool.connect();

  try {
    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id BIGINT PRIMARY KEY,
        first_name TEXT NOT NULL,
        last_name TEXT,
        username TEXT,
        shift TEXT NOT NULL CHECK (shift IN ('Night', 'Morning', 'Evening')),
        is_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    // Create days_off table
    await client.query(`
      CREATE TABLE IF NOT EXISTS days_off (
        id SERIAL PRIMARY KEY,
        user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
        date DATE NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(user_id, date)
      );
    `);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Database tables created successfully.' })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error creating database tables.', error: err.message })
    };
  } finally {
    client.release();
  }
};
