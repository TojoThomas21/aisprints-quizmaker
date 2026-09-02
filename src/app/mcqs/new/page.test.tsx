import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push }),
}));

describe("/mcqs/new page", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.resetModules();
		vi.stubGlobal("fetch", vi.fn());
		sessionStorage.clear();
	});

	afterEach(() => {
		cleanup();
	});

	it("renders the editor in create mode", async () => {
		sessionStorage.setItem(
			"quizmaker.user",
			JSON.stringify({ id: "user-1", firstName: "Jane" }),
		);

		const Page = (await import("@/app/mcqs/new/page")).default;
		render(<Page />);

		expect(screen.getByText("Create question")).toBeInTheDocument();
		expect(screen.getByLabelText(/^name$/i)).toHaveValue("");
		expect(screen.getByLabelText(/^choice 1$/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/^choice 2$/i)).toBeInTheDocument();
	});

	it("redirects to /login when no stored user", async () => {
		const Page = (await import("@/app/mcqs/new/page")).default;
		render(<Page />);

		await waitFor(() => {
			expect(push).toHaveBeenCalledWith("/login");
		});
	});
});
