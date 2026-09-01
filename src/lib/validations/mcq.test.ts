import { describe, expect, it } from "vitest";

const validCreateBody = {
	userId: "user-1",
	name: "Photosynthesis inputs",
	question: "Which two substances does a plant consume during photosynthesis?",
	choices: [
		{ choiceText: "Carbon dioxide and water", isCorrect: true },
		{ choiceText: "Oxygen and glucose", isCorrect: false },
	],
};

const validUpdateBody = {
	name: "Photosynthesis inputs",
	question: "Which two substances does a plant consume during photosynthesis?",
	choices: [
		{ id: "choice-1", choiceText: "Carbon dioxide and water", isCorrect: true },
		{ choiceText: "Oxygen and glucose", isCorrect: false },
	],
};

describe("createMcqSchema", () => {
	it("rejects a missing or blank name", async () => {
		const { createMcqSchema } = await import("@/lib/validations/mcq");
		const result = createMcqSchema.safeParse({ ...validCreateBody, name: "" });

		expect(result.success).toBe(false);
	});

	it("rejects a name over 200 characters", async () => {
		const { createMcqSchema } = await import("@/lib/validations/mcq");
		const result = createMcqSchema.safeParse({
			...validCreateBody,
			name: "a".repeat(201),
		});

		expect(result.success).toBe(false);
	});

	it("rejects fewer than 2 choices", async () => {
		const { createMcqSchema } = await import("@/lib/validations/mcq");
		const result = createMcqSchema.safeParse({
			...validCreateBody,
			choices: [{ choiceText: "Only one", isCorrect: true }],
		});

		expect(result.success).toBe(false);
	});

	it("rejects more than 6 choices", async () => {
		const { createMcqSchema } = await import("@/lib/validations/mcq");
		const result = createMcqSchema.safeParse({
			...validCreateBody,
			choices: Array.from({ length: 7 }, (_, index) => ({
				choiceText: `Choice ${index + 1}`,
				isCorrect: index === 0,
			})),
		});

		expect(result.success).toBe(false);
	});

	it("rejects zero correct choices", async () => {
		const { createMcqSchema } = await import("@/lib/validations/mcq");
		const result = createMcqSchema.safeParse({
			...validCreateBody,
			choices: [
				{ choiceText: "A", isCorrect: false },
				{ choiceText: "B", isCorrect: false },
			],
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues.some((issue) => issue.message.includes("correct"))).toBe(true);
		}
	});

	it("rejects more than one correct choice", async () => {
		const { createMcqSchema } = await import("@/lib/validations/mcq");
		const result = createMcqSchema.safeParse({
			...validCreateBody,
			choices: [
				{ choiceText: "A", isCorrect: true },
				{ choiceText: "B", isCorrect: true },
			],
		});

		expect(result.success).toBe(false);
	});

	it("rejects blank choice text", async () => {
		const { createMcqSchema } = await import("@/lib/validations/mcq");
		const result = createMcqSchema.safeParse({
			...validCreateBody,
			choices: [
				{ choiceText: "", isCorrect: true },
				{ choiceText: "B", isCorrect: false },
			],
		});

		expect(result.success).toBe(false);
	});

	it("rejects a missing or blank question", async () => {
		const { createMcqSchema } = await import("@/lib/validations/mcq");
		const result = createMcqSchema.safeParse({ ...validCreateBody, question: "" });

		expect(result.success).toBe(false);
	});

	it("rejects a question over 1000 characters", async () => {
		const { createMcqSchema } = await import("@/lib/validations/mcq");
		const result = createMcqSchema.safeParse({
			...validCreateBody,
			question: "a".repeat(1001),
		});

		expect(result.success).toBe(false);
	});

	it("accepts a valid payload", async () => {
		const { createMcqSchema } = await import("@/lib/validations/mcq");
		const result = createMcqSchema.safeParse(validCreateBody);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.name).toBe(validCreateBody.name);
		}
	});
});

describe("updateMcqSchema", () => {
	it("accepts choices with and without ids", async () => {
		const { updateMcqSchema } = await import("@/lib/validations/mcq");
		const result = updateMcqSchema.safeParse(validUpdateBody);

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.choices[0]?.id).toBe("choice-1");
			expect(result.data.choices[1]?.id).toBeUndefined();
		}
	});
});

describe("createAttemptSchema", () => {
	it("rejects a missing userId or choiceId", async () => {
		const { createAttemptSchema } = await import("@/lib/validations/mcq");
		const result = createAttemptSchema.safeParse({ userId: "", choiceId: "" });

		expect(result.success).toBe(false);
	});
});
