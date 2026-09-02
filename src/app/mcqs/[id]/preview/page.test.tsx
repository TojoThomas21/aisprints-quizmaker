import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const router = { push };
const fetchMock = vi.fn();

vi.mock("next/navigation", () => ({
	useRouter: () => router,
	useParams: () => ({ id: "mcq-1" }),
}));

vi.stubGlobal("fetch", fetchMock);

const mockStoredUser = {
	id: "user-1",
	firstName: "Jane",
};

const mockMcq = {
	id: "mcq-1",
	userId: "user-1",
	name: "Photosynthesis inputs",
	question: "Which two substances does a plant consume during photosynthesis?",
	choices: [
		{ id: "choice-2", choiceText: "Oxygen and glucose", isCorrect: false, position: 1 },
		{ id: "choice-1", choiceText: "Water and carbon dioxide", isCorrect: true, position: 0 },
	],
	createdAt: "2026-09-01 12:00:00",
	updatedAt: "2026-09-01 12:00:00",
};

function mockMcqResponse() {
	return new Response(JSON.stringify({ success: true, mcq: mockMcq }), { status: 200 });
}

function mockAttemptResponse(isCorrect: boolean) {
	return new Response(
		JSON.stringify({
			success: true,
			attempt: {
				id: "attempt-1",
				mcqId: "mcq-1",
				userId: "user-1",
				choiceId: isCorrect ? "choice-1" : "choice-2",
				selectedChoiceText: isCorrect ? "Water and carbon dioxide" : "Oxygen and glucose",
				isCorrect,
				createdAt: "2026-09-01 12:00:00",
			},
		}),
		{ status: 201 },
	);
}

function setupFetchHandlers(options?: {
	attemptIsCorrect?: boolean;
	attemptFails?: boolean;
}) {
	fetchMock.mockImplementation((url: string, init?: RequestInit) => {
		if (url === "/api/mcqs/mcq-1") {
			return Promise.resolve(mockMcqResponse());
		}

		if (url === "/api/mcqs/mcq-1/attempts" && init?.method === "POST") {
			if (options?.attemptFails) {
				return Promise.resolve(
					new Response(JSON.stringify({ success: false, error: "Could not record attempt" }), {
						status: 500,
					}),
				);
			}

			return Promise.resolve(mockAttemptResponse(options?.attemptIsCorrect ?? true));
		}

		return Promise.reject(new Error(`Unhandled fetch: ${url}`));
	});
}

async function renderPreviewPage() {
	const Page = (await import("@/app/mcqs/[id]/preview/page")).default;
	render(<Page />);
	await waitFor(() => {
		expect(fetchMock).toHaveBeenCalledWith("/api/mcqs/mcq-1");
	});
	await screen.findByText("Photosynthesis inputs");
}

