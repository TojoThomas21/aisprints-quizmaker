"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { McqTable } from "@/components/mcq-table";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

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
		<div className="flex min-h-svh w-full justify-center p-6 md:p-10">
			<div className="w-full max-w-5xl">
				<Card>
					<CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
						<div className="space-y-1">
							<CardTitle>Multiple choice questions </CardTitle>
						</div>
						<div className="flex flex-wrap gap-2">
							<Link href="/mcqs/new" className={cn(buttonVariants())}>
								Create question
							</Link>
							<Button variant="outline" onClick={() => void handleLogout()}>
								Logout
							</Button>
						</div>
					</CardHeader>
					<CardContent>
						<McqTable />
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
