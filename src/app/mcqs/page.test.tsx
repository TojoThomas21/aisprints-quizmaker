import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push }),
}));

describe("/mcqs page", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal("fetch", vi.fn());
		sessionStorage.clear();
	});

	it("renders stub heading and placeholder text", async () => {
		const Page = (await import("@/app/mcqs/page")).default;
		render(<Page />);

		expect(screen.getByText(/mcq question bank/i)).toBeInTheDocument();
		expect(screen.getByText(/question bank features coming soon/i)).toBeInTheDocument();
	});

	it("logout button calls POST /api/auth/logout", async () => {
		const user = userEvent.setup();
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify({ success: true }), { status: 200 }),
		);

		const Page = (await import("@/app/mcqs/page")).default;
		render(<Page />);

		await user.click(screen.getByRole("button", { name: /logout/i }));

		await waitFor(() => {
			expect(fetch).toHaveBeenCalledWith("/api/auth/logout", { method: "POST" });
		});
	});

	it("logout navigates to /login", async () => {
		const user = userEvent.setup();
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify({ success: true }), { status: 200 }),
		);

		const Page = (await import("@/app/mcqs/page")).default;
		render(<Page />);

		await user.click(screen.getByRole("button", { name: /logout/i }));

		await waitFor(() => {
			expect(push).toHaveBeenCalledWith("/login");
		});
	});
});
