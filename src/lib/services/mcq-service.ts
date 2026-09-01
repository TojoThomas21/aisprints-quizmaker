import { getDatabase } from "@/lib/db";

export class McqNotFoundError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "McqNotFoundError";
	}
}

export class McqValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "McqValidationError";
	}
}

export type McqListItem = {
	id: string;
	userId: string;
	name: string;
	question: string;
	choiceCount: number;
	createdAt: string;
	updatedAt: string;
};

export type McqChoice = {
	id: string;
	choiceText: string;
	isCorrect: boolean;
	position: number;
};

export type Mcq = {
	id: string;
	userId: string;
	name: string;
	question: string;
	choices: McqChoice[];
	createdAt: string;
	updatedAt: string;
};

export type McqAttempt = {
	id: string;
	mcqId: string;
	userId: string;
	choiceId: string;
	selectedChoiceText: string;
	isCorrect: boolean;
	createdAt: string;
};

export type CreateMcqInput = {
	userId: string;
	name: string;
	question: string;
	choices: Array<{
		choiceText: string;
		isCorrect: boolean;
	}>;
};

export type UpdateMcqChoiceInput = {
	id?: string;
	choiceText: string;
	isCorrect: boolean;
};

export type UpdateMcqInput = {
	name: string;
	question: string;
	choices: UpdateMcqChoiceInput[];
};

export type CreateAttemptInput = {
	userId: string;
	choiceId: string;
};

type McqRow = {
	id: string;
	user_id: string;
	name: string;
	question: string;
	created_at: string;
	updated_at: string;
};

type McqListRow = McqRow & {
	choice_count: number;
};

type ChoiceRow = {
	id: string;
	mcq_id: string;
	choice_text: string;
	is_correct: number;
	position: number;
	created_at: string;
	updated_at: string;
};

type AttemptRow = {
	id: string;
	mcq_id: string;
	user_id: string;
	choice_id: string;
	selected_choice_text: string;
	is_correct: number;
	created_at: string;
};

