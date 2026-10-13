// Upgrade existing installations without replacing accounts or catalog records.
export async function removeUnusedFeatures(pool) {
  const [tables] = await pool.query("SHOW TABLES LIKE 'auth_challenges'");
  if (tables.length) {
    // Keep outstanding password recovery codes; discard obsolete signup codes.
    await pool.query(`INSERT IGNORE INTO password_resets
      (user_id, code_hash, expires_at, sent_at, attempts)
      SELECT user_id, code_hash, expires_at, sent_at, attempts
      FROM auth_challenges WHERE purpose = 'reset'`);
    await pool.query("DROP TABLE auth_challenges");
  }
  for (const [table, column] of [
    ["users", "verified_at"],
    ["professors", "is_sample"],
    ["courses", "is_sample"],
  ]) {
    const [columns] = await pool.query(`SHOW COLUMNS FROM ${table} LIKE ?`, [
      column,
    ]);
    if (columns.length)
      await pool.query(`ALTER TABLE ${table} DROP COLUMN ${column}`);
  }
}
