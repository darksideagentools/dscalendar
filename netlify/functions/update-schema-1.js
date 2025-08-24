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
    // Add a new CHECK constraint to include 'pending'
    await client.query(`
      ALTER TABLE users
      DROP CONSTRAINT IF EXISTS users_shift_check,
      ADD CONSTRAINT users_shift_check CHECK (shift IN ('Night', 'Morning', 'Evening', 'pending'));
    `);

    // Set the default value for the shift column to 'pending'
    await client.query(`
      ALTER TABLE users
      ALTER COLUMN shift SET DEFAULT 'pending';
    `);

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Database schema updated successfully for pending user approval.' })
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
