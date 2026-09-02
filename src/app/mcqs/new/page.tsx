"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { McqForm } from "@/components/mcq-form";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StoredUser = {
	id?: string;
};

function hasStoredUser(): boolean {
	if (typeof window === "undefined") {
		return false;
	}

	try {
		const stored = sessionStorage.getItem("quizmaker.user");
		if (!stored) {
			return false;
		}

		const user = JSON.parse(stored) as StoredUser;
		return Boolean(user.id);
	} catch {
		return false;
	}
}

export default function NewMcqPage() {
	const router = useRouter();

	useEffect(() => {
		if (!hasStoredUser()) {
			router.push("/login");
		}
	}, [router]);

	if (!hasStoredUser()) {
		return null;
	}

	return (
		<div className="flex min-h-svh w-full justify-center p-6 md:p-10">
			<div className="w-full max-w-3xl">
				<Card>
					<CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
						<div className="space-y-1">
							<CardTitle>Create question</CardTitle>
							<CardDescription>Add a new multiple-choice question to your bank.</CardDescription>
						</div>
						<Link href="/mcqs" className={cn(buttonVariants({ variant: "outline" }))}>
							Back to questions
						</Link>
					</CardHeader>
					<CardContent>
						<McqForm mode="create" />
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
