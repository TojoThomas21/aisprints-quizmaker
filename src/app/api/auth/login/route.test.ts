import { beforeEach, describe, expect, it, vi } from "vitest";

const mockAuthenticateUser = vi.fn();

vi.mock("@/lib/services/user-service", () => ({
	authenticateUser: (...args: unknown[]) => mockAuthenticateUser(...args),
}));

const mockUser = {
	id: "user-1",
	firstName: "Jane",
	lastName: "Smith",
	username: "jsmith",
	email: "jsmith@school.edu",
	createdAt: "2026-01-01 00:00:00",
	updatedAt: "2026-01-01 00:00:00",
};

function createRequest(body: unknown): Request {
	return new Request("http://localhost/api/auth/login", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

describe("POST /api/auth/login", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns 200 and user on valid credentials", async () => {
		mockAuthenticateUser.mockResolvedValue(mockUser);

		const { POST } = await import("@/app/api/auth/login/route");
		const response = await POST(
			createRequest({ username: "jsmith", passwordHash: "abc123clienthash" }),
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toEqual({ success: true, user: mockUser });
		expect(mockAuthenticateUser).toHaveBeenCalledWith("jsmith", "abc123clienthash");
	});

	it("returns 401 on wrong password", async () => {
		mockAuthenticateUser.mockResolvedValue(null);

		const { POST } = await import("@/app/api/auth/login/route");
		const response = await POST(
			createRequest({ username: "jsmith", passwordHash: "wronghash" }),
		);
		const body = await response.json();

		expect(response.status).toBe(401);
		expect(body).toEqual({ success: false, error: "Invalid username or password" });
	});

	it("returns 401 on unknown user", async () => {
		mockAuthenticateUser.mockResolvedValue(null);

		const { POST } = await import("@/app/api/auth/login/route");
		const response = await POST(
			createRequest({ username: "unknown", passwordHash: "abc123clienthash" }),
		);
		const body = await response.json();

		expect(response.status).toBe(401);
		expect(body.error).toBe("Invalid username or password");
	});

	it("returns 400 on invalid body", async () => {
		const { POST } = await import("@/app/api/auth/login/route");
		const response = await POST(createRequest({ username: "", passwordHash: "" }));
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body.success).toBe(false);
		expect(body.error).toBe("Validation failed");
		expect(mockAuthenticateUser).not.toHaveBeenCalled();
	});
});
