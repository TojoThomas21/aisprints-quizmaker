import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateUser = vi.fn();

vi.mock("@/lib/services/user-service", () => ({
	createUser: (...args: unknown[]) => mockCreateUser(...args),
	DuplicateUserError: class DuplicateUserError extends Error {
		constructor(message: string) {
			super(message);
			this.name = "DuplicateUserError";
		}
	},
}));

const validRegisterBody = {
	firstName: "Jane",
	lastName: "Smith",
	username: "jsmith",
	email: "jsmith@school.edu",
	passwordHash: "abc123clienthash",
};

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
	return new Request("http://localhost/api/auth/register", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

describe("POST /api/auth/register", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns 201 and user on success", async () => {
		mockCreateUser.mockResolvedValue(mockUser);

		const { POST } = await import("@/app/api/auth/register/route");
		const response = await POST(createRequest(validRegisterBody));
		const body = await response.json();

		expect(response.status).toBe(201);
		expect(body).toEqual({ success: true, user: mockUser });
		expect(body.user).not.toHaveProperty("passwordHash");
		expect(mockCreateUser).toHaveBeenCalledWith(validRegisterBody);
	});

	it("returns 400 on invalid body", async () => {
		const { POST } = await import("@/app/api/auth/register/route");
		const response = await POST(createRequest({ firstName: "Jane" }));
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body.success).toBe(false);
		expect(body.error).toBe("Validation failed");
		expect(body.details).toBeDefined();
		expect(mockCreateUser).not.toHaveBeenCalled();
	});

	it("returns 409 on duplicate username or email", async () => {
		const { DuplicateUserError } = await import("@/lib/services/user-service");
		mockCreateUser.mockRejectedValue(new DuplicateUserError("Username already taken"));

		const { POST } = await import("@/app/api/auth/register/route");
		const response = await POST(createRequest(validRegisterBody));
		const body = await response.json();

		expect(response.status).toBe(409);
		expect(body).toEqual({ success: false, error: "Username already taken" });
	});
});
