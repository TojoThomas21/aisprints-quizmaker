"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldError } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

type McqChoice = {
	id: string;
	choiceText: string;
	isCorrect: boolean;
	position: number;
};

type PreviewMcq = {
	id: string;
	name: string;
	question: string;
	choices: McqChoice[];
};

type AttemptResult = {
	isCorrect: boolean;
	selectedChoiceText: string;
};

type StoredUser = {
	id: string;
};

function readStoredUserId(): string | null {
	if (typeof window === "undefined") {
		return null;
	}

	try {
		const stored = sessionStorage.getItem("quizmaker.user");
		if (!stored) {
			return null;
		}

		const user = JSON.parse(stored) as StoredUser;
		return user.id ?? null;
	} catch {
		return null;
	}
}

export default function PreviewMcqPage() {
	const router = useRouter();
	const params = useParams<{ id: string }>();
	const mcqId = params.id;

	const [mcq, setMcq] = useState<PreviewMcq | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [notFound, setNotFound] = useState(false);
	const [selectedChoiceId, setSelectedChoiceId] = useState("");
	const [result, setResult] = useState<AttemptResult | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const orderedChoices = useMemo(
		() => (mcq ? [...mcq.choices].sort((a, b) => a.position - b.position) : []),
		[mcq],
	);

	useEffect(() => {
		const userId = readStoredUserId();
		if (!userId) {
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
					mcq?: PreviewMcq;
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

	async function handleSubmit() {
		if (!selectedChoiceId || result) {
			return;
		}

		const userId = readStoredUserId();
		if (!userId) {
			router.push("/login");
			return;
		}

		setError(null);
		setIsSubmitting(true);

		try {
			const response = await fetch(`/api/mcqs/${mcqId}/attempts`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ userId, choiceId: selectedChoiceId }),
			});

			const data = (await response.json()) as {
				success?: boolean;
				error?: string;
				attempt?: {
					isCorrect: boolean;
					selectedChoiceText: string;
				};
			};

			if (!response.ok || !data.success || !data.attempt) {
				setError(data.error ?? "Could not record attempt.");
				return;
			}

			setResult({
				isCorrect: data.attempt.isCorrect,
				selectedChoiceText: data.attempt.selectedChoiceText,
			});
		} catch {
			setError("Could not record attempt.");
		} finally {
			setIsSubmitting(false);
		}
	}

	function handleTryAgain() {
		setResult(null);
		setSelectedChoiceId("");
		setError(null);
	}

	if (!readStoredUserId()) {
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
							<CardTitle>{mcq.name}</CardTitle>
							<CardDescription>Preview how this question appears to someone answering it.</CardDescription>
						</div>
						<Link href="/mcqs" className={cn(buttonVariants({ variant: "outline" }))}>
							Back to questions
						</Link>
					</CardHeader>
					<CardContent className="space-y-6">
						<p className="text-base">{mcq.question}</p>

						<RadioGroup
							value={selectedChoiceId}
							onValueChange={setSelectedChoiceId}
							disabled={result !== null || isSubmitting}
						>
							<div className="space-y-3">
								{orderedChoices.map((choice) => (
									<div key={choice.id} className="flex items-center gap-3">
										<RadioGroupItem
											value={choice.id}
											id={`preview-choice-${choice.id}`}
											aria-label={choice.choiceText}
										/>
										<Label htmlFor={`preview-choice-${choice.id}`}>{choice.choiceText}</Label>
									</div>
								))}
							</div>
						</RadioGroup>

						{error ? <FieldError role="alert">{error}</FieldError> : null}

						{result ? (
							<div className="space-y-4">
								{result.isCorrect ? (
									<p className="rounded-lg border border-green-600/30 bg-green-600/10 p-4 text-sm text-green-700 dark:text-green-400">
										Correct
									</p>
								) : (
									<p className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
										Incorrect
									</p>
								)}
								<Button type="button" variant="outline" onClick={handleTryAgain}>
									Try again
								</Button>
							</div>
						) : (
							<Button
								type="button"
								onClick={() => void handleSubmit()}
								disabled={!selectedChoiceId || isSubmitting}
							>
								Submit answer
							</Button>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
