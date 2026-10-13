// Official sources include missing credit values and longer faculty titles.
export async function catalogProvenance(pool) {
  for (const table of ["departments", "professors", "courses"]) {
    const [columns] = await pool.query(
      `SHOW COLUMNS FROM ${table} LIKE 'source_url'`,
    );
    if (!columns.length)
      await pool.query(
        `ALTER TABLE ${table} ADD source_url VARCHAR(512) NOT NULL DEFAULT ''`,
      );
  }
  const [titles] = await pool.query(
    "SHOW COLUMNS FROM professors LIKE 'designation'",
  );
  if (titles[0].Type !== "varchar(120)")
    await pool.query(
      "ALTER TABLE professors MODIFY designation VARCHAR(120) NOT NULL",
    );
  const [credits] = await pool.query(
    "SHOW COLUMNS FROM courses LIKE 'credits'",
  );
  if (credits[0].Null !== "YES")
    await pool.query(
      "ALTER TABLE courses MODIFY credits DECIMAL(3,1) UNSIGNED NULL",
    );
  const [checks] = await pool.query(
    "SELECT cc.CHECK_CLAUSE FROM information_schema.CHECK_CONSTRAINTS cc WHERE cc.CONSTRAINT_SCHEMA = DATABASE() AND cc.CONSTRAINT_NAME = 'chk_courses_credits'",
  );
  if (checks[0]?.CHECK_CLAUSE.includes("0.5"))
    await pool.query(
      "ALTER TABLE courses DROP CHECK chk_courses_credits, ADD CONSTRAINT chk_courses_credits CHECK (credits BETWEEN 0 AND 10)",
    );
}
