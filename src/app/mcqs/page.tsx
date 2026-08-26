"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type StoredUser = {
	firstName?: string;
};

function readStoredFirstName(): string | null {
	if (typeof window === "undefined") {
		return null;
	}

	try {
		const stored = sessionStorage.getItem("quizmaker.user");
		if (!stored) {
			return null;
		}

		const user = JSON.parse(stored) as StoredUser;
		return user.firstName ?? null;
	} catch {
		return null;
	}
}

export default function McqsPage() {
	const router = useRouter();
	const [firstName] = useState(readStoredFirstName);

	async function handleLogout() {
		await fetch("/api/auth/logout", { method: "POST" });
		sessionStorage.removeItem("quizmaker.user");
		router.push("/login");
	}

	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="w-full max-w-lg">
				<Card>
					<CardHeader>
						<CardTitle>MCQ Question Bank</CardTitle>
						<CardDescription>
							{firstName ? `Welcome, ${firstName}. ` : null}
							Question bank features coming soon.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col gap-4">
						<p className="text-sm text-muted-foreground">
							This is a placeholder for the collaborative multiple-choice question bank. MCQ creation
							and editing will be added in a future sprint.
						</p>
						<div className="flex gap-3">
							<Button onClick={handleLogout}>Logout</Button>
							<Link href="/" className={buttonVariants({ variant: "outline" })}>
								Home
							</Link>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
