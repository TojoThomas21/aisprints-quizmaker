import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();

vi.mock("next/navigation", () => ({
	useRouter: () => ({ push }),
}));

describe("/register SignupForm", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal("fetch", vi.fn());
	});

	it("renders all registration fields", async () => {
		const { SignupForm } = await import("@/components/signup-form");
		render(<SignupForm />);

		expect(screen.getByLabelText(/first name/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/last name/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/^email$/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/^password$/i)).toBeInTheDocument();
		expect(screen.getByLabelText(/confirm password/i)).toBeInTheDocument();
	});

	it("submits POST with hashed password, not plaintext", async () => {
		const user = userEvent.setup();
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify({ success: true, user: { id: "1", firstName: "Jane" } }), {
				status: 201,
			}),
		);

		const { SignupForm } = await import("@/components/signup-form");
		render(<SignupForm />);

		await user.type(screen.getByLabelText(/first name/i), "Jane");
		await user.type(screen.getByLabelText(/last name/i), "Smith");
		await user.type(screen.getByLabelText(/username/i), "jsmith");
		await user.type(screen.getByLabelText(/^email$/i), "jsmith@school.edu");
		await user.type(screen.getByLabelText(/^password$/i), "password123");
		await user.type(screen.getByLabelText(/confirm password/i), "password123");
		await user.click(screen.getByRole("button", { name: /create account/i }));

		await waitFor(() => {
			expect(fetch).toHaveBeenCalled();
		});

		const [, options] = vi.mocked(fetch).mock.calls[0];
		const body = JSON.parse(String(options?.body));

		expect(body.passwordHash).toMatch(/^[a-f0-9]{64}$/);
		expect(body.passwordHash).not.toBe("password123");
		expect(body).not.toHaveProperty("password");
	});

	it("shows error on API failure", async () => {
		const user = userEvent.setup();
		vi.mocked(fetch).mockResolvedValue(
			new Response(JSON.stringify({ success: false, error: "Username already taken" }), {
				status: 409,
			}),
		);

		const { SignupForm } = await import("@/components/signup-form");
		render(<SignupForm />);

		await user.type(screen.getByLabelText(/first name/i), "Jane");
		await user.type(screen.getByLabelText(/last name/i), "Smith");
		await user.type(screen.getByLabelText(/username/i), "jsmith");
		await user.type(screen.getByLabelText(/^email$/i), "jsmith@school.edu");
		await user.type(screen.getByLabelText(/^password$/i), "password123");
		await user.type(screen.getByLabelText(/confirm password/i), "password123");
		await user.click(screen.getByRole("button", { name: /create account/i }));

		expect(await screen.findByRole("alert")).toHaveTextContent(/username already taken/i);
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
				{ status: 201 },
			),
		);

		const { SignupForm } = await import("@/components/signup-form");
		render(<SignupForm />);

		await user.type(screen.getByLabelText(/first name/i), "Jane");
		await user.type(screen.getByLabelText(/last name/i), "Smith");
		await user.type(screen.getByLabelText(/username/i), "jsmith");
		await user.type(screen.getByLabelText(/^email$/i), "jsmith@school.edu");
		await user.type(screen.getByLabelText(/^password$/i), "password123");
		await user.type(screen.getByLabelText(/confirm password/i), "password123");
		await user.click(screen.getByRole("button", { name: /create account/i }));

		await waitFor(() => {
			expect(push).toHaveBeenCalledWith("/mcqs");
		});
	});
});
