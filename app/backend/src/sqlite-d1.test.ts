import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { expect, it } from "vitest";
import { createTestD1, discoverMigrations } from "./test/sqlite-d1";

it("discovers and applies all numbered migrations in numeric order", () => {
  const directory = mkdtempSync(join(tmpdir(), "mct-migrations-"));
  try {
    writeFileSync(join(directory, "0010_later.sql"), "INSERT INTO fictional_checks VALUES ('later');");
    writeFileSync(join(directory, "0002_additive.sql"), "INSERT INTO fictional_checks VALUES ('additive');");
    writeFileSync(join(directory, "0001_initial.sql"), "CREATE TABLE fictional_checks (name TEXT);");
    writeFileSync(join(directory, "README.md"), "Not a migration.");
    writeFileSync(join(directory, "seed.sql"), "Invalid SQL intentionally ignored.");
    mkdirSync(join(directory, "0003_directory.sql"));
    const url = pathToFileURL(directory + "/");
    expect(discoverMigrations(url)).toEqual(["0001_initial.sql", "0002_additive.sql", "0010_later.sql"]);
    const { raw, close } = createTestD1(url);
    try {
      expect(raw.prepare("SELECT name FROM fictional_checks ORDER BY rowid").all()).toEqual([{ name: "additive" }, { name: "later" }]);
    } finally { close(); }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
