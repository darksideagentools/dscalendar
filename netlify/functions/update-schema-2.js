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
    // Add a status column to the days_off table to track pending vs approved requests
    await client.query(`
      ALTER TABLE days_off
      ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved'));
    `);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Database schema updated successfully to support day off statuses.' })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Error updating database schema.', error: err.message })
    };
  } finally {
    client.release();
  }
};
