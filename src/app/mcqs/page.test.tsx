import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent, { type UserEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push }),
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

function mockListResponse(mcqs: typeof mockMcqListItem[] = [mockMcqListItem]) {
	return new Response(JSON.stringify({ success: true, mcqs }), { status: 200 });
}

async function openRowActionsMenu(user: UserEvent) {
	const trigger = screen.getByRole("button", { name: /actions for photosynthesis inputs/i });
	await user.click(trigger);
	await screen.findByRole("menuitem", { name: /edit/i });
}

describe("/mcqs page", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.resetModules();
		vi.stubGlobal("fetch", vi.fn());
		sessionStorage.clear();
	});

	afterEach(() => {
		cleanup();
	});

	it("fetches GET /api/mcqs on mount", async () => {
		vi.mocked(fetch).mockResolvedValueOnce(mockListResponse());

		const Page = (await import("@/app/mcqs/page")).default;
		render(<Page />);

		await waitFor(() => {
			expect(fetch).toHaveBeenCalledWith("/api/mcqs");
		});
	});

	it("renders a row per question with name and question text", async () => {
		vi.mocked(fetch).mockResolvedValueOnce(mockListResponse());

		const Page = (await import("@/app/mcqs/page")).default;
		render(<Page />);

		expect(await screen.findByText("Photosynthesis inputs")).toBeInTheDocument();
		expect(
			screen.getByText("Which two substances does a plant consume during photosynthesis?"),
		).toBeInTheDocument();
	});

	it("renders the empty state when the bank is empty", async () => {
		vi.mocked(fetch).mockResolvedValueOnce(mockListResponse([]));

		const Page = (await import("@/app/mcqs/page")).default;
		render(<Page />);

		expect(await screen.findByText(/no questions yet/i)).toBeInTheDocument();
		const createLinks = screen.getAllByRole("link", { name: /create question/i });
		expect(createLinks.some((link) => link.getAttribute("href") === "/mcqs/new")).toBe(true);
	});

	it("renders an error banner when the fetch fails", async () => {
		vi.mocked(fetch).mockResolvedValueOnce(
			new Response(JSON.stringify({ success: false, error: "Server error" }), { status: 500 }),
		);

		const Page = (await import("@/app/mcqs/page")).default;
		render(<Page />);

		expect(await screen.findByText(/could not load questions/i)).toBeInTheDocument();
	});

	it("create question links to /mcqs/new", async () => {
		vi.mocked(fetch).mockResolvedValueOnce(mockListResponse());

		const Page = (await import("@/app/mcqs/page")).default;
		render(<Page />);

		await screen.findByText("Photosynthesis inputs");
		expect(screen.getByRole("link", { name: /create question/i })).toHaveAttribute("href", "/mcqs/new");
	});

	it("row actions menu opens with Edit, Preview, Delete", async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		vi.mocked(fetch).mockResolvedValueOnce(mockListResponse());

		const Page = (await import("@/app/mcqs/page")).default;
		render(<Page />);

		await screen.findByText("Photosynthesis inputs");
		await openRowActionsMenu(user);

		expect(screen.getByRole("menuitem", { name: /edit/i })).toBeInTheDocument();
		expect(screen.getByRole("menuitem", { name: /preview/i })).toBeInTheDocument();
		expect(screen.getByRole("menuitem", { name: /delete/i })).toBeInTheDocument();
	});

	it("edit navigates to /mcqs/[id]/edit", async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		vi.mocked(fetch).mockResolvedValueOnce(mockListResponse());

		const Page = (await import("@/app/mcqs/page")).default;
		render(<Page />);

		await screen.findByText("Photosynthesis inputs");
		await openRowActionsMenu(user);
		await user.click(screen.getByRole("menuitem", { name: /edit/i }));

		expect(push).toHaveBeenCalledWith("/mcqs/mcq-1/edit");
	});

	it("preview navigates to /mcqs/[id]/preview", async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		vi.mocked(fetch).mockResolvedValueOnce(mockListResponse());

		const Page = (await import("@/app/mcqs/page")).default;
		render(<Page />);

		await screen.findByText("Photosynthesis inputs");
		await openRowActionsMenu(user);
		await user.click(screen.getByRole("menuitem", { name: /preview/i }));

		expect(push).toHaveBeenCalledWith("/mcqs/mcq-1/preview");
	});

	it("delete opens a confirmation dialog before any request", async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		vi.mocked(fetch).mockResolvedValueOnce(mockListResponse());

		const Page = (await import("@/app/mcqs/page")).default;
		render(<Page />);

		await screen.findByText("Photosynthesis inputs");
		await openRowActionsMenu(user);
		await user.click(screen.getByRole("menuitem", { name: /delete/i }));

		expect(screen.getByRole("dialog")).toBeInTheDocument();
		expect(screen.getByText(/delete question\?/i)).toBeInTheDocument();
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it("confirming delete calls DELETE /api/mcqs/[id]", async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		vi.mocked(fetch)
			.mockResolvedValueOnce(mockListResponse())
			.mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }))
			.mockResolvedValueOnce(mockListResponse([]));

		const Page = (await import("@/app/mcqs/page")).default;
		render(<Page />);

		await screen.findByText("Photosynthesis inputs");
		await openRowActionsMenu(user);
		await user.click(screen.getByRole("menuitem", { name: /delete/i }));

		const dialog = screen.getByRole("dialog");
		await user.click(within(dialog).getByRole("button", { name: /^delete$/i }));

		await waitFor(() => {
			expect(fetch).toHaveBeenCalledWith("/api/mcqs/mcq-1", { method: "DELETE" });
		});
	});

	it("confirming delete removes the row from the table", async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		vi.mocked(fetch)
			.mockResolvedValueOnce(mockListResponse())
			.mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }))
			.mockResolvedValueOnce(mockListResponse([]));

		const Page = (await import("@/app/mcqs/page")).default;
		render(<Page />);

		await screen.findByText("Photosynthesis inputs");
		await openRowActionsMenu(user);
		await user.click(screen.getByRole("menuitem", { name: /delete/i }));

		const dialog = screen.getByRole("dialog");
		await user.click(within(dialog).getByRole("button", { name: /^delete$/i }));

		expect(await screen.findByText(/no questions yet/i)).toBeInTheDocument();
		expect(screen.queryByText("Photosynthesis inputs")).not.toBeInTheDocument();
	});

	it("cancelling the dialog sends no delete request", async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		vi.mocked(fetch).mockResolvedValueOnce(mockListResponse());

		const Page = (await import("@/app/mcqs/page")).default;
		render(<Page />);

		await screen.findByText("Photosynthesis inputs");
		await openRowActionsMenu(user);
		await user.click(screen.getByRole("menuitem", { name: /delete/i }));

		const dialog = screen.getByRole("dialog");
		await user.click(within(dialog).getByRole("button", { name: /cancel/i }));

		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it("logout button calls POST /api/auth/logout", async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		vi.mocked(fetch)
			.mockResolvedValueOnce(mockListResponse())
			.mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }));

		const Page = (await import("@/app/mcqs/page")).default;
		render(<Page />);

		await screen.findByText("Photosynthesis inputs");
		await user.click(screen.getByRole("button", { name: /logout/i }));

		await waitFor(() => {
			expect(fetch).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" });
		});
	});

	it("logout navigates to /login", async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		vi.mocked(fetch)
			.mockResolvedValueOnce(mockListResponse())
			.mockResolvedValueOnce(new Response(JSON.stringify({ success: true }), { status: 200 }));

		const Page = (await import("@/app/mcqs/page")).default;
		render(<Page />);

		await screen.findByText("Photosynthesis inputs");
		await user.click(screen.getByRole("button", { name: /logout/i }));

		await waitFor(() => {
			expect(push).toHaveBeenCalledWith("/login");
		});
	});
});
