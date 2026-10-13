import mysql from "mysql2/promise";

export function createPool(config) {
  return mysql.createPool(config.db);
}

// Reuse one connection for an entire transaction. Always return it to the pool.
export async function transaction(pool, work) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
