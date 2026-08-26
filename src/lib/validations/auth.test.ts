import { describe, expect, it } from "vitest";

describe("registerSchema", () => {
	it("rejects missing required fields", async () => {
		const { registerSchema } = await import("@/lib/validations/auth");
		const result = registerSchema.safeParse({});

		expect(result.success).toBe(false);
	});

	it("rejects invalid email", async () => {
		const { registerSchema } = await import("@/lib/validations/auth");
		const result = registerSchema.safeParse({
			firstName: "Jane",
			lastName: "Smith",
			username: "jsmith",
			email: "not-an-email",
			passwordHash: "abc123",
		});

		expect(result.success).toBe(false);
	});

	it("rejects short username", async () => {
		const { registerSchema } = await import("@/lib/validations/auth");
		const result = registerSchema.safeParse({
			firstName: "Jane",
			lastName: "Smith",
			username: "ab",
			email: "jsmith@school.edu",
			passwordHash: "abc123",
		});

		expect(result.success).toBe(false);
	});

	it("accepts valid register payload", async () => {
		const { registerSchema } = await import("@/lib/validations/auth");
		const result = registerSchema.safeParse({
			firstName: "Jane",
			lastName: "Smith",
			username: "jsmith",
			email: "jsmith@school.edu",
			passwordHash: "abc123clienthash",
		});

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.username).toBe("jsmith");
		}
	});
});

describe("loginSchema", () => {
	it("rejects empty username or passwordHash", async () => {
		const { loginSchema } = await import("@/lib/validations/auth");
		const result = loginSchema.safeParse({ username: "", passwordHash: "" });

		expect(result.success).toBe(false);
	});

	it("accepts valid login payload", async () => {
		const { loginSchema } = await import("@/lib/validations/auth");
		const result = loginSchema.safeParse({
			username: "jsmith",
			passwordHash: "abc123clienthash",
		});

		expect(result.success).toBe(true);
	});
});
