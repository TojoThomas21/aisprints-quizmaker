import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const router = { push };
const fetchMock = vi.fn();

vi.mock("next/navigation", () => ({
	useRouter: () => router,
	useParams: () => ({ id: "mcq-1" }),
}));

vi.stubGlobal("fetch", fetchMock);

const mockMcq = {
	id: "mcq-1",
	userId: "user-1",
	name: "Photosynthesis inputs",
	question: "Which two substances does a plant consume during photosynthesis?",
	choices: [
		{ id: "choice-1", choiceText: "Water and carbon dioxide", isCorrect: true, position: 0 },
		{ id: "choice-2", choiceText: "Oxygen and glucose", isCorrect: false, position: 1 },
	],
	createdAt: "2026-09-01 12:00:00",
	updatedAt: "2026-09-01 12:00:00",
};

function mockMcqResponse(mcq = mockMcq, status = 200) {
	return new Response(JSON.stringify({ success: true, mcq }), { status });
}

describe("/mcqs/[id]/edit page", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		fetchMock.mockReset();
		vi.resetModules();
		sessionStorage.clear();
		sessionStorage.setItem(
			"quizmaker.user",
			JSON.stringify({ id: "user-1", firstName: "Jane" }),
		);
	});

	afterEach(() => {
		cleanup();
	});

	it("fetches GET /api/mcqs/[id] on mount", async () => {
		fetchMock.mockImplementation(() => Promise.resolve(mockMcqResponse()));

		const Page = (await import("@/app/mcqs/[id]/edit/page")).default;
		render(<Page />);

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledWith("/api/mcqs/mcq-1");
		});
	});

	it("renders the editor pre-filled", async () => {
		fetchMock.mockImplementation(() => Promise.resolve(mockMcqResponse()));

		const Page = (await import("@/app/mcqs/[id]/edit/page")).default;
		render(<Page />);

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledWith("/api/mcqs/mcq-1");
		});

		expect(await screen.findByLabelText(/^name$/i, {}, { timeout: 3000 })).toHaveValue(
			"Photosynthesis inputs",
		);
		expect(screen.getByLabelText(/^question$/i)).toHaveValue(
			"Which two substances does a plant consume during photosynthesis?",
		);
		expect(screen.getByLabelText(/^choice 1$/i)).toHaveValue("Water and carbon dioxide");
	});

	it("renders a not-found state on 404", async () => {
		fetchMock.mockImplementation(() =>
			Promise.resolve(
				new Response(JSON.stringify({ success: false, error: "Question not found" }), { status: 404 }),
			),
		);

		const Page = (await import("@/app/mcqs/[id]/edit/page")).default;
		render(<Page />);

		expect(await screen.findByText(/question not found/i)).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /back to questions/i })).toHaveAttribute("href", "/mcqs");
	});
});
