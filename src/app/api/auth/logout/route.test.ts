import { describe, expect, it } from "vitest";

describe("POST /api/auth/logout", () => {
	it("returns 200 with success true", async () => {
		const { POST } = await import("@/app/api/auth/logout/route");
		const response = await POST();
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toEqual({ success: true });
	});
});
