"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { hashPasswordClient } from "@/lib/password-client";

export function SignupForm({ ...props }: React.ComponentProps<typeof Card>) {
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);
		setIsSubmitting(true);

		const formData = new FormData(event.currentTarget);
		const firstName = String(formData.get("firstName") ?? "").trim();
		const lastName = String(formData.get("lastName") ?? "").trim();
		const username = String(formData.get("username") ?? "").trim();
		const email = String(formData.get("email") ?? "").trim();
		const password = String(formData.get("password") ?? "");
		const confirmPassword = String(formData.get("confirmPassword") ?? "");

		if (password.length < 8) {
			setError("Password must be at least 8 characters long.");
			setIsSubmitting(false);
			return;
		}

		if (password !== confirmPassword) {
			setError("Passwords do not match.");
			setIsSubmitting(false);
			return;
		}

		if (!/^[a-zA-Z0-9_]+$/.test(username)) {
			setError("Username may only contain letters, numbers, and underscores.");
			setIsSubmitting(false);
			return;
		}

		try {
			const passwordHash = await hashPasswordClient(password);
			const response = await fetch("/api/auth/register", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					firstName,
					lastName,
					username,
					email,
					passwordHash,
				}),
			});

			const data = (await response.json()) as {
				success?: boolean;
				error?: string;
				user?: { firstName: string };
			};

			if (!response.ok || !data.success) {
				setError(data.error ?? "Registration failed.");
				return;
			}

			if (data.user) {
				sessionStorage.setItem("quizmaker.user", JSON.stringify(data.user));
			}

			router.push("/mcqs");
		} catch {
			setError("Something went wrong. Please try again.");
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<Card {...props}>
			<CardHeader>
				<CardTitle>Create an account</CardTitle>
				<CardDescription>Enter your information below to create your account</CardDescription>
			</CardHeader>
			<CardContent>
				<form onSubmit={handleSubmit}>
					<FieldGroup>
						<Field>
							<FieldLabel htmlFor="firstName">First name</FieldLabel>
							<Input id="firstName" name="firstName" type="text" placeholder="Jane" required />
						</Field>
						<Field>
							<FieldLabel htmlFor="lastName">Last name</FieldLabel>
							<Input id="lastName" name="lastName" type="text" placeholder="Smith" required />
						</Field>
						<Field>
							<FieldLabel htmlFor="username">Username</FieldLabel>
							<Input id="username" name="username" type="text" placeholder="jsmith" required />
						</Field>
						<Field>
							<FieldLabel htmlFor="email">Email</FieldLabel>
							<Input id="email" name="email" type="email" placeholder="m@example.com" required />
							<FieldDescription>
								We&apos;ll use this to contact you. We will not share your email with anyone else.
							</FieldDescription>
						</Field>
						<Field>
							<FieldLabel htmlFor="password">Password</FieldLabel>
							<Input id="password" name="password" type="password" required />
							<FieldDescription>Must be at least 8 characters long.</FieldDescription>
						</Field>
						<Field>
							<FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
							<Input id="confirmPassword" name="confirmPassword" type="password" required />
							<FieldDescription>Please confirm your password.</FieldDescription>
						</Field>
						{error ? <FieldError>{error}</FieldError> : null}
						<Field>
							<Button type="submit" disabled={isSubmitting}>
								Create Account
							</Button>
							<FieldDescription className="px-6 text-center">
								Already have an account?{" "}
								<Link href="/login" className="underline underline-offset-4">
									Sign in
								</Link>
							</FieldDescription>
						</Field>
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	);
}
