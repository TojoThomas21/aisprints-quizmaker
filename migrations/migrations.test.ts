import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATIONS_DIR = join(__dirname);
const REQUIRED_COLUMNS = [
	"id",
	"first_name",
	"last_name",
	"username",
	"email",
	"password_hash",
	"created_at",
	"updated_at",
];

describe("users table migration", () => {
	it("defines users table with required columns", () => {
		const sql = readMigrationSql();

		expect(sql).toMatch(/CREATE TABLE\s+users/i);
		for (const column of REQUIRED_COLUMNS) {
			expect(sql).toContain(column);
		}
	});

	it("creates username and email indexes", () => {
		const sql = readMigrationSql();

		expect(sql).toContain("idx_users_username");
		expect(sql).toContain("idx_users_email");
	});
});

function readMigrationSql(): string {
	const migrationFiles = readdirSync(MIGRATIONS_DIR)
		.filter((file) => file.endsWith(".sql"))
		.sort();

	expect(migrationFiles.length).toBeGreaterThan(0);

	return migrationFiles.map((file) => readFileSync(join(MIGRATIONS_DIR, file), "utf8")).join("\n");
}