describe("/mcqs/[id]/preview page", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		fetchMock.mockReset();
		vi.resetModules();
		sessionStorage.clear();
		sessionStorage.setItem("quizmaker.user", JSON.stringify(mockStoredUser));
	});

	afterEach(() => {
		cleanup();
	});

	it("fetches the question on mount", async () => {
		setupFetchHandlers();
		await renderPreviewPage();

		expect(fetchMock).toHaveBeenCalledWith("/api/mcqs/mcq-1");
	});

	it("renders the name, question text, and all choices in position order", async () => {
		setupFetchHandlers();
		await renderPreviewPage();

		expect(screen.getByText("Photosynthesis inputs")).toBeInTheDocument();
		expect(
			screen.getByText("Which two substances does a plant consume during photosynthesis?"),
		).toBeInTheDocument();

		const radios = screen.getAllByRole("radio");
		expect(radios).toHaveLength(2);
		expect(radios[0]).toHaveAccessibleName("Water and carbon dioxide");
		expect(radios[1]).toHaveAccessibleName("Oxygen and glucose");
	});

	it("does not reveal the correct answer before submitting", async () => {
		setupFetchHandlers();
		await renderPreviewPage();

		expect(screen.queryByText(/correct answer/i)).not.toBeInTheDocument();
		expect(screen.queryByText(/incorrect/i)).not.toBeInTheDocument();
	});

	it("submit is disabled until a choice is selected", async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		setupFetchHandlers();
		await renderPreviewPage();

		const submitButton = screen.getByRole("button", { name: /submit answer/i });
		expect(submitButton).toBeDisabled();

		await user.click(screen.getByRole("radio", { name: /water and carbon dioxide/i }));

		expect(submitButton).toBeEnabled();
	});

	it("submit posts choiceId and userId to the attempts endpoint", async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		setupFetchHandlers({ attemptIsCorrect: true });
		await renderPreviewPage();

		await user.click(screen.getByRole("radio", { name: /water and carbon dioxide/i }));
		await user.click(screen.getByRole("button", { name: /submit answer/i }));

		await waitFor(() => {
			expect(fetchMock).toHaveBeenCalledWith(
				"/api/mcqs/mcq-1/attempts",
				expect.objectContaining({ method: "POST" }),
			);
		});

		const [, options] = fetchMock.mock.calls.find(
			([url, init]) => url === "/api/mcqs/mcq-1/attempts" && init?.method === "POST",
		)!;
		const body = JSON.parse(String(options?.body));
		expect(body).toEqual({ userId: "user-1", choiceId: "choice-1" });
	});

	it("correct answer shows a success result", async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		setupFetchHandlers({ attemptIsCorrect: true });
		await renderPreviewPage();

		await user.click(screen.getByRole("radio", { name: /water and carbon dioxide/i }));
		await user.click(screen.getByRole("button", { name: /submit answer/i }));

		expect(await screen.findByText("Correct")).toBeInTheDocument();
	});

	it("wrong answer shows an incorrect result", async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		setupFetchHandlers({ attemptIsCorrect: false });
		await renderPreviewPage();

		await user.click(screen.getByRole("radio", { name: /oxygen and glucose/i }));
		await user.click(screen.getByRole("button", { name: /submit answer/i }));

		expect(await screen.findByText("Incorrect")).toBeInTheDocument();
	});

	it("try again clears the result and allows another submission", async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		setupFetchHandlers({ attemptIsCorrect: true });
		await renderPreviewPage();

		await user.click(screen.getByRole("radio", { name: /water and carbon dioxide/i }));
		await user.click(screen.getByRole("button", { name: /submit answer/i }));
		expect(await screen.findByText("Correct")).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: /try again/i }));
		expect(screen.queryByText("Correct")).not.toBeInTheDocument();

		await user.click(screen.getByRole("radio", { name: /oxygen and glucose/i }));
		await user.click(screen.getByRole("button", { name: /submit answer/i }));

		await waitFor(() => {
			const postCalls = fetchMock.mock.calls.filter(
				([url, init]) => url === "/api/mcqs/mcq-1/attempts" && init?.method === "POST",
			);
			expect(postCalls).toHaveLength(2);
		});
	});

	it("renders a not-found state on 404", async () => {
		fetchMock.mockImplementation(() =>
			Promise.resolve(
				new Response(JSON.stringify({ success: false, error: "Question not found" }), { status: 404 }),
			),
		);

		const Page = (await import("@/app/mcqs/[id]/preview/page")).default;
		render(<Page />);

		expect(await screen.findByText(/question not found/i)).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /back to questions/i })).toHaveAttribute("href", "/mcqs");
	});

	it("shows an error and no result when the attempt request fails", async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		setupFetchHandlers({ attemptFails: true });
		await renderPreviewPage();

		await user.click(screen.getByRole("radio", { name: /water and carbon dioxide/i }));
		await user.click(screen.getByRole("button", { name: /submit answer/i }));

		expect(await screen.findByRole("alert")).toHaveTextContent(/could not record attempt/i);
		expect(screen.queryByText("Correct")).not.toBeInTheDocument();
	});
});
