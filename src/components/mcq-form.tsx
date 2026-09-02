"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";

type ChoiceFormValue = {
	id?: string;
	choiceText: string;
	isCorrect: boolean;
};

export type McqFormMcq = {
	id: string;
	name: string;
	question: string;
	choices: ChoiceFormValue[];
};

type McqFormProps =
	| {
			mode: "create";
			mcqId?: undefined;
			initialMcq?: undefined;
	  }
	| {
			mode: "edit";
			mcqId: string;
			initialMcq: McqFormMcq;
	  };

type StoredUser = {
	id: string;
};

function createBlankChoices(count = 2): ChoiceFormValue[] {
	return Array.from({ length: count }, () => ({
		choiceText: "",
		isCorrect: false,
	}));
}

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

function validateForm(
	name: string,
	question: string,
	choices: ChoiceFormValue[],
): string | null {
	if (!name.trim()) {
		return "Name is required.";
	}

	if (!question.trim()) {
		return "Question is required.";
	}

	if (choices.length < 2 || choices.length > 6) {
		return "A question must have between 2 and 6 choices.";
	}

	if (choices.some((choice) => !choice.choiceText.trim())) {
		return "Every choice must have text.";
	}

	const correctCount = choices.filter((choice) => choice.isCorrect).length;
	if (correctCount !== 1) {
		return "Exactly one choice must be marked as correct.";
	}

	return null;
}

export function McqForm(props: McqFormProps) {
	const router = useRouter();
	const initialChoices = useMemo(
		() =>
			props.mode === "edit"
				? props.initialMcq.choices.map((choice) => ({ ...choice }))
				: createBlankChoices(),
		[props],
	);

	const [name, setName] = useState(props.mode === "edit" ? props.initialMcq.name : "");
	const [question, setQuestion] = useState(props.mode === "edit" ? props.initialMcq.question : "");
	const [choices, setChoices] = useState<ChoiceFormValue[]>(initialChoices);
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const correctChoiceIndex = choices.findIndex((choice) => choice.isCorrect);
	const correctChoiceValue = correctChoiceIndex >= 0 ? String(correctChoiceIndex) : "";

	function handleCorrectChoiceChange(value: string) {
		const index = Number(value);
		setChoices((current) =>
			current.map((choice, choiceIndex) => ({
				...choice,
				isCorrect: choiceIndex === index,
			})),
		);
	}

	function handleChoiceTextChange(index: number, value: string) {
		setChoices((current) =>
			current.map((choice, choiceIndex) =>
				choiceIndex === index ? { ...choice, choiceText: value } : choice,
			),
		);
	}

	function handleAddChoice() {
		if (choices.length >= 6) {
			return;
		}

		setChoices((current) => [...current, { choiceText: "", isCorrect: false }]);
	}

	function handleRemoveChoice(index: number) {
		if (choices.length <= 2) {
			return;
		}

		setChoices((current) => {
			const next = current.filter((_, choiceIndex) => choiceIndex !== index);
			const hadCorrectRemoved = current[index]?.isCorrect;
			if (hadCorrectRemoved) {
				return next.map((choice) => ({ ...choice, isCorrect: false }));
			}

			return next;
		});
	}

	async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(null);

		const validationError = validateForm(name, question, choices);
		if (validationError) {
			setError(validationError);
			return;
		}

		setIsSubmitting(true);

		try {
			if (props.mode === "create") {
				const userId = readStoredUserId();
				if (!userId) {
					router.push("/login");
					return;
				}

				const response = await fetch("/api/mcqs", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						userId,
						name: name.trim(),
						question: question.trim(),
						choices: choices.map((choice) => ({
							choiceText: choice.choiceText.trim(),
							isCorrect: choice.isCorrect,
						})),
					}),
				});

				const data = (await response.json()) as { success?: boolean; error?: string };
				if (!response.ok || !data.success) {
					setError(data.error ?? "Could not save question.");
					return;
				}
			} else {
				const response = await fetch(`/api/mcqs/${props.mcqId}`, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						name: name.trim(),
						question: question.trim(),
						choices: choices.map((choice) => ({
							...(choice.id ? { id: choice.id } : {}),
							choiceText: choice.choiceText.trim(),
							isCorrect: choice.isCorrect,
						})),
					}),
				});

				const data = (await response.json()) as { success?: boolean; error?: string };
				if (!response.ok || !data.success) {
					setError(data.error ?? "Could not save question.");
					return;
				}
			}

			router.push("/mcqs");
		} catch {
			setError("Could not save question.");
		} finally {
			setIsSubmitting(false);
		}
	}

	function handleCancel() {
		router.push("/mcqs");
	}

	return (
		<form onSubmit={(event) => void handleSubmit(event)}>
			<FieldGroup>
				<Field>
					<FieldLabel htmlFor="mcq-name">Name</FieldLabel>
					<Input
						id="mcq-name"
						value={name}
						onChange={(event) => setName(event.target.value)}
						maxLength={200}
					/>
				</Field>

				<Field>
					<FieldLabel htmlFor="mcq-question">Question</FieldLabel>
					<Textarea
						id="mcq-question"
						value={question}
						onChange={(event) => setQuestion(event.target.value)}
						maxLength={1000}
					/>
				</Field>

				<Field>
					<FieldLabel>Choices</FieldLabel>
					<RadioGroup value={correctChoiceValue} onValueChange={handleCorrectChoiceChange}>
						<div className="flex flex-col gap-3">
							{choices.map((choice, index) => (
								<div key={`choice-${index}`} className="flex items-start gap-3">
									<div className="flex items-center gap-2 pt-2">
										<RadioGroupItem
											value={String(index)}
											aria-label={`Mark choice ${index + 1} as correct`}
										/>
									</div>
									<div className="flex-1">
										<FieldLabel htmlFor={`mcq-choice-${index}`} className="sr-only">
											Choice {index + 1}
										</FieldLabel>
										<Input
											id={`mcq-choice-${index}`}
											value={choice.choiceText}
											onChange={(event) => handleChoiceTextChange(index, event.target.value)}
											maxLength={500}
											aria-label={`Choice ${index + 1}`}
										/>
									</div>
									<Button
										type="button"
										variant="outline"
										onClick={() => handleRemoveChoice(index)}
										disabled={choices.length <= 2}
										aria-label={`Remove choice ${index + 1}`}
									>
										Remove
									</Button>
								</div>
							))}
						</div>
					</RadioGroup>
					<Button
						type="button"
						variant="outline"
						className="mt-3"
						onClick={handleAddChoice}
						disabled={choices.length >= 6}
					>
						Add choice
					</Button>
				</Field>

				{error ? <FieldError role="alert">{error}</FieldError> : null}

				<div className="grid grid-cols-2 gap-2">
					<Button type="submit" disabled={isSubmitting} className="w-full">
						Save
					</Button>
					<Button
						type="button"
						variant="outline"
						onClick={handleCancel}
						disabled={isSubmitting}
						className="w-full"
					>
						Cancel
					</Button>
				</div>
			</FieldGroup>
		</form>
	);
}
