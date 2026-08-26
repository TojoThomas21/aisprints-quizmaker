import { describe, expect, it } from "vitest";

describe("hashPasswordClient", () => {
	it("produces the same SHA-256 hex hash for the same plaintext", async () => {
		const { hashPasswordClient } = await import("@/lib/password-client");
		const first = await hashPasswordClient("password123");
		const second = await hashPasswordClient("password123");

		expect(first).toBe(second);
		expect(first).toMatch(/^[a-f0-9]{64}$/);
	});

	it("produces different hashes for different plaintext values", async () => {
		const { hashPasswordClient } = await import("@/lib/password-client");
		const first = await hashPasswordClient("password123");
		const second = await hashPasswordClient("password456");

		expect(first).not.toBe(second);
	});

	it("never returns the plaintext password", async () => {
		const { hashPasswordClient } = await import("@/lib/password-client");
		const plaintext = "password123";
		const hash = await hashPasswordClient(plaintext);

		expect(hash).not.toBe(plaintext);
	});
});
