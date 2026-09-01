import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetMcqById = vi.fn();
const mockUpdateMcq = vi.fn();
const mockDeleteMcq = vi.fn();

class McqNotFoundError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "McqNotFoundError";
	}
}

vi.mock("@/lib/services/mcq-service", () => ({
	getMcqById: (...args: unknown[]) => mockGetMcqById(...args),
	updateMcq: (...args: unknown[]) => mockUpdateMcq(...args),
	deleteMcq: (...args: unknown[]) => mockDeleteMcq(...args),
	McqNotFoundError,
}));

const mockMcq = {
	id: "mcq-1",
	userId: "user-1",
	name: "Photosynthesis inputs",
	question: "Which two substances does a plant consume during photosynthesis?",
	choices: [
		{ id: "choice-1", choiceText: "Carbon dioxide and water", isCorrect: true, position: 0 },
		{ id: "choice-2", choiceText: "Oxygen and glucose", isCorrect: false, position: 1 },
	],
	createdAt: "2026-09-01 12:00:00",
	updatedAt: "2026-09-01 12:00:00",
};

const validUpdateBody = {
	name: "Updated name",
	question: "Updated question?",
	choices: [
		{ id: "choice-1", choiceText: "Carbon dioxide and water", isCorrect: true },
		{ choiceText: "Oxygen and glucose", isCorrect: false },
	],
};

function createPutRequest(body: unknown): Request {
	return new Request("http://localhost/api/mcqs/mcq-1", {
		method: "PUT",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

function createRouteContext(id: string) {
	return { params: Promise.resolve({ id }) };
}

describe("/api/mcqs/[id]", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("GET", () => {
		it("returns 200 with the question and choices", async () => {
			mockGetMcqById.mockResolvedValue(mockMcq);

			const { GET } = await import("@/app/api/mcqs/[id]/route");
			const response = await GET(new Request("http://localhost/api/mcqs/mcq-1"), createRouteContext("mcq-1"));
			const body = await response.json();

			expect(response.status).toBe(200);
			expect(body).toEqual({ success: true, mcq: mockMcq });
			expect(mockGetMcqById).toHaveBeenCalledWith("mcq-1");
		});

		it("returns 404 for an unknown id", async () => {
			mockGetMcqById.mockResolvedValue(null);

			const { GET } = await import("@/app/api/mcqs/[id]/route");
			const response = await GET(new Request("http://localhost/api/mcqs/missing"), createRouteContext("missing"));
			const body = await response.json();

			expect(response.status).toBe(404);
			expect(body).toEqual({ success: false, error: "Question not found" });
		});
	});

	describe("PUT", () => {
		it("returns 200 with the updated question", async () => {
			const updatedMcq = { ...mockMcq, name: "Updated name", question: "Updated question?" };
			mockUpdateMcq.mockResolvedValue(updatedMcq);

			const { PUT } = await import("@/app/api/mcqs/[id]/route");
			const response = await PUT(createPutRequest(validUpdateBody), createRouteContext("mcq-1"));
			const body = await response.json();

			expect(response.status).toBe(200);
			expect(body).toEqual({ success: true, mcq: updatedMcq });
			expect(mockUpdateMcq).toHaveBeenCalledWith("mcq-1", validUpdateBody);
		});

		it("returns 400 on an invalid body", async () => {
			const { PUT } = await import("@/app/api/mcqs/[id]/route");
			const response = await PUT(createPutRequest({ name: "Only name" }), createRouteContext("mcq-1"));
			const body = await response.json();

			expect(response.status).toBe(400);
			expect(body.success).toBe(false);
			expect(body.error).toBe("Validation failed");
			expect(mockUpdateMcq).not.toHaveBeenCalled();
		});

		it("returns 404 when the service throws McqNotFoundError", async () => {
			mockUpdateMcq.mockRejectedValue(new McqNotFoundError("Question not found"));

			const { PUT } = await import("@/app/api/mcqs/[id]/route");
			const response = await PUT(createPutRequest(validUpdateBody), createRouteContext("missing"));
			const body = await response.json();

			expect(response.status).toBe(404);
			expect(body).toEqual({ success: false, error: "Question not found" });
		});
	});

	describe("DELETE", () => {
		it("returns 200 on success", async () => {
			mockDeleteMcq.mockResolvedValue(undefined);

			const { DELETE } = await import("@/app/api/mcqs/[id]/route");
			const response = await DELETE(new Request("http://localhost/api/mcqs/mcq-1"), createRouteContext("mcq-1"));
			const body = await response.json();

			expect(response.status).toBe(200);
			expect(body).toEqual({ success: true });
			expect(mockDeleteMcq).toHaveBeenCalledWith("mcq-1");
		});

		it("returns 404 for an unknown id", async () => {
			mockDeleteMcq.mockRejectedValue(new McqNotFoundError("Question not found"));

			const { DELETE } = await import("@/app/api/mcqs/[id]/route");
			const response = await DELETE(new Request("http://localhost/api/mcqs/missing"), createRouteContext("missing"));
			const body = await response.json();

			expect(response.status).toBe(404);
			expect(body).toEqual({ success: false, error: "Question not found" });
		});
	});

	it("reads the async params promise correctly", async () => {
		mockGetMcqById.mockResolvedValue(mockMcq);

		const { GET } = await import("@/app/api/mcqs/[id]/route");
		await GET(new Request("http://localhost/api/mcqs/route-id"), createRouteContext("route-id"));

		expect(mockGetMcqById).toHaveBeenCalledWith("route-id");
	});
});
