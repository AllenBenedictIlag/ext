import mysql from 'mysql2/promise';

/**
 * Ensure the pool is a singleton in dev,
 * so Next.js hot-reloading doesn’t create a new pool each time a file changes.
 */
declare global {
  // eslint-disable-next-line no-var
  var _pool: mysql.Pool | undefined;
}

export function getPool() {
  if (!global._pool) {
    global._pool = mysql.createPool({
      uri: process.env.DATABASE_URL, // parsed automatically
      // optional tuning
      connectionLimit: 10,
      waitForConnections: true,
      queueLimit: 0,
    });
  }
  return global._pool;
}
