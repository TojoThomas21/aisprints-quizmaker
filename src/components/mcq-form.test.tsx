import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push }),
}));

const mockStoredUser = {
	id: "user-1",
	firstName: "Jane",
	lastName: "Smith",
	username: "jsmith",
	email: "jsmith@school.edu",
};

const mockMcq = {
	id: "mcq-1",
	userId: "user-1",
	name: "Photosynthesis inputs",
	question: "Which two substances does a plant consume during photosynthesis?",
	choices: [
		{ id: "choice-1", choiceText: "Water and carbon dioxide", isCorrect: true, position: 0 },
		{ id: "choice-2", choiceText: "Oxygen and glucose", isCorrect: false, position: 1 },
	],
};

describe("McqForm", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.resetModules();
		vi.stubGlobal("fetch", vi.fn());
		sessionStorage.clear();
		sessionStorage.setItem("quizmaker.user", JSON.stringify(mockStoredUser));
	});

	afterEach(() => {
		cleanup();
	});

	it("renders name, question, and two blank choices by default", async () => {
		const { McqForm } = await import("@/components/mcq-form");
		render(<McqForm mode="create" />);

		expect(screen.getByLabelText(/^name$/i)).toHaveValue("");
		expect(screen.getByLabelText(/^question$/i)).toHaveValue("");
		expect(screen.getByLabelText(/^choice 1$/i)).toHaveValue("");
		expect(screen.getByLabelText(/^choice 2$/i)).toHaveValue("");
	});

	it("add choice appends a row", async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		const { McqForm } = await import("@/components/mcq-form");
		render(<McqForm mode="create" />);

		await user.click(screen.getByRole("button", { name: /add choice/i }));

		expect(screen.getByLabelText(/^choice 3$/i)).toBeInTheDocument();
	});

	it("add choice is disabled at six choices", async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		const { McqForm } = await import("@/components/mcq-form");
		render(<McqForm mode="create" />);

		const addButton = screen.getByRole("button", { name: /add choice/i });
		await user.click(addButton);
		await user.click(addButton);
		await user.click(addButton);
		await user.click(addButton);

		expect(screen.getByLabelText(/^choice 6$/i)).toBeInTheDocument();
		expect(addButton).toBeDisabled();
	});

	it("remove choice deletes a row", async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		const { McqForm } = await import("@/components/mcq-form");
		render(<McqForm mode="create" />);

		await user.click(screen.getByRole("button", { name: /add choice/i }));
		expect(screen.getByLabelText(/^choice 3$/i)).toBeInTheDocument();

		await user.click(screen.getByRole("button", { name: /remove choice 3/i }));

		expect(screen.queryByLabelText(/^choice 3$/i)).not.toBeInTheDocument();
	});

	it("remove is disabled at two choices", async () => {
		const { McqForm } = await import("@/components/mcq-form");
		render(<McqForm mode="create" />);

		expect(screen.getByRole("button", { name: /remove choice 1/i })).toBeDisabled();
		expect(screen.getByRole("button", { name: /remove choice 2/i })).toBeDisabled();
	});

	it("marking a choice correct deselects the previous one", async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		const { McqForm } = await import("@/components/mcq-form");
		render(<McqForm mode="create" />);

		await user.click(screen.getByRole("radio", { name: /mark choice 1 as correct/i }));
		await user.click(screen.getByRole("radio", { name: /mark choice 2 as correct/i }));

		expect(screen.getByRole("radio", { name: /mark choice 1 as correct/i })).not.toBeChecked();
		expect(screen.getByRole("radio", { name: /mark choice 2 as correct/i })).toBeChecked();
	});

	it("removing the correct choice clears the selection", async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		const { McqForm } = await import("@/components/mcq-form");
		render(<McqForm mode="create" />);

		await user.click(screen.getByRole("radio", { name: /mark choice 1 as correct/i }));
		await user.click(screen.getByRole("button", { name: /add choice/i }));
		await user.click(screen.getByRole("button", { name: /remove choice 1/i }));

		expect(screen.getByRole("radio", { name: /mark choice 1 as correct/i })).not.toBeChecked();
		expect(screen.getByRole("radio", { name: /mark choice 2 as correct/i })).not.toBeChecked();
	});

	it("save is blocked when the name is blank", async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		const { McqForm } = await import("@/components/mcq-form");
		render(<McqForm mode="create" />);

		await user.type(screen.getByLabelText(/^question$/i), "What is 2+2?");
		await user.type(screen.getByLabelText(/^choice 1$/i), "3");
		await user.type(screen.getByLabelText(/^choice 2$/i), "4");
		await user.click(screen.getByRole("radio", { name: /mark choice 2 as correct/i }));
		await user.click(screen.getByRole("button", { name: /^save$/i }));

		expect(await screen.findByRole("alert")).toHaveTextContent(/name is required/i);
		expect(fetch).not.toHaveBeenCalled();
	});

	it("save is blocked when the question is blank", async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		const { McqForm } = await import("@/components/mcq-form");
		render(<McqForm mode="create" />);

		await user.type(screen.getByLabelText(/^name$/i), "Math basics");
		await user.type(screen.getByLabelText(/^choice 1$/i), "3");
		await user.type(screen.getByLabelText(/^choice 2$/i), "4");
		await user.click(screen.getByRole("radio", { name: /mark choice 2 as correct/i }));
		await user.click(screen.getByRole("button", { name: /^save$/i }));

		expect(await screen.findByRole("alert")).toHaveTextContent(/question is required/i);
		expect(fetch).not.toHaveBeenCalled();
	});

	it("save is blocked when a choice is blank", async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		const { McqForm } = await import("@/components/mcq-form");
		render(<McqForm mode="create" />);

		await user.type(screen.getByLabelText(/^name$/i), "Math basics");
		await user.type(screen.getByLabelText(/^question$/i), "What is 2+2?");
		await user.type(screen.getByLabelText(/^choice 1$/i), "3");
		await user.click(screen.getByRole("radio", { name: /mark choice 1 as correct/i }));
		await user.click(screen.getByRole("button", { name: /^save$/i }));

		expect(await screen.findByRole("alert")).toHaveTextContent(/every choice must have text/i);
		expect(fetch).not.toHaveBeenCalled();
	});

	it("save is blocked when no choice is marked correct", async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		const { McqForm } = await import("@/components/mcq-form");
		render(<McqForm mode="create" />);

		await user.type(screen.getByLabelText(/^name$/i), "Math basics");
		await user.type(screen.getByLabelText(/^question$/i), "What is 2+2?");
		await user.type(screen.getByLabelText(/^choice 1$/i), "3");
		await user.type(screen.getByLabelText(/^choice 2$/i), "4");
		await user.click(screen.getByRole("button", { name: /^save$/i }));

		expect(await screen.findByRole("alert")).toHaveTextContent(/exactly one choice must be marked as correct/i);
		expect(fetch).not.toHaveBeenCalled();
	});

	it("create posts to POST /api/mcqs with userId from sessionStorage", async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		vi.mocked(fetch).mockResolvedValueOnce(
			new Response(JSON.stringify({ success: true, mcq: { id: "mcq-new" } }), { status: 201 }),
		);

		const { McqForm } = await import("@/components/mcq-form");
		render(<McqForm mode="create" />);

		await user.type(screen.getByLabelText(/^name$/i), "Math basics");
		await user.type(screen.getByLabelText(/^question$/i), "What is 2+2?");
		await user.type(screen.getByLabelText(/^choice 1$/i), "3");
		await user.type(screen.getByLabelText(/^choice 2$/i), "4");
		await user.click(screen.getByRole("radio", { name: /mark choice 2 as correct/i }));
		await user.click(screen.getByRole("button", { name: /^save$/i }));

		await waitFor(() => {
			expect(fetch).toHaveBeenCalledWith("/api/mcqs", expect.objectContaining({ method: "POST" }));
		});

		const [, options] = vi.mocked(fetch).mock.calls[0];
		const body = JSON.parse(String(options?.body));
		expect(body.userId).toBe("user-1");
		expect(body.name).toBe("Math basics");
		expect(body.question).toBe("What is 2+2?");
		expect(body.choices).toEqual([
			{ choiceText: "3", isCorrect: false },
			{ choiceText: "4", isCorrect: true },
		]);
	});

	it("edit puts to PUT /api/mcqs/[id]", async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		vi.mocked(fetch).mockResolvedValueOnce(
			new Response(JSON.stringify({ success: true, mcq: mockMcq }), { status: 200 }),
		);

		const { McqForm } = await import("@/components/mcq-form");
		render(<McqForm mode="edit" mcqId="mcq-1" initialMcq={mockMcq} />);

		await user.clear(screen.getByLabelText(/^name$/i));
		await user.type(screen.getByLabelText(/^name$/i), "Updated name");
		await user.click(screen.getByRole("button", { name: /^save$/i }));

		await waitFor(() => {
			expect(fetch).toHaveBeenCalledWith("/api/mcqs/mcq-1", expect.objectContaining({ method: "PUT" }));
		});
	});

	it("successful save navigates to /mcqs", async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		vi.mocked(fetch).mockResolvedValueOnce(
			new Response(JSON.stringify({ success: true, mcq: { id: "mcq-new" } }), { status: 201 }),
		);

		const { McqForm } = await import("@/components/mcq-form");
		render(<McqForm mode="create" />);

		await user.type(screen.getByLabelText(/^name$/i), "Math basics");
		await user.type(screen.getByLabelText(/^question$/i), "What is 2+2?");
		await user.type(screen.getByLabelText(/^choice 1$/i), "3");
		await user.type(screen.getByLabelText(/^choice 2$/i), "4");
		await user.click(screen.getByRole("radio", { name: /mark choice 2 as correct/i }));
		await user.click(screen.getByRole("button", { name: /^save$/i }));

		await waitFor(() => {
			expect(push).toHaveBeenCalledWith("/mcqs");
		});
	});

	it("API error is shown and navigation does not happen", async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		vi.mocked(fetch).mockResolvedValueOnce(
			new Response(JSON.stringify({ success: false, error: "Could not save question" }), { status: 400 }),
		);

		const { McqForm } = await import("@/components/mcq-form");
		render(<McqForm mode="create" />);

		await user.type(screen.getByLabelText(/^name$/i), "Math basics");
		await user.type(screen.getByLabelText(/^question$/i), "What is 2+2?");
		await user.type(screen.getByLabelText(/^choice 1$/i), "3");
		await user.type(screen.getByLabelText(/^choice 2$/i), "4");
		await user.click(screen.getByRole("radio", { name: /mark choice 2 as correct/i }));
		await user.click(screen.getByRole("button", { name: /^save$/i }));

		expect(await screen.findByRole("alert")).toHaveTextContent(/could not save question/i);
		expect(push).not.toHaveBeenCalled();
	});

	it("cancel navigates to /mcqs without a request", async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		const { McqForm } = await import("@/components/mcq-form");
		render(<McqForm mode="create" />);

		await user.click(screen.getByRole("button", { name: /cancel/i }));

		expect(push).toHaveBeenCalledWith("/mcqs");
		expect(fetch).not.toHaveBeenCalled();
	});

	it("edit mode pre-fills name, question, and existing choices", async () => {
		const { McqForm } = await import("@/components/mcq-form");
		render(<McqForm mode="edit" mcqId="mcq-1" initialMcq={mockMcq} />);

		expect(screen.getByLabelText(/^name$/i)).toHaveValue("Photosynthesis inputs");
		expect(screen.getByLabelText(/^question$/i)).toHaveValue(
			"Which two substances does a plant consume during photosynthesis?",
		);
		expect(screen.getByLabelText(/^choice 1$/i)).toHaveValue("Water and carbon dioxide");
		expect(screen.getByLabelText(/^choice 2$/i)).toHaveValue("Oxygen and glucose");
		expect(screen.getByRole("radio", { name: /mark choice 1 as correct/i })).toBeChecked();
	});
});
