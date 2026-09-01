import { z } from "zod";

import { formatValidationDetails } from "@/lib/validations/auth";

export { formatValidationDetails };

const choiceSchema = z.object({
	choiceText: z.string().trim().min(1).max(500),
	isCorrect: z.boolean(),
});

const updateChoiceSchema = choiceSchema.extend({
	id: z.string().trim().min(1).optional(),
});

function validateChoiceRules(choices: Array<{ isCorrect: boolean }>, ctx: z.RefinementCtx): void {
	if (choices.length < 2 || choices.length > 6) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: "A question must have between 2 and 6 choices",
			path: ["choices"],
		});
	}

	const correctCount = choices.filter((choice) => choice.isCorrect).length;
	if (correctCount !== 1) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message: "Exactly one choice must be marked as correct",
			path: ["choices"],
		});
	}
}

export const createMcqSchema = z
	.object({
		userId: z.string().trim().min(1),
		name: z.string().trim().min(1).max(200),
		question: z.string().trim().min(1).max(1000),
		choices: z.array(choiceSchema),
	})
	.superRefine((data, ctx) => validateChoiceRules(data.choices, ctx));

export const updateMcqSchema = z
	.object({
		name: z.string().trim().min(1).max(200),
		question: z.string().trim().min(1).max(1000),
		choices: z.array(updateChoiceSchema),
	})
	.superRefine((data, ctx) => validateChoiceRules(data.choices, ctx));

export const createAttemptSchema = z.object({
	userId: z.string().trim().min(1),
	choiceId: z.string().trim().min(1),
});

export type CreateMcqInput = z.infer<typeof createMcqSchema>;
export type UpdateMcqInput = z.infer<typeof updateMcqSchema>;
export type CreateAttemptInput = z.infer<typeof createAttemptSchema>;
