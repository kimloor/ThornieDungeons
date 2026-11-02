const fs = require("node:fs");
const path = require("node:path");

function applyAutoMigration(db, root, filename) {
  const migrationPath = path.join(root, "migrations", "auto", filename);
  db.raw.exec(fs.readFileSync(migrationPath, "utf8"));
}

function applyRequiredAutoMigrations(db, root) {
  applyAutoMigration(db, root, "0028_empower_v21_item_provenance.sql");
  applyAutoMigration(db, root, "0031_battle_authority_v1.sql");
  applyAutoMigration(db, root, "0032_battle_action_idempotency_v1.sql");
  return db;
}

module.exports = { applyAutoMigration, applyRequiredAutoMigrations };
