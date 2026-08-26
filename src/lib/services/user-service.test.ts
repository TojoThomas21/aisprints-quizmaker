import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetDatabase = vi.fn();

vi.mock("@/lib/db", () => ({
	getDatabase: () => mockGetDatabase(),
}));

type UserRow = {
	id: string;
	first_name: string;
	last_name: string;
	username: string;
	email: string;
	password_hash: string;
	created_at: string;
	updated_at: string;
};

const sampleRow: UserRow = {
	id: "user-1",
	first_name: "Jane",
	last_name: "Smith",
	username: "jsmith",
	email: "jsmith@school.edu",
	password_hash: "salt:hash",
	created_at: "2026-01-01 00:00:00",
	updated_at: "2026-01-01 00:00:00",
};

function createMockDb(options: {
	selectResults?: UserRow[];
	runResult?: { success: boolean };
}) {
	const all = vi.fn(async () => ({ results: options.selectResults ?? [] }));
	const run = vi.fn(async () => ({ success: options.runResult?.success ?? true }));
	const bind = vi.fn(() => ({ all, run }));
	const prepare = vi.fn(() => ({ bind }));

	mockGetDatabase.mockResolvedValue({ prepare });

	return { prepare, bind, all, run };
}

describe("user-service", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.resetModules();
	});

	describe("createUser", () => {
		it("inserts row and returns user without password_hash", async () => {
			const db = createMockDb({ selectResults: [] });
			db.all
				.mockResolvedValueOnce({ results: [] })
				.mockResolvedValueOnce({ results: [] })
				.mockResolvedValueOnce({ results: [sampleRow] });
			db.run.mockResolvedValueOnce({ success: true });

			const { createUser } = await import("@/lib/services/user-service");
			const user = await createUser({
				firstName: "Jane",
				lastName: "Smith",
				username: "jsmith",
				email: "jsmith@school.edu",
				passwordHash: "abc123clienthash",
			});

			expect(user).toEqual({
				id: expect.any(String),
				firstName: "Jane",
				lastName: "Smith",
				username: "jsmith",
				email: "jsmith@school.edu",
				createdAt: expect.any(String),
				updatedAt: expect.any(String),
			});
			expect(user).not.toHaveProperty("passwordHash");
			expect(user).not.toHaveProperty("password_hash");
			expect(db.run).toHaveBeenCalled();
		});

		it("rejects duplicate username", async () => {
			createMockDb({});
			mockGetDatabase.mockResolvedValue({
				prepare: vi.fn(() => ({
					bind: vi.fn(() => ({
						all: vi.fn(async () => ({ results: [sampleRow] })),
						run: vi.fn(),
					})),
				})),
			});

			const { createUser, DuplicateUserError } = await import("@/lib/services/user-service");

			await expect(
				createUser({
					firstName: "Jane",
					lastName: "Smith",
					username: "jsmith",
					email: "other@school.edu",
					passwordHash: "abc123clienthash",
				}),
			).rejects.toThrow(DuplicateUserError);
		});

		it("rejects duplicate email", async () => {
			mockGetDatabase.mockResolvedValue({
				prepare: vi.fn((sql: string) => ({
					bind: vi.fn(() => ({
						all: vi.fn(async () => {
							if (sql.includes("WHERE username")) {
								return { results: [] };
							}
							if (sql.includes("WHERE email")) {
								return { results: [sampleRow] };
							}
							return { results: [] };
						}),
						run: vi.fn(),
					})),
				})),
			});

			const { createUser, DuplicateUserError } = await import("@/lib/services/user-service");

			await expect(
				createUser({
					firstName: "Jane",
					lastName: "Smith",
					username: "newuser",
					email: "jsmith@school.edu",
					passwordHash: "abc123clienthash",
				}),
			).rejects.toThrow(DuplicateUserError);
		});
	});

	describe("getUserByUsername", () => {
		it("returns user when found", async () => {
			const db = createMockDb({ selectResults: [sampleRow] });

			const { getUserByUsername } = await import("@/lib/services/user-service");
			const user = await getUserByUsername("jsmith");

			expect(user).toEqual({
				id: "user-1",
				firstName: "Jane",
				lastName: "Smith",
				username: "jsmith",
				email: "jsmith@school.edu",
				createdAt: "2026-01-01 00:00:00",
				updatedAt: "2026-01-01 00:00:00",
			});
			expect(db.prepare).toHaveBeenCalled();
		});

		it("returns null when not found", async () => {
			createMockDb({ selectResults: [] });

			const { getUserByUsername } = await import("@/lib/services/user-service");
			const user = await getUserByUsername("missing");

			expect(user).toBeNull();
		});
	});

	describe("getUserByEmail", () => {
		it("returns user when found", async () => {
			createMockDb({ selectResults: [sampleRow] });

			const { getUserByEmail } = await import("@/lib/services/user-service");
			const user = await getUserByEmail("jsmith@school.edu");

			expect(user?.email).toBe("jsmith@school.edu");
			expect(user).not.toHaveProperty("password_hash");
		});
	});

	describe("updateUser", () => {
		it("updates fields and returns updated user", async () => {
			const updatedRow: UserRow = {
				...sampleRow,
				first_name: "Janet",
				updated_at: "2026-02-01 00:00:00",
			};

			mockGetDatabase.mockResolvedValue({
				prepare: vi.fn(() => ({
					bind: vi.fn(() => ({
						run: vi.fn(async () => ({ success: true })),
						all: vi.fn(async () => ({ results: [updatedRow] })),
					})),
				})),
			});

			const { updateUser } = await import("@/lib/services/user-service");
			const user = await updateUser("user-1", { firstName: "Janet" });

			expect(user).toEqual({
				id: "user-1",
				firstName: "Janet",
				lastName: "Smith",
				username: "jsmith",
				email: "jsmith@school.edu",
				createdAt: "2026-01-01 00:00:00",
				updatedAt: "2026-02-01 00:00:00",
			});
		});
	});

	describe("deleteUser", () => {
		it("removes user by id", async () => {
			const db = createMockDb({});

			const { deleteUser } = await import("@/lib/services/user-service");
			await deleteUser("user-1");

			expect(db.run).toHaveBeenCalled();
			expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining("DELETE FROM users"));
		});
	});

	describe("hashPassword", () => {
		it("produces stable salted output not equal to input", async () => {
			const { hashPassword } = await import("@/lib/services/user-service");
			const clientHash = "deadbeef";

			const hashed = await hashPassword(clientHash);

			expect(hashed).toBeTruthy();
			expect(hashed).not.toBe(clientHash);
			expect(hashed).toContain(":");
		});
	});

	describe("verifyPassword", () => {
		it("returns true for matching hash", async () => {
			const { hashPassword, verifyPassword } = await import("@/lib/services/user-service");
			const clientHash = "abc123clienthash";
			const stored = await hashPassword(clientHash);

			await expect(verifyPassword(clientHash, stored)).resolves.toBe(true);
		});

		it("returns false for wrong hash", async () => {
			const { hashPassword, verifyPassword } = await import("@/lib/services/user-service");
			const stored = await hashPassword("correct");

			await expect(verifyPassword("wrong", stored)).resolves.toBe(false);
		});
	});
});
