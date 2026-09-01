import { beforeEach, describe, expect, it, vi } from "vitest";

const mockListMcqs = vi.fn();
const mockCreateMcq = vi.fn();

vi.mock("@/lib/services/mcq-service", () => ({
	listMcqs: (...args: unknown[]) => mockListMcqs(...args),
	createMcq: (...args: unknown[]) => mockCreateMcq(...args),
}));

const mockMcqListItem = {
	id: "mcq-1",
	userId: "user-1",
	name: "Photosynthesis inputs",
	question: "Which two substances does a plant consume during photosynthesis?",
	choiceCount: 2,
	createdAt: "2026-09-01 12:00:00",
	updatedAt: "2026-09-01 12:00:00",
};

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

const validCreateBody = {
	userId: "user-1",
	name: "Photosynthesis inputs",
	question: "Which two substances does a plant consume during photosynthesis?",
	choices: [
		{ choiceText: "Carbon dioxide and water", isCorrect: true },
		{ choiceText: "Oxygen and glucose", isCorrect: false },
	],
};

function createPostRequest(body: unknown): Request {
	return new Request("http://localhost/api/mcqs", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
}

describe("/api/mcqs", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("GET", () => {
		it("returns 200 with the question list", async () => {
			mockListMcqs.mockResolvedValue([mockMcqListItem]);

			const { GET } = await import("@/app/api/mcqs/route");
			const response = await GET();
			const body = await response.json();

			expect(response.status).toBe(200);
			expect(body).toEqual({ success: true, mcqs: [mockMcqListItem] });
		});

		it("returns 200 with an empty array for an empty bank", async () => {
			mockListMcqs.mockResolvedValue([]);

			const { GET } = await import("@/app/api/mcqs/route");
			const response = await GET();
			const body = await response.json();

			expect(response.status).toBe(200);
			expect(body).toEqual({ success: true, mcqs: [] });
		});

		it("returns 500 when the service throws", async () => {
			mockListMcqs.mockRejectedValue(new Error("database unavailable"));

			const { GET } = await import("@/app/api/mcqs/route");
			const response = await GET();
			const body = await response.json();

			expect(response.status).toBe(500);
			expect(body).toEqual({ success: false, error: "Internal server error" });
		});
	});

	describe("POST", () => {
		it("returns 201 with the created question", async () => {
			mockCreateMcq.mockResolvedValue(mockMcq);

			const { POST } = await import("@/app/api/mcqs/route");
			const response = await POST(createPostRequest(validCreateBody));
			const body = await response.json();

			expect(response.status).toBe(201);
			expect(body).toEqual({ success: true, mcq: mockMcq });
			expect(mockCreateMcq).toHaveBeenCalledWith(validCreateBody);
		});

		it("returns 400 on an invalid body", async () => {
			const { POST } = await import("@/app/api/mcqs/route");
			const response = await POST(createPostRequest({ name: "Missing fields" }));
			const body = await response.json();

			expect(response.status).toBe(400);
			expect(body.success).toBe(false);
			expect(body.error).toBe("Validation failed");
			expect(body.details).toBeDefined();
			expect(mockCreateMcq).not.toHaveBeenCalled();
		});

		it("returns 500 when the service throws", async () => {
			mockCreateMcq.mockRejectedValue(new Error("database unavailable"));

			const { POST } = await import("@/app/api/mcqs/route");
			const response = await POST(createPostRequest(validCreateBody));
			const body = await response.json();

			expect(response.status).toBe(500);
			expect(body).toEqual({ success: false, error: "Internal server error" });
		});
	});
});
