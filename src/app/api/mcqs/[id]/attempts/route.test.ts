import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateAttempt = vi.fn();
const mockListAttemptsByMcq = vi.fn();

class McqNotFoundError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "McqNotFoundError";
	}
}

class McqValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "McqValidationError";
	}
}

vi.mock("@/lib/services/mcq-service", () => ({
	createAttempt: (...args: unknown[]) => mockCreateAttempt(...args),
	listAttemptsByMcq: (...args: unknown[]) => mockListAttemptsByMcq(...args),
	McqNotFoundError,
	McqValidationError,
}));

const mockAttempt = {
	id: "attempt-1",
	mcqId: "mcq-1",
	userId: "user-1",
	choiceId: "choice-1",
	selectedChoiceText: "Carbon dioxide and water",
	isCorrect: true,
	createdAt: "2026-09-01 12:05:00",
};

const validAttemptBody = {
	userId: "user-1",
	choiceId: "choice-1",
};

function createPostRequest(body: unknown): Request {
	return new Request("http://localhost/api/mcqs/mcq-1/attempts", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

function createRouteContext(id: string) {
	return { params: Promise.resolve({ id }) };
}

describe("/api/mcqs/[id]/attempts", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("POST", () => {
		it("returns 201 with the recorded attempt", async () => {
			mockCreateAttempt.mockResolvedValue(mockAttempt);

			const { POST } = await import("@/app/api/mcqs/[id]/attempts/route");
			const response = await POST(createPostRequest(validAttemptBody), createRouteContext("mcq-1"));
			const body = await response.json();

			expect(response.status).toBe(201);
			expect(body).toEqual({ success: true, attempt: mockAttempt });
			expect(body.attempt.isCorrect).toBe(true);
			expect(mockCreateAttempt).toHaveBeenCalledWith("mcq-1", validAttemptBody);
		});

		it("returns 400 on an invalid body", async () => {
			const { POST } = await import("@/app/api/mcqs/[id]/attempts/route");
			const response = await POST(createPostRequest({ userId: "" }), createRouteContext("mcq-1"));
			const body = await response.json();

			expect(response.status).toBe(400);
			expect(body.success).toBe(false);
			expect(body.error).toBe("Validation failed");
			expect(mockCreateAttempt).not.toHaveBeenCalled();
		});

		it("returns 400 when the choice belongs to another question", async () => {
			mockCreateAttempt.mockRejectedValue(
				new McqValidationError("Choice does not belong to this question"),
			);

			const { POST } = await import("@/app/api/mcqs/[id]/attempts/route");
			const response = await POST(createPostRequest(validAttemptBody), createRouteContext("mcq-1"));
			const body = await response.json();

			expect(response.status).toBe(400);
			expect(body).toEqual({
				success: false,
				error: "Choice does not belong to this question",
			});
		});

		it("returns 404 for an unknown question", async () => {
			mockCreateAttempt.mockRejectedValue(new McqNotFoundError("Question not found"));

			const { POST } = await import("@/app/api/mcqs/[id]/attempts/route");
			const response = await POST(createPostRequest(validAttemptBody), createRouteContext("missing"));
			const body = await response.json();

			expect(response.status).toBe(404);
			expect(body).toEqual({ success: false, error: "Question not found" });
		});

		it("does not let the client set isCorrect", async () => {
			mockCreateAttempt.mockResolvedValue(mockAttempt);

			const { POST } = await import("@/app/api/mcqs/[id]/attempts/route");
			const response = await POST(
				createPostRequest({ ...validAttemptBody, isCorrect: false }),
				createRouteContext("mcq-1"),
			);
			const body = await response.json();

			expect(mockCreateAttempt).toHaveBeenCalledWith("mcq-1", validAttemptBody);
			expect(body.attempt.isCorrect).toBe(true);
		});
	});

	describe("GET", () => {
		it("returns 200 with the attempt list", async () => {
			mockListAttemptsByMcq.mockResolvedValue([mockAttempt]);

			const { GET } = await import("@/app/api/mcqs/[id]/attempts/route");
			const response = await GET(
				new Request("http://localhost/api/mcqs/mcq-1/attempts"),
				createRouteContext("mcq-1"),
			);
			const body = await response.json();

			expect(response.status).toBe(200);
			expect(body).toEqual({ success: true, attempts: [mockAttempt] });
			expect(mockListAttemptsByMcq).toHaveBeenCalledWith("mcq-1");
		});

		it("returns 404 for an unknown question", async () => {
			mockListAttemptsByMcq.mockRejectedValue(new McqNotFoundError("Question not found"));

			const { GET } = await import("@/app/api/mcqs/[id]/attempts/route");
			const response = await GET(
				new Request("http://localhost/api/mcqs/missing/attempts"),
				createRouteContext("missing"),
			);
			const body = await response.json();

			expect(response.status).toBe(404);
			expect(body).toEqual({ success: false, error: "Question not found" });
		});
	});
});
