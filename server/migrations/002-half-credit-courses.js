// The curriculum includes 0.5-credit courses. Upgrade older integer schemas
// without recreating tables or changing existing catalog/account rows.
export async function allowHalfCredits(pool) {
  const [columns] = await pool.query(
    "SELECT DATA_TYPE FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'courses' AND COLUMN_NAME = 'credits'",
  );
  const [checks] = await pool.query(
    "SELECT tc.CONSTRAINT_NAME, cc.CHECK_CLAUSE FROM information_schema.TABLE_CONSTRAINTS tc JOIN information_schema.CHECK_CONSTRAINTS cc ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA AND cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME WHERE tc.TABLE_SCHEMA = DATABASE() AND tc.TABLE_NAME = 'courses' AND tc.CONSTRAINT_TYPE = 'CHECK'",
  );
  const creditChecks = checks.filter((check) =>
    check.CHECK_CLAUSE.includes("credits"),
  );
  if (
    columns[0]?.DATA_TYPE === "decimal" &&
    creditChecks.some(
      (check) =>
        check.CHECK_CLAUSE.includes("0.5") ||
        /between\s+0\s+and\s+10/i.test(check.CHECK_CLAUSE),
    )
  )
    return;
  const drops = creditChecks.map(
    (check) => `DROP CHECK \`${check.CONSTRAINT_NAME.replaceAll("`", "``")}\``,
  );
  await pool.query(
    `ALTER TABLE courses ${[...drops, "MODIFY COLUMN credits DECIMAL(3,1) UNSIGNED NOT NULL", "ADD CONSTRAINT chk_courses_credits CHECK (credits BETWEEN 0.5 AND 10)"].join(", ")}`,
  );
}
