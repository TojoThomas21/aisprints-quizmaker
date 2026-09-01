import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

type McqServiceModule = typeof import("@/lib/services/mcq-service");

type PrepareHandler = (sql: string) => {
	all?: () => Promise<{ results: unknown[] }>;
	run?: () => Promise<{ success: boolean }>;
};

type MockDb = {
	prepare: Mock<(sql: string) => { bind: MockDb["bind"] }>;
	bind: Mock<(...args: unknown[]) => { all: MockDb["all"]; run: MockDb["run"] }>;
	all: Mock<() => Promise<{ results: unknown[] }>>;
	run: Mock<() => Promise<{ success: boolean }>>;
	batch: Mock<() => Promise<unknown[]>>;
};

const mockGetDatabase = vi.fn();

vi.mock("@/lib/db", () => ({
	getDatabase: () => mockGetDatabase(),
}));

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

const sampleMcqRow: McqRow = {
	id: "mcq-1",
	user_id: "user-1",
	name: "Photosynthesis inputs",
	question: "Which two substances does a plant consume during photosynthesis?",
	created_at: "2026-09-01 12:00:00",
	updated_at: "2026-09-01 12:00:00",
};

const sampleChoiceRows: ChoiceRow[] = [
	{
		id: "choice-1",
		mcq_id: "mcq-1",
		choice_text: "Carbon dioxide and water",
		is_correct: 1,
		position: 0,
		created_at: "2026-09-01 12:00:00",
		updated_at: "2026-09-01 12:00:00",
	},
	{
		id: "choice-2",
		mcq_id: "mcq-1",
		choice_text: "Oxygen and glucose",
		is_correct: 0,
		position: 1,
		created_at: "2026-09-01 12:00:00",
		updated_at: "2026-09-01 12:00:00",
	},
];

const sampleAttemptRow: AttemptRow = {
	id: "attempt-1",
	mcq_id: "mcq-1",
	user_id: "user-1",
	choice_id: "choice-1",
	selected_choice_text: "Carbon dioxide and water",
	is_correct: 1,
	created_at: "2026-09-01 12:05:00",
};

function createMockDb(): MockDb {
	const all = vi.fn(async () => ({ results: [] as unknown[] }));
	const run = vi.fn(async () => ({ success: true }));
	const bind = vi.fn((..._args: unknown[]) => ({ all, run }));
	const prepare = vi.fn((_sql: string) => ({ bind }));
	const batch = vi.fn(async () => []);

	mockGetDatabase.mockResolvedValue({ prepare, batch });

	return { prepare, bind, all, run, batch };
}

async function loadMcqService(): Promise<McqServiceModule> {
	return import("@/lib/services/mcq-service");
}

function routePrepare(prepare: MockDb["prepare"], handlers: PrepareHandler[]) {
	let callIndex = 0;
	prepare.mockImplementation((sql: string) => {
		const handler = handlers[callIndex] ?? handlers[handlers.length - 1];
		callIndex += 1;
		const result = handler(sql);
		return {
			bind: vi.fn(() => ({
				all: result.all ?? (async () => ({ results: [] })),
				run: result.run ?? (async () => ({ success: true })),
			})),
		};
	});
}

