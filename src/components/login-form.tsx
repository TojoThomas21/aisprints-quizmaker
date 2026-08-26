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
import { cn } from "@/lib/utils";

export function LoginForm({ className, ...props }: React.ComponentProps<"div">) {
	const router = useRouter();
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);
		setIsSubmitting(true);

		const formData = new FormData(event.currentTarget);
		const username = String(formData.get("username") ?? "").trim();
		const password = String(formData.get("password") ?? "");

		if (!username || !password) {
			setError("Username and password are required.");
			setIsSubmitting(false);
			return;
		}

		try {
			const passwordHash = await hashPasswordClient(password);
			const response = await fetch("/api/auth/login", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ username, passwordHash }),
			});

			const data = (await response.json()) as {
				success?: boolean;
				error?: string;
				user?: { firstName: string };
			};

			if (!response.ok || !data.success) {
				setError(data.error ?? "Invalid username or password");
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
		<div className={cn("flex flex-col gap-6", className)} {...props}>
			<Card>
				<CardHeader>
					<CardTitle>Login to your account</CardTitle>
					<CardDescription>Enter your username or email below to login to your account</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={handleSubmit}>
						<FieldGroup>
							<Field>
								<FieldLabel htmlFor="username">Username or email</FieldLabel>
								<Input id="username" name="username" type="text" placeholder="jsmith or m@example.com" required />
							</Field>
							<Field>
								<FieldLabel htmlFor="password">Password</FieldLabel>
								<Input id="password" name="password" type="password" required />
							</Field>
							{error ? <FieldError>{error}</FieldError> : null}
							<Field>
								<Button type="submit" disabled={isSubmitting}>
									Login
								</Button>
								<FieldDescription className="text-center">
									Don&apos;t have an account?{" "}
									<Link href="/register" className="underline underline-offset-4">
										Sign up
									</Link>
								</FieldDescription>
							</Field>
						</FieldGroup>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