function bufferToHex(buffer: Uint8Array): string {
	return Array.from(buffer)
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

function generateId(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	return bufferToHex(bytes);
}

function toMcqListItem(row: McqListRow): McqListItem {
	return {
		id: row.id,
		userId: row.user_id,
		name: row.name,
		question: row.question,
		choiceCount: row.choice_count,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function toMcq(row: McqRow, choices: McqChoice[]): Mcq {
	return {
		id: row.id,
		userId: row.user_id,
		name: row.name,
		question: row.question,
		choices,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function toChoice(row: ChoiceRow): McqChoice {
	return {
		id: row.id,
		choiceText: row.choice_text,
		isCorrect: row.is_correct === 1,
		position: row.position,
	};
}

function toAttempt(row: AttemptRow): McqAttempt {
	return {
		id: row.id,
		mcqId: row.mcq_id,
		userId: row.user_id,
		choiceId: row.choice_id,
		selectedChoiceText: row.selected_choice_text,
		isCorrect: row.is_correct === 1,
		createdAt: row.created_at,
	};
}

function validateChoices(choices: Array<{ isCorrect: boolean }>): void {
	if (choices.length < 2 || choices.length > 6) {
		throw new McqValidationError("A question must have between 2 and 6 choices");
	}

	const correctCount = choices.filter((choice) => choice.isCorrect).length;
	if (correctCount !== 1) {
		throw new McqValidationError("Exactly one choice must be marked as correct");
	}
}

async function getMcqRowById(id: string): Promise<McqRow | null> {
	const db = await getDatabase();
	const result = await db
		.prepare(
			"SELECT id, user_id, name, question, created_at, updated_at FROM mcqs WHERE id = ?1",
		)
		.bind(id)
		.all<McqRow>();

	return result.results[0] ?? null;
}

async function getChoiceRowById(id: string): Promise<ChoiceRow | null> {
	const db = await getDatabase();
	const result = await db
		.prepare(
			"SELECT id, mcq_id, choice_text, is_correct, position, created_at, updated_at FROM mcq_choices WHERE id = ?1",
		)
		.bind(id)
		.all<ChoiceRow>();

	return result.results[0] ?? null;
}

async function getChoiceRowsByMcqId(mcqId: string): Promise<ChoiceRow[]> {
	const db = await getDatabase();
	const result = await db
		.prepare(
			"SELECT id, mcq_id, choice_text, is_correct, position, created_at, updated_at FROM mcq_choices WHERE mcq_id = ?1 ORDER BY position ASC",
		)
		.bind(mcqId)
		.all<ChoiceRow>();

	return result.results;
}

async function getAttemptRowById(id: string): Promise<AttemptRow | null> {
	const db = await getDatabase();
	const result = await db
		.prepare(
			"SELECT id, mcq_id, user_id, choice_id, selected_choice_text, is_correct, created_at FROM mcq_attempts WHERE id = ?1",
		)
		.bind(id)
		.all<AttemptRow>();

	return result.results[0] ?? null;
}

export async function listMcqs(): Promise<McqListItem[]> {
	const db = await getDatabase();
	const result = await db
		.prepare(
			`SELECT m.id, m.user_id, m.name, m.question, m.created_at, m.updated_at,
        COUNT(c.id) AS choice_count
      FROM mcqs m
      LEFT JOIN mcq_choices c ON c.mcq_id = m.id
      GROUP BY m.id
      ORDER BY m.created_at DESC`,
		)
		.bind()
		.all<McqListRow>();

	return result.results.map(toMcqListItem);
}

export async function getMcqById(id: string): Promise<Mcq | null> {
	const row = await getMcqRowById(id);
	if (!row) {
		return null;
	}

	const choices = (await getChoiceRowsByMcqId(id)).map(toChoice).sort((a, b) => a.position - b.position);
	return toMcq(row, choices);
}

export async function createMcq(input: CreateMcqInput): Promise<Mcq> {
	validateChoices(input.choices);

	const db = await getDatabase();
	const mcqId = generateId();
	const statements = [
		db
			.prepare("INSERT INTO mcqs (id, user_id, name, question) VALUES (?1, ?2, ?3, ?4)")
			.bind(mcqId, input.userId, input.name, input.question),
	];

	for (let position = 0; position < input.choices.length; position += 1) {
		const choice = input.choices[position]!;
		statements.push(
			db
				.prepare(
					"INSERT INTO mcq_choices (id, mcq_id, choice_text, is_correct, position) VALUES (?1, ?2, ?3, ?4, ?5)",
				)
				.bind(
					generateId(),
					mcqId,
					choice.choiceText,
					choice.isCorrect ? 1 : 0,
					position,
				),
		);
	}

	await db.batch(statements);

	const created = await getMcqById(mcqId);
	if (!created) {
		throw new Error("Failed to create MCQ");
	}

	return created;
}

export async function updateMcq(id: string, input: UpdateMcqInput): Promise<Mcq> {
	validateChoices(input.choices);

	const current = await getMcqRowById(id);
	if (!current) {
		throw new McqNotFoundError("Question not found");
	}

	const db = await getDatabase();
	await db
		.prepare(
			"UPDATE mcqs SET name = ?1, question = ?2, updated_at = CURRENT_TIMESTAMP WHERE id = ?3",
		)
		.bind(input.name, input.question, id)
		.run();

	const existingChoices = await getChoiceRowsByMcqId(id);
	const incomingIds = new Set(
		input.choices.map((choice) => choice.id).filter((choiceId): choiceId is string => Boolean(choiceId)),
	);

	for (let position = 0; position < input.choices.length; position += 1) {
		const choice = input.choices[position]!;
		if (choice.id) {
			await db
				.prepare(
					"UPDATE mcq_choices SET choice_text = ?1, is_correct = ?2, position = ?3, updated_at = CURRENT_TIMESTAMP WHERE id = ?4 AND mcq_id = ?5",
				)
				.bind(choice.choiceText, choice.isCorrect ? 1 : 0, position, choice.id, id)
				.run();
			continue;
		}

		await db
			.prepare(
				"INSERT INTO mcq_choices (id, mcq_id, choice_text, is_correct, position) VALUES (?1, ?2, ?3, ?4, ?5)",
			)
			.bind(generateId(), id, choice.choiceText, choice.isCorrect ? 1 : 0, position)
			.run();
	}

	for (const existingChoice of existingChoices) {
		if (!incomingIds.has(existingChoice.id)) {
			await db.prepare("DELETE FROM mcq_choices WHERE id = ?1 AND mcq_id = ?2").bind(existingChoice.id, id).run();
		}
	}

	const updated = await getMcqById(id);
	if (!updated) {
		throw new Error("Failed to update MCQ");
	}

	return updated;
}

export async function deleteMcq(id: string): Promise<void> {
	const current = await getMcqRowById(id);
	if (!current) {
		throw new McqNotFoundError("Question not found");
	}

	const db = await getDatabase();
	await db.prepare("DELETE FROM mcqs WHERE id = ?1").bind(id).run();
}

export async function createAttempt(mcqId: string, input: CreateAttemptInput): Promise<McqAttempt> {
	const mcq = await getMcqRowById(mcqId);
	if (!mcq) {
		throw new McqNotFoundError("Question not found");
	}

	const choice = await getChoiceRowById(input.choiceId);
	if (!choice || choice.mcq_id !== mcqId) {
		throw new McqValidationError("Choice does not belong to this question");
	}

	const isCorrect = choice.is_correct === 1;
	const attemptId = generateId();
	const db = await getDatabase();

	await db
		.prepare(
			"INSERT INTO mcq_attempts (id, mcq_id, user_id, choice_id, selected_choice_text, is_correct) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
		)
		.bind(attemptId, mcqId, input.userId, input.choiceId, choice.choice_text, isCorrect ? 1 : 0)
		.run();

	const attempt = await getAttemptRowById(attemptId);
	if (!attempt) {
		throw new Error("Failed to create attempt");
	}

	return toAttempt(attempt);
}

export async function listAttemptsByMcq(mcqId: string): Promise<McqAttempt[]> {
	const mcq = await getMcqRowById(mcqId);
	if (!mcq) {
		throw new McqNotFoundError("Question not found");
	}

	const db = await getDatabase();
	const result = await db
		.prepare(
			"SELECT id, mcq_id, user_id, choice_id, selected_choice_text, is_correct, created_at FROM mcq_attempts WHERE mcq_id = ?1 ORDER BY created_at DESC",
		)
		.bind(mcqId)
		.all<AttemptRow>();

	return result.results.map(toAttempt);
}