describe("mcq-service", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.resetModules();
	});

	describe("listMcqs", () => {
		it("returns mapped questions with choiceCount", async () => {
			const db = createMockDb();
			const listRow: McqListRow = { ...sampleMcqRow, choice_count: 4 };
			db.all.mockResolvedValueOnce({ results: [listRow] });

			const { listMcqs } = await loadMcqService();
			const mcqs = await listMcqs();

			expect(mcqs).toEqual([
				{
					id: "mcq-1",
					userId: "user-1",
					name: "Photosynthesis inputs",
					question: "Which two substances does a plant consume during photosynthesis?",
					choiceCount: 4,
					createdAt: "2026-09-01 12:00:00",
					updatedAt: "2026-09-01 12:00:00",
				},
			]);
			expect(mcqs[0]).not.toHaveProperty("user_id");
			expect(mcqs[0]).not.toHaveProperty("choice_count");
		});

		it("returns an empty array for an empty bank", async () => {
			const db = createMockDb();
			db.all.mockResolvedValueOnce({ results: [] });

			const { listMcqs } = await loadMcqService();
			const mcqs = await listMcqs();

			expect(mcqs).toEqual([]);
		});
	});

	describe("getMcqById", () => {
		it("returns the question with choices ordered by position", async () => {
			const db = createMockDb();
			routePrepare(db.prepare, [
				() => ({ all: async () => ({ results: [sampleMcqRow] }) }),
				() => ({
					all: async () => ({
						results: [...sampleChoiceRows].sort((a, b) => b.position - a.position),
					}),
				}),
			]);

			const { getMcqById } = await loadMcqService();
			const mcq = await getMcqById("mcq-1");

			expect(mcq).toEqual({
				id: "mcq-1",
				userId: "user-1",
				name: "Photosynthesis inputs",
				question: "Which two substances does a plant consume during photosynthesis?",
				choices: [
					{
						id: "choice-1",
						choiceText: "Carbon dioxide and water",
						isCorrect: true,
						position: 0,
					},
					{
						id: "choice-2",
						choiceText: "Oxygen and glucose",
						isCorrect: false,
						position: 1,
					},
				],
				createdAt: "2026-09-01 12:00:00",
				updatedAt: "2026-09-01 12:00:00",
			});
			expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining("ORDER BY position ASC"));
		});

		it("returns null when not found", async () => {
			const db = createMockDb();
			db.all.mockResolvedValueOnce({ results: [] });

			const { getMcqById } = await loadMcqService();
			const mcq = await getMcqById("missing");

			expect(mcq).toBeNull();
		});
	});

	describe("createMcq", () => {
		const validInput = {
			userId: "user-1",
			name: "Photosynthesis inputs",
			question: "Which two substances does a plant consume during photosynthesis?",
			choices: [
				{ choiceText: "Carbon dioxide and water", isCorrect: true },
				{ choiceText: "Oxygen and glucose", isCorrect: false },
			],
		};

		it("inserts the question and every choice", async () => {
			const db = createMockDb();
			db.all
				.mockResolvedValueOnce({ results: [sampleMcqRow] })
				.mockResolvedValueOnce({ results: sampleChoiceRows });

			const { createMcq } = await loadMcqService();
			await createMcq(validInput);

			expect(db.batch).toHaveBeenCalled();
			const sqlCalls = db.prepare.mock.calls.map((call) => String(call[0]));
			expect(sqlCalls.some((sql) => sql.includes("INSERT INTO mcqs"))).toBe(true);
			expect(sqlCalls.filter((sql) => sql.includes("INSERT INTO mcq_choices"))).toHaveLength(2);

			const choiceBindCalls = db.bind.mock.calls.filter((call) => call[4] === 0 || call[4] === 1);
			expect(choiceBindCalls.map((call) => call[4])).toEqual([0, 1]);
		});

		it("returns the created question with choices", async () => {
			const db = createMockDb();
			db.all
				.mockResolvedValueOnce({ results: [sampleMcqRow] })
				.mockResolvedValueOnce({ results: sampleChoiceRows });

			const { createMcq } = await loadMcqService();
			const mcq = await createMcq(validInput);

			expect(mcq.choices).toHaveLength(2);
			expect(mcq.name).toBe(validInput.name);
			expect(mcq.question).toBe(validInput.question);
			expect(mcq.userId).toBe("user-1");
		});

		it("rejects fewer than 2 choices", async () => {
			createMockDb();

			const { createMcq, McqValidationError } = await loadMcqService();

			await expect(
				createMcq({
					...validInput,
					choices: [{ choiceText: "Only one", isCorrect: true }],
				}),
			).rejects.toThrow(McqValidationError);
		});

		it("rejects more than 6 choices", async () => {
			createMockDb();

			const { createMcq, McqValidationError } = await loadMcqService();

			await expect(
				createMcq({
					...validInput,
					choices: Array.from({ length: 7 }, (_, index) => ({
						choiceText: `Choice ${index + 1}`,
						isCorrect: index === 0,
					})),
				}),
			).rejects.toThrow(McqValidationError);
		});

		it("rejects zero correct choices", async () => {
			createMockDb();

			const { createMcq, McqValidationError } = await loadMcqService();

			await expect(
				createMcq({
					...validInput,
					choices: [
						{ choiceText: "A", isCorrect: false },
						{ choiceText: "B", isCorrect: false },
					],
				}),
			).rejects.toThrow(McqValidationError);
		});

		it("rejects multiple correct choices", async () => {
			createMockDb();

			const { createMcq, McqValidationError } = await loadMcqService();

			await expect(
				createMcq({
					...validInput,
					choices: [
						{ choiceText: "A", isCorrect: true },
						{ choiceText: "B", isCorrect: true },
					],
				}),
			).rejects.toThrow(McqValidationError);
		});
	});

	describe("updateMcq", () => {
		const updateInput = {
			name: "Updated name",
			question: "Updated question?",
			choices: [
				{ id: "choice-1", choiceText: "Updated correct", isCorrect: true },
				{ choiceText: "New choice", isCorrect: false },
			],
		};

		it("updates name, question, and updated_at", async () => {
			const db = createMockDb();
			const updateCalls: unknown[][] = [];

			routePrepare(db.prepare, [
				() => ({ all: async () => ({ results: [sampleMcqRow] }) }),
				() => ({
					run: async () => {
						return { success: true };
					},
				}),
				() => ({ all: async () => ({ results: sampleChoiceRows }) }),
				() => ({
					run: async () => {
						return { success: true };
					},
				}),
				() => ({
					run: async () => {
						return { success: true };
					},
				}),
				() => ({
					run: async () => {
						return { success: true };
					},
				}),
				() => ({ all: async () => ({ results: [{ ...sampleMcqRow, name: "Updated name", question: "Updated question?" }] }) }),
				() => ({ all: async () => ({ results: sampleChoiceRows }) }),
			]);

			db.prepare.mockImplementation((sql: string) => ({
				bind: vi.fn((...args: unknown[]) => {
					if (sql.includes("UPDATE mcqs")) {
						updateCalls.push(args);
					}
					return {
						all: async () => ({ results: [sampleMcqRow] }),
						run: async () => ({ success: true }),
					};
				}),
			}));

			const { updateMcq } = await loadMcqService();
			await updateMcq("mcq-1", updateInput);

			expect(updateCalls[0]).toEqual(["Updated name", "Updated question?", "mcq-1"]);
			expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining("UPDATE mcqs"));
		});

		it("updates existing choices, inserts new ones, and deletes removed ones", async () => {
			const db = createMockDb();
			const sqlCalls: string[] = [];
			let allCallCount = 0;

			db.all.mockImplementation(async () => {
				allCallCount += 1;
				if (allCallCount % 2 === 1) {
					return { results: [sampleMcqRow] };
				}
				return { results: sampleChoiceRows };
			});

			db.prepare.mockImplementation((sql: string) => {
				sqlCalls.push(sql);
				return {
					bind: vi.fn(() => ({
						all: db.all,
						run: db.run,
					})),
				};
			});

			const { updateMcq } = await loadMcqService();
			await updateMcq("mcq-1", updateInput);

			expect(sqlCalls.some((sql) => sql.includes("UPDATE mcq_choices"))).toBe(true);
			expect(sqlCalls.some((sql) => sql.includes("INSERT INTO mcq_choices"))).toBe(true);
			expect(sqlCalls.some((sql) => sql.includes("DELETE FROM mcq_choices"))).toBe(true);
		});

		it("preserves the original user_id", async () => {
			const db = createMockDb();
			const updateSqlCalls: string[] = [];

			db.prepare.mockImplementation((sql: string) => ({
				bind: vi.fn(() => {
					if (sql.includes("UPDATE mcqs")) {
						updateSqlCalls.push(sql);
					}
					return {
						all: async () => ({ results: [sampleMcqRow] }),
						run: async () => ({ success: true }),
					};
				}),
			}));

			const { updateMcq } = await loadMcqService();
			await updateMcq("mcq-1", updateInput);

			for (const sql of updateSqlCalls) {
				expect(sql).not.toContain("user_id");
			}
		});

		it("throws McqNotFoundError for an unknown id", async () => {
			const db = createMockDb();
			db.all.mockResolvedValueOnce({ results: [] });

			const { updateMcq, McqNotFoundError } = await loadMcqService();

			await expect(updateMcq("missing", updateInput)).rejects.toThrow(McqNotFoundError);
		});
	});

	describe("deleteMcq", () => {
		it("deletes the question row", async () => {
			const db = createMockDb();
			db.all.mockResolvedValueOnce({ results: [sampleMcqRow] });

			const { deleteMcq } = await loadMcqService();
			await deleteMcq("mcq-1");

			expect(db.prepare).toHaveBeenCalledWith("DELETE FROM mcqs WHERE id = ?1");
			expect(db.run).toHaveBeenCalled();
		});

		it("throws McqNotFoundError for an unknown id", async () => {
			const db = createMockDb();
			db.all.mockResolvedValueOnce({ results: [] });

			const { deleteMcq, McqNotFoundError } = await loadMcqService();

			await expect(deleteMcq("missing")).rejects.toThrow(McqNotFoundError);
		});
	});

	describe("createAttempt", () => {
		it("derives is_correct from the stored choice", async () => {
			const db = createMockDb();
			const insertArgs: unknown[][] = [];

			db.prepare.mockImplementation((sql: string) => ({
				bind: vi.fn((...args: unknown[]) => {
					if (sql.includes("INSERT INTO mcq_attempts")) {
						insertArgs.push(args);
					}
					return {
						all: vi.fn(async () => {
							if (sql.includes("FROM mcqs")) {
								return { results: [sampleMcqRow] };
							}
							if (sql.includes("FROM mcq_choices")) {
								return { results: [sampleChoiceRows[0]!] };
							}
							if (sql.includes("FROM mcq_attempts")) {
								return { results: [sampleAttemptRow] };
							}
							return { results: [] };
						}),
						run: db.run,
					};
				}),
			}));

			const { createAttempt } = await loadMcqService();
			const attempt = await createAttempt("mcq-1", { userId: "user-1", choiceId: "choice-1" });

			expect(attempt.isCorrect).toBe(true);
			expect(insertArgs[0]?.[5]).toBe(1);
		});

		it("snapshots selected_choice_text", async () => {
			const db = createMockDb();
			const insertArgs: unknown[][] = [];

			db.prepare.mockImplementation((sql: string) => ({
				bind: vi.fn((...args: unknown[]) => {
					if (sql.includes("INSERT INTO mcq_attempts")) {
						insertArgs.push(args);
					}
					return {
						all: vi.fn(async () => {
							if (sql.includes("FROM mcqs")) {
								return { results: [sampleMcqRow] };
							}
							if (sql.includes("FROM mcq_choices")) {
								return { results: [sampleChoiceRows[0]!] };
							}
							if (sql.includes("FROM mcq_attempts")) {
								return { results: [sampleAttemptRow] };
							}
							return { results: [] };
						}),
						run: db.run,
					};
				}),
			}));

			const { createAttempt } = await loadMcqService();
			const attempt = await createAttempt("mcq-1", { userId: "user-1", choiceId: "choice-1" });

			expect(attempt.selectedChoiceText).toBe("Carbon dioxide and water");
			expect(insertArgs[0]?.[4]).toBe("Carbon dioxide and water");
		});

		it("rejects a choice from a different question", async () => {
			const db = createMockDb();
			routePrepare(db.prepare, [
				() => ({ all: async () => ({ results: [sampleMcqRow] }) }),
				() => ({
					all: async () => ({
						results: [{ ...sampleChoiceRows[0]!, mcq_id: "other-mcq" }],
					}),
				}),
			]);

			const { createAttempt, McqValidationError } = await loadMcqService();

			await expect(
				createAttempt("mcq-1", { userId: "user-1", choiceId: "choice-1" }),
			).rejects.toThrow(McqValidationError);
		});

		it("throws McqNotFoundError for an unknown question", async () => {
			const db = createMockDb();
			db.all.mockResolvedValueOnce({ results: [] });

			const { createAttempt, McqNotFoundError } = await loadMcqService();

			await expect(
				createAttempt("missing", { userId: "user-1", choiceId: "choice-1" }),
			).rejects.toThrow(McqNotFoundError);
		});
	});

	describe("listAttemptsByMcq", () => {
		it("returns attempts newest first", async () => {
			const db = createMockDb();
			routePrepare(db.prepare, [
				() => ({ all: async () => ({ results: [sampleMcqRow] }) }),
				() => ({ all: async () => ({ results: [sampleAttemptRow] }) }),
			]);

			const { listAttemptsByMcq } = await loadMcqService();
			await listAttemptsByMcq("mcq-1");

			expect(db.prepare).toHaveBeenCalledWith(expect.stringContaining("ORDER BY created_at DESC"));
		});
	});
});
