"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { McqForm, type McqFormMcq } from "@/components/mcq-form";
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

export default function EditMcqPage() {
	const router = useRouter();
	const params = useParams<{ id: string }>();
	const mcqId = params.id;

	const [mcq, setMcq] = useState<McqFormMcq | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [notFound, setNotFound] = useState(false);

	useEffect(() => {
		if (!hasStoredUser()) {
			router.push("/login");
			return;
		}

		let active = true;

		async function loadMcq() {
			setIsLoading(true);
			setNotFound(false);

			try {
				const response = await fetch(`/api/mcqs/${mcqId}`);
				const data = (await response.json()) as {
					success?: boolean;
					mcq?: McqFormMcq;
				};

				if (!active) {
					return;
				}

				if (!response.ok || !data.success || !data.mcq) {
					setNotFound(true);
					setMcq(null);
					return;
				}

				setMcq(data.mcq);
			} catch {
				if (!active) {
					return;
				}

				setNotFound(true);
				setMcq(null);
			} finally {
				if (active) {
					setIsLoading(false);
				}
			}
		}

		void loadMcq();

		return () => {
			active = false;
		};
	}, [mcqId, router]);

	if (!hasStoredUser()) {
		return null;
	}

	if (isLoading) {
		return (
			<div className="flex min-h-svh w-full justify-center p-6 md:p-10">
				<p className="text-sm text-muted-foreground">Loading question…</p>
			</div>
		);
	}

	if (notFound || !mcq) {
		return (
			<div className="flex min-h-svh w-full justify-center p-6 md:p-10">
				<div className="w-full max-w-3xl space-y-4 text-center">
					<h1 className="text-2xl font-semibold">Question not found</h1>
					<p className="text-sm text-muted-foreground">
						This question may have been deleted or the link is incorrect.
					</p>
					<Link href="/mcqs" className={cn(buttonVariants())}>
						Back to questions
					</Link>
				</div>
			</div>
		);
	}

	return (
		<div className="flex min-h-svh w-full justify-center p-6 md:p-10">
			<div className="w-full max-w-3xl">
				<Card>
					<CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
						<div className="space-y-1">
							<CardTitle>Edit question</CardTitle>
							<CardDescription>Update the question text and answer choices.</CardDescription>
						</div>
						<Link href="/mcqs" className={cn(buttonVariants({ variant: "outline" }))}>
							Back to questions
						</Link>
					</CardHeader>
					<CardContent>
						<McqForm mode="edit" mcqId={mcqId} initialMcq={mcq} />
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
