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

describe("mcq tables migration", () => {
	it("defines mcqs table with required columns", () => {
		const definition = readTableDefinition("mcqs");

		for (const column of ["id", "user_id", "name", "question", "created_at", "updated_at"]) {
			expectColumn(definition, column, "mcqs");
		}
	});

	it("defines mcq_choices table with required columns", () => {
		const definition = readTableDefinition("mcq_choices");

		for (const column of [
			"id",
			"mcq_id",
			"choice_text",
			"is_correct",
			"position",
			"created_at",
			"updated_at",
		]) {
			expectColumn(definition, column, "mcq_choices");
		}
	});

	it("defines mcq_attempts table with required columns", () => {
		const definition = readTableDefinition("mcq_attempts");

		for (const column of [
			"id",
			"mcq_id",
			"user_id",
			"choice_id",
			"selected_choice_text",
			"is_correct",
			"created_at",
		]) {
			expectColumn(definition, column, "mcq_attempts");
		}
	});

	it("requires a question on every mcq", () => {
		expect(readColumnDefinition("mcqs", "question")).toMatch(/NOT NULL/i);
	});

	it("attributes each mcq to a user", () => {
		expect(readColumnDefinition("mcqs", "user_id")).toMatch(
			/REFERENCES\s+users\s*\(\s*id\s*\)\s+ON DELETE CASCADE/i,
		);
	});

	it("cascades deletes from mcqs to mcq_choices", () => {
		expect(readColumnDefinition("mcq_choices", "mcq_id")).toMatch(
			/REFERENCES\s+mcqs\s*\(\s*id\s*\)\s+ON DELETE CASCADE/i,
		);
	});

	it("cascades deletes from mcqs to mcq_attempts", () => {
		expect(readColumnDefinition("mcq_attempts", "mcq_id")).toMatch(
			/REFERENCES\s+mcqs\s*\(\s*id\s*\)\s+ON DELETE CASCADE/i,
		);
	});

	it("cascades deletes from mcq_choices to mcq_attempts", () => {
		expect(readColumnDefinition("mcq_attempts", "choice_id")).toMatch(
			/REFERENCES\s+mcq_choices\s*\(\s*id\s*\)\s+ON DELETE CASCADE/i,
		);
	});

	it("records attempt correctness as a non-null flag", () => {
		expect(readColumnDefinition("mcq_attempts", "is_correct")).toMatch(/NOT NULL/i);
	});

	it("creates indexes for mcq foreign key lookups", () => {
		const sql = readMigrationSql();

		expect(sql).toContain("idx_mcqs_user_id");
		expect(sql).toContain("idx_mcq_choices_mcq_id");
		expect(sql).toContain("idx_mcq_attempts_mcq_id");
		expect(sql).toContain("idx_mcq_attempts_user_id");
	});
});

function readMigrationSql(): string {
	const migrationFiles = readdirSync(MIGRATIONS_DIR)
		.filter((file) => file.endsWith(".sql"))
		.sort();

	expect(migrationFiles.length).toBeGreaterThan(0);

	return migrationFiles.map((file) => readFileSync(join(MIGRATIONS_DIR, file), "utf8")).join("\n");
}

/**
 * Returns the body of a CREATE TABLE statement so column assertions are scoped to one
 * table. Asserting against the whole migration file would let a column belonging to a
 * different table satisfy the expectation.
 */
function readTableDefinition(tableName: string): string {
	const sql = readMigrationSql();
	const match = new RegExp(`CREATE TABLE\\s+${tableName}\\b\\s*\\(([\\s\\S]*?)\\);`, "i").exec(sql);

	expect(match, `expected a CREATE TABLE ${tableName} statement`).not.toBeNull();

	return match![1];
}

function readColumnDefinition(tableName: string, columnName: string): string {
	const line = findColumnLine(readTableDefinition(tableName), columnName);

	expect(line, `expected column ${columnName} on ${tableName}`).toBeDefined();

	return line!;
}

function expectColumn(definition: string, columnName: string, tableName: string): void {
	expect(
		findColumnLine(definition, columnName),
		`expected column ${columnName} on ${tableName}`,
	).toBeDefined();
}

function findColumnLine(definition: string, columnName: string): string | undefined {
	return definition
		.split("\n")
		.find((line) => new RegExp(`^\\s*${columnName}\\s`).test(line));
}
