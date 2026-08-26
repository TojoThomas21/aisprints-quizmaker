import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push }),
}));

describe("/login LoginForm", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal("fetch", vi.fn());
	});

	it("renders username and password fields", async () => {
		const { LoginForm } = await import("@/components/login-form");
		render(<LoginForm />);

		expect(screen.getByLabelText(/username or email/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
	});

	it("submits hashed password in request body", async () => {
		const user = userEvent.setup();
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify({ success: true, user: { id: "1", firstName: "Jane" } }), {
				status: 200,
			}),
		);

		const { LoginForm } = await import("@/components/login-form");
		render(<LoginForm />);

		await user.type(screen.getByLabelText(/username or email/i), "jsmith");
		await user.type(screen.getByLabelText(/^password$/i), "password123");
		await user.click(screen.getByRole("button", { name: /^login$/i }));

		await waitFor(() => {
			expect(fetch).toHaveBeenCalled();
		});

		const [, options] = vi.mocked(fetch).mock.calls[0];
		const body = JSON.parse(String(options?.body));

		expect(body.passwordHash).toMatch(/^[a-f0-9]{64}$/);
		expect(body.passwordHash).not.toBe("password123");
	});

	it("shows generic error on 401", async () => {
		const user = userEvent.setup();
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify({ success: false, error: "Invalid username or password" }), {
				status: 401,
			}),
		);

		const { LoginForm } = await import("@/components/login-form");
		render(<LoginForm />);

		await user.type(screen.getByLabelText(/username or email/i), "jsmith");
		await user.type(screen.getByLabelText(/^password$/i), "wrongpassword");
		await user.click(screen.getByRole("button", { name: /^login$/i }));

		expect(await screen.findByRole("alert")).toHaveTextContent(/invalid username or password/i);
	});

	it("redirects to /mcqs on success", async () => {
		const user = userEvent.setup();
		vi.mocked(fetch).mockResolvedValue(
			new Response(
				JSON.stringify({
					success: true,
					user: {
						id: "1",
						firstName: "Jane",
						lastName: "Smith",
						username: "jsmith",
						email: "jsmith@school.edu",
					},
				}),
				{ status: 200 },
			),
		);

		const { LoginForm } = await import("@/components/login-form");
		render(<LoginForm />);

		await user.type(screen.getByLabelText(/username or email/i), "jsmith");
		await user.type(screen.getByLabelText(/^password$/i), "password123");
		await user.click(screen.getByRole("button", { name: /^login$/i }));

		await waitFor(() => {
			expect(push).toHaveBeenCalledWith("/mcqs");
		});
	});
});
