Date created: September 1, 2026
Date last modified: September 1, 2026 (renamed `description` to `question`; consolidated to 5 phases)

# Multiple-Choice Question CRUD - Technical PRD

## Overview/Problem

The previous sprint delivered the identity layer — teachers can register, log in, and log out — but the destination they land on, `/mcqs`, is a placeholder that reads "Question bank features coming soon." There is nothing in the application to actually build a question bank with.

Teachers need to author multiple-choice questions, see the questions that already exist, revise them, and remove the ones that are wrong or duplicated. They also need a way to try a question the way a student would, so they can sanity-check that the wording and the answer key make sense before the question is used. This phase replaces the stub with a working question bank: three database tables, an MCQ service, CRUD and attempt endpoints, and the list, editor, and preview pages that sit on top of them.

---

## Hypothesis

We believe that giving teachers a table-driven question bank with create, edit, preview, and delete will let them build and maintain a shared set of multiple-choice questions in the application itself, replacing the ad-hoc documents they keep today and producing the question corpus that later collaboration and AI-generation features depend on.

---

## Scope

### In Scope

- **Database**: three new Cloudflare D1 tables — `mcqs`, `mcq_choices`, `mcq_attempts` — added by a single Wrangler migration, with foreign keys and cascade deletes.
- **MCQ service** (`src/lib/services/mcq-service.ts`): server-side module for listing, reading, creating, updating, and deleting questions together with their choices, plus recording and reading attempts.
- **Validation** (`src/lib/validations/mcq.ts`): Zod schemas for every request body, including the 2–6 choice rule and the exactly-one-correct-answer rule.
- **API endpoints**:
  - `GET /api/mcqs` — list all questions
  - `POST /api/mcqs` — create a question with its choices
  - `GET /api/mcqs/[id]` — read one question with its choices
  - `PUT /api/mcqs/[id]` — update a question and its choices
  - `DELETE /api/mcqs/[id]` — delete a question, cascading to choices and attempts
  - `POST /api/mcqs/[id]/attempts` — record an attempt against a question
  - `GET /api/mcqs/[id]/attempts` — list attempts for a question
- **UI pages**:
  - `/mcqs` — question bank table (name, question, actions) with a Create button
  - `/mcqs/new` — create form
  - `/mcqs/[id]/edit` — edit form (same component as create)
  - `/mcqs/[id]/preview` — answer the question; submitting records an attempt
- **shadcn/ui**: `table` for the list, `dropdown-menu` for the row actions (three vertical ellipses → Edit / Preview / Delete), `dialog` for delete confirmation, `button`, `field`, `input`, `textarea`, `radio-group`, `card`.
- **User attribution**: `mcqs.user_id` records who created a question; `mcq_attempts.user_id` records who attempted it. Both reference `users.id`.
- **Unit tests (TDD with Vitest)**: tests are written **before** implementation in every phase and must go red → green as code is added.

### Out of Scope

- Server-side authentication or route protection. `/mcqs` and every MCQ endpoint remain reachable without a session, exactly as in the previous sprint.
- Filtering, sorting, searching, or paginating the question list.
- Rich text, images, LaTeX, or file attachments in question or choice text.
- Question categories, tags, TEKS/standards alignment, or difficulty levels.
- Attempt history UI — attempts are recorded and readable over the API, but there is no reporting or analytics screen.
- Scoring, quizzes, or assembling questions into a test.
- AI-assisted question generation.
- Bulk import or export.
- Permission rules. Any user can edit or delete any question; `user_id` is attribution only, not authorization.

### Cut

- **Soft delete** — considered so attempt history would survive a deleted question. Cut because it complicates every read query with a `deleted_at IS NULL` filter for a question bank that has no recovery UI. Hard delete with `ON DELETE CASCADE` was chosen instead.
- **Multiple correct answers** — considered, but a single correct choice keeps the attempt's `is_correct` calculation unambiguous and matches how the preview page presents choices (radio group, not checkboxes). Revisit if "select all that apply" is ever needed.
- **Server Actions for form mutations** — the `.cursor/rules/nextjs.mdc` convention prefers Server Actions, but this feature follows the established auth pattern of client components posting JSON to API route handlers. Consistency with the existing codebase wins; the endpoints are also an explicit deliverable.
- **A dedicated `mcq-choice-service`** — choices have no life of their own outside their parent question, so they are managed inside `mcq-service.ts` rather than in a separate module.
- **`react-hook-form` for the dynamic choice list** — the editor manages an array of 2–6 choices, which is the strongest case yet for a form library, but the project has no form library and adding one is a dependency decision. Plain `useState` on an array of choice objects is sufficient.

---

## Technical Requirements

### Database Schema

D1 is SQLite. The binding is `DB`. All schema changes go through a Wrangler migration: `migrations/0002_create_mcq_tables.sql`.

```sql
CREATE TABLE mcqs (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  question TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE mcq_choices (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  mcq_id TEXT NOT NULL REFERENCES mcqs(id) ON DELETE CASCADE,
  choice_text TEXT NOT NULL,
  is_correct INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE mcq_attempts (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  mcq_id TEXT NOT NULL REFERENCES mcqs(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  choice_id TEXT NOT NULL REFERENCES mcq_choices(id) ON DELETE CASCADE,
  selected_choice_text TEXT NOT NULL,
  is_correct INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_mcqs_user_id ON mcqs (user_id);
CREATE INDEX idx_mcq_choices_mcq_id ON mcq_choices (mcq_id);
CREATE INDEX idx_mcq_attempts_mcq_id ON mcq_attempts (mcq_id);
CREATE INDEX idx_mcq_attempts_user_id ON mcq_attempts (user_id);
```

**Column notes:**

| Table | Column | Type | Notes |
|-------|--------|------|-------|
| `mcqs` | `id` | TEXT | Random hex primary key, generated in the service (project convention) |
| `mcqs` | `user_id` | TEXT | Creator. Attribution only — not used for authorization |
| `mcqs` | `name` | TEXT | Required, 1–200 characters. A short label for the question bank list, not the question itself |
| `mcqs` | `question` | TEXT | Required, 1–1000 characters. The question text the user answers |
| `mcq_choices` | `mcq_id` | TEXT | FK to `mcqs`, cascade delete |
| `mcq_choices` | `choice_text` | TEXT | Required, 1–500 characters |
| `mcq_choices` | `is_correct` | INTEGER | SQLite boolean: `0` or `1`. Exactly one choice per question must be `1` |
| `mcq_choices` | `position` | INTEGER | Zero-based display order. Keeps choice order stable across reads |
| `mcq_attempts` | `choice_id` | TEXT | The choice the user selected |
| `mcq_attempts` | `selected_choice_text` | TEXT | Snapshot of the choice text at attempt time, so history stays readable after the question is edited |
| `mcq_attempts` | `is_correct` | INTEGER | Derived **on the server** from the selected choice. Never accepted from the client |

**Two schema decisions worth flagging:**

1. `selected_choice_text` is a denormalized snapshot. Editing a question deletes and replaces removed choices, which cascades away their attempts; the snapshot means the attempts that survive still describe what the user actually chose even if the wording later changed.
2. `is_correct` on an attempt is computed server-side by looking up the selected choice. The client sends only `choiceId`, so a caller cannot claim a wrong answer was right.

**Migration steps (local only):**

1. `npx wrangler d1 migrations create quizmaker-db create_mcq_tables`
2. Write the SQL above into the generated file (expected name: `migrations/0002_create_mcq_tables.sql`)
3. `npx wrangler d1 migrations apply quizmaker-db --local`

Never apply migrations to the remote database from an agent session.

### API Endpoints

All endpoints live under `src/app/api/mcqs/`. Bodies are JSON. Response shapes follow the auth convention: `{ success: true, ... }` or `{ success: false, error, details? }`.

Route handlers receive params as a promise in Next.js 16: `{ params }: { params: Promise<{ id: string }> }`.

#### GET /api/mcqs

Lists every question with its choice count. Used by the table on `/mcqs`.

**Response:**

- Success (200):
  ```json
  {
    "success": true,
    "mcqs": [
      {
        "id": "abc123",
        "userId": "user-1",
        "name": "Photosynthesis inputs",
        "question": "Which two substances does a plant consume during photosynthesis?",
        "choiceCount": 4,
        "createdAt": "2026-09-01 12:00:00",
        "updatedAt": "2026-09-01 12:00:00"
      }
    ]
  }
  ```
- Error (500): `{ "success": false, "error": "Internal server error" }`

An empty bank returns `200` with `"mcqs": []`, not a 404.

#### POST /api/mcqs

Creates a question and its choices in one call.

**Request Body:**

```json
{
  "userId": "user-1",
  "name": "Photosynthesis inputs",
  "question": "Which two substances does a plant consume during photosynthesis?",
  "choices": [
    { "choiceText": "Carbon dioxide and water", "isCorrect": true },
    { "choiceText": "Oxygen and glucose", "isCorrect": false }
  ]
}
```

Choice `position` is assigned from array order; the client does not send it.

**Response:**

- Success (201): `{ "success": true, "mcq": { ...mcq, "choices": [...] } }`
- Error (400): validation failure — missing name or question, fewer than 2 or more than 6 choices, no correct choice, more than one correct choice, blank choice text
  ```json
  { "success": false, "error": "Validation failed", "details": [{ "message": "..." }] }
  ```
- Error (500): `{ "success": false, "error": "Internal server error" }`

#### GET /api/mcqs/[id]

Reads one question with its choices ordered by `position`. Backs both the edit and preview pages.

**Response:**

- Success (200): `{ "success": true, "mcq": { ...mcq, "choices": [...] } }`
- Error (404): `{ "success": false, "error": "Question not found" }`
- Error (500): `{ "success": false, "error": "Internal server error" }`

#### PUT /api/mcqs/[id]

Replaces the question's name, question text, and full choice set.

**Request Body:**

```json
{
  "name": "Photosynthesis inputs",
  "question": "Which two substances does a plant consume during photosynthesis?",
  "choices": [
    { "id": "choice-1", "choiceText": "Carbon dioxide and water", "isCorrect": true },
    { "choiceText": "Oxygen and glucose", "isCorrect": false }
  ]
}
```

A choice with an `id` is updated in place; a choice without one is inserted; any existing choice whose id is absent from the array is deleted. `userId` is not updatable — the original creator is preserved.

**Response:**

- Success (200): `{ "success": true, "mcq": { ...mcq, "choices": [...] } }`
- Error (400): validation failure (same rules as create)
- Error (404): `{ "success": false, "error": "Question not found" }`
- Error (500): `{ "success": false, "error": "Internal server error" }`

#### DELETE /api/mcqs/[id]

Deletes the question. Choices and attempts cascade.

**Response:**

- Success (200): `{ "success": true }`
- Error (404): `{ "success": false, "error": "Question not found" }`
- Error (500): `{ "success": false, "error": "Internal server error" }`

#### POST /api/mcqs/[id]/attempts

Records one attempt. The server resolves the choice, confirms it belongs to this question, and derives correctness.

**Request Body:**

```json
{
  "userId": "user-1",
  "choiceId": "choice-1"
}
```

**Response:**

- Success (201):
  ```json
  {
    "success": true,
    "attempt": {
      "id": "attempt-1",
      "mcqId": "abc123",
      "userId": "user-1",
      "choiceId": "choice-1",
      "selectedChoiceText": "Carbon dioxide and water",
      "isCorrect": true,
      "createdAt": "2026-09-01 12:05:00"
    }
  }
  ```
- Error (400): validation failure, **or** the choice does not belong to this question
  ```json
  { "success": false, "error": "Choice does not belong to this question" }
  ```
- Error (404): question not found
- Error (500): `{ "success": false, "error": "Internal server error" }`

#### GET /api/mcqs/[id]/attempts

Lists attempts for a question, newest first.

**Response:**

- Success (200): `{ "success": true, "attempts": [...] }`
- Error (404): question not found
- Error (500): `{ "success": false, "error": "Internal server error" }`

### User Interface Requirements

Built with **shadcn/ui** on Base UI (`base-nova` style) and Tailwind v4 semantic tokens. Pages that need interactivity are client components; the rest are thin server wrappers, following the pattern set by `/login` and `/register`.

**shadcn components to add** (require approval — see Dependencies):

```bash
npx shadcn@latest add @shadcn/dropdown-menu @shadcn/textarea @shadcn/radio-group
```

`table`, `dialog`, `button`, `field`, `input`, `label`, `card`, `badge`, and `separator` are already installed.

#### Question Bank (`/mcqs`)

Replaces the stub. Keeps the existing greeting and Logout button.

- Page header: heading "MCQ Question Bank", the current user's first name from `sessionStorage`, a **Create question** button (`Link` to `/mcqs/new`), and the existing **Logout** button.
- shadcn `Table` with three columns:

| Column | Content |
|--------|---------|
| Name | `mcqs.name` |
| Question | `mcqs.question`, truncated with `line-clamp-2` |
| Actions | Icon button showing `MoreVertical` (three vertical ellipses) from Lucide |

- The actions button opens a `DropdownMenu` with three items:
  - **Edit** → navigate to `/mcqs/[id]/edit`
  - **Preview** → navigate to `/mcqs/[id]/preview`
  - **Delete** → open a confirmation `Dialog`
- Delete confirmation dialog: title "Delete question?", body naming the question and warning that its choices and recorded attempts are removed too, with **Cancel** and a destructive **Delete** button. Confirming sends `DELETE /api/mcqs/[id]` and refreshes the list.
- Empty state: when the bank has no questions, show a message and a Create question call to action instead of an empty table body.
- Loading state while the list is fetched; error banner if the fetch fails.

#### Question Editor (`/mcqs/new` and `/mcqs/[id]/edit`)

Both routes render one shared client component, `src/components/mcq-form.tsx`, which takes an optional existing question. `/mcqs/new` starts with two blank choices; `/mcqs/[id]/edit` loads the question via `GET /api/mcqs/[id]` and pre-fills.

- Fields:
  - **Name** — `Input`, required, 1–200 characters. A short label used in the question bank list
  - **Question** — `Textarea`, required, 1–1000 characters. The question text the user answers
  - **Choices** — a dynamic list, minimum 2, maximum 6:
    - Each row has a `RadioGroup` radio marking it as the correct answer, an `Input` for the choice text (required, 1–500 characters), and a remove button (disabled when only two choices remain)
    - **Add choice** button, hidden or disabled once six choices exist
    - Removing the choice that is currently marked correct clears the selection, and the form will not save until another is marked
- Validation before submit: name present, question text present, every choice non-empty, between 2 and 6 choices, exactly one marked correct. Errors surface through `FieldError`.
- **Save** — `POST /api/mcqs` on create, `PUT /api/mcqs/[id]` on edit; on success navigate to `/mcqs`. Disabled while the request is in flight.
- **Cancel** — navigate back to `/mcqs` without saving.
- On create, `userId` comes from the `quizmaker.user` object in `sessionStorage`. If no stored user exists, redirect to `/login`.

#### Question Preview (`/mcqs/[id]/preview`)

Shows the question the way someone answering it would see it, and records the result.

- `Card` with `mcqs.name` as the title and `mcqs.question` presented as the question stem above the choices.
- Choices rendered as a `RadioGroup`, in `position` order. Correctness is not revealed before submitting.
- **Submit answer** — posts to `POST /api/mcqs/[id]/attempts` with the selected `choiceId` and the stored `userId`; disabled until a choice is selected.
- After the response, show the result inline: a success treatment for a correct answer, and for an incorrect one, which choice was correct.
- **Try again** resets the selection and allows another attempt (each submission is a new row in `mcq_attempts`).
- **Back to questions** link returns to `/mcqs`.
- 404 from the API renders a "Question not found" state with a link back to `/mcqs`.

---

## Test-Driven Development with Vitest

This feature continues the **TDD** approach established in the auth PRD. Vitest, Testing Library, and jsdom are already installed and configured (`vitest.config.ts`, `vitest.setup.ts`); no new test setup is required.

In **every phase**, write Vitest tests first. They **fail (red)** because the code under test does not exist. As implementation lands, the same tests **pass (green)**. Red → green plus the phase's acceptance checkboxes determine when a phase is complete.

### TDD workflow (every phase)

1. **Red** — Write the phase's tests. Run `npm test`. Confirm the new tests fail for the right reason (missing module, unimplemented export, wrong return value). Harness errors are not valid red signals; fix them first.
2. **Green** — Implement the minimum production code to pass. Run `npm test` until the phase's tests and all prior tests pass.
3. **Refactor** — Clean up while staying green.
4. **Gate** — Mark the phase complete only when `npm test` exits 0 **and** every checkbox in that phase's "Phase completion" section is checked.

Do not write production code before its tests exist for that phase.

### Vitest conventions

| Rule | Detail |
|------|--------|
| Colocation | `src/lib/foo.ts` → `src/lib/foo.test.ts`; pages → `page.test.tsx` |
| Mock boundaries | Mock D1 via `vi.mock("@/lib/db")` in service tests; mock the service via `vi.mock("@/lib/services/mcq-service")` in route tests. Unit tests never touch a real database or network |
| Meaningful assertions | No hollow tests. Assert outputs, SQL bindings, status codes, and failure paths |
| Isolation | `beforeEach(() => { vi.clearAllMocks(); vi.resetModules(); })`; import modules dynamically inside tests where module state matters |
| React components | Testing Library; query by role and accessible name; prefer `userEvent` over `fireEvent` |
| Navigation | Mock `next/navigation` (`useRouter().push`, `useParams`) |
| Network | `vi.stubGlobal("fetch", vi.fn())` in page and component tests |

See `.cursor/skills/testing/SKILL.md` for the full mocking patterns.

---

## Implementation Phases

### Phase workflow and review gates

Every phase follows the same loop, and **the agent stops at the end of each phase**:

1. Read the phase requirements and its acceptance criteria in this PRD.
2. Write that phase's Vitest tests **first**.
3. Run `npm test` and confirm the new tests fail (**red**) for the right reason.
4. Implement the phase.
5. Run `npm test` and confirm the tests pass (**green**) with no regressions in earlier phases.
6. Verify the phase's own acceptance criteria and tick the "Phase completion" boxes.
7. Report: implementation summary, files created and modified, tests created, test results, schema or migration changes, and any assumptions or issues.
8. **Stop and wait for review.** Do not begin the next phase without explicit approval.

Git and deployment are **user-directed, not automatic**. On approval, and only when asked:

- All phases land on a **single shared feature branch** for this feature.
- Each phase is its own commit and push to that branch.
- Deployment happens per phase at the user's explicit instruction (`npm run deploy` is never run unprompted, per `AGENTS.md`).

The red-to-green Vitest signal and the phase's acceptance criteria together are what determine whether a phase is done. Neither alone is sufficient.

---

### Phase 1: Schema + Migration - COMPLETED

**Objective**: Create and locally apply the migration for the three MCQ tables.

#### Vitest test plan (write these first — expect red)

**File**: `migrations/migrations.test.ts` (extend the existing file with a new `describe` block)

| Test case | Red signal | Green signal |
|-----------|------------|--------------|
| Migration creates `mcqs` with required columns | No `CREATE TABLE mcqs` in any migration | SQL contains `id`, `user_id`, `name`, `question`, `created_at`, `updated_at` |
| Migration creates `mcq_choices` with required columns | Table missing | SQL contains `mcq_id`, `choice_text`, `is_correct`, `position` |
| Migration creates `mcq_attempts` with required columns | Table missing | SQL contains `mcq_id`, `user_id`, `choice_id`, `selected_choice_text`, `is_correct` |
| Foreign keys cascade on delete | No `ON DELETE CASCADE` | `mcq_choices.mcq_id` and `mcq_attempts.mcq_id` both cascade |
| Indexes exist | Indexes absent | `idx_mcqs_user_id`, `idx_mcq_choices_mcq_id`, `idx_mcq_attempts_mcq_id` present |
| Existing users-table assertions still pass | — | No regression from the auth sprint |

#### Implementation tasks (after red)

1. Write the migration tests; run `npm test` — confirm red
2. `npx wrangler d1 migrations create quizmaker-db create_mcq_tables`
3. Write the schema SQL into the generated migration file
4. `npx wrangler d1 migrations apply quizmaker-db --local`
5. Run `npm test` — confirm green

#### Phase completion

- [x] Migration tests written before the migration SQL — 10 new tests failed with "expected a CREATE TABLE mcqs statement" before any SQL existed
- [x] `npm test` green for Phase 1 — 53 tests across 11 files, exit 0
- [x] `migrations/0002_create_mcq_tables.sql` exists and applied locally — 8 commands executed successfully
- [x] Local D1 shows all three tables — `mcqs`, `mcq_choices`, `mcq_attempts` present in `sqlite_master`, plus all four `idx_mcq*` indexes
- [x] Remote database untouched — only `--local` was used
- [x] Cascade delete verified functionally, not just declared — deleting a question dropped its 2 choices and 1 attempt to 0 (see Troubleshooting Guide)

**Deliverables**: `migrations/0002_create_mcq_tables.sql`, extended `migrations/migrations.test.ts`

---

### Phase 2: MCQ Service - COMPLETED

**Objective**: Build the service layer for questions, choices, and attempts.

#### Vitest test plan (write these first — expect red)

**File**: `src/lib/services/mcq-service.test.ts` — mock `@/lib/db` with the fake D1 chain (`prepare → bind → all/run`) used in `user-service.test.ts`.

| Test case | Red signal | Green signal |
|-----------|------------|--------------|
| `listMcqs` returns mapped questions with `choiceCount` | Missing export; snake_case leaks through | camelCase objects with a numeric `choiceCount` |
| `listMcqs` returns `[]` for an empty bank | Throws or returns null | Empty array |
| `getMcqById` returns the question with choices ordered by `position` | Choices missing or unordered | Choices in ascending `position` |
| `getMcqById` returns null when not found | Throws | `null` |
| `createMcq` inserts the question and every choice | Only the question inserted | Insert called once per choice; `position` assigned from array order |
| `createMcq` returns the created question with choices | Returns void or partial | Full object returned |
| `createMcq` rejects fewer than 2 or more than 6 choices | Insert proceeds | `McqValidationError` thrown |
| `createMcq` rejects zero or multiple correct choices | Insert proceeds | `McqValidationError` thrown |
| `updateMcq` updates name, question, and `updated_at` | Fields unchanged | `UPDATE mcqs` bound with new values |
| `updateMcq` updates existing choices, inserts new ones, deletes removed ones | Deletes and reinserts everything | Choice with an id updated; choice without an id inserted; absent id deleted |
| `updateMcq` preserves the original `user_id` | Creator overwritten | `user_id` unchanged |
| `updateMcq` throws `McqNotFoundError` for an unknown id | Silent no-op | Error thrown |
| `deleteMcq` deletes the question row | Nothing deleted | `DELETE FROM mcqs WHERE id = ?1` bound with the id |
| `deleteMcq` throws `McqNotFoundError` for an unknown id | Returns success | Error thrown |
| `createAttempt` derives `is_correct` from the stored choice, ignoring any client value | Client value trusted | Correctness read from `mcq_choices.is_correct` |
| `createAttempt` snapshots `selected_choice_text` | Column empty | Stored text matches the choice |
| `createAttempt` rejects a choice from a different question | Attempt recorded | `McqValidationError` thrown |
| `createAttempt` throws `McqNotFoundError` for an unknown question | Attempt recorded | Error thrown |
| `listAttemptsByMcq` returns attempts newest first | Unordered | `ORDER BY created_at DESC` |

#### Implementation tasks (after red)

1. Write the tests above; run `npm test` — confirm red
2. Implement `src/lib/services/mcq-service.ts`: `McqRow`/`ChoiceRow`/`AttemptRow` types, `toMcq`/`toChoice`/`toAttempt` mappers, `McqNotFoundError` and `McqValidationError`, and the functions above
3. Run `npm test` — confirm Phases 1–2 green

#### Phase completion

- [x] `mcq-service.test.ts` written before `mcq-service.ts` — 21 tests failed with missing module before implementation
- [x] `npm test` green for Phases 1–2 — 74 tests across 12 files, exit 0
- [x] Service exposes list, read, create, update, delete, `createAttempt`, `listAttemptsByMcq`
- [x] Attempt correctness is derived server-side from `mcq_choices.is_correct`, never from client input
- [x] All queries use numbered placeholders; no string concatenation

**Deliverables**: `src/lib/services/mcq-service.test.ts`, `src/lib/services/mcq-service.ts`

---

### Phase 3: API Endpoints - PLANNED

**Objective**: Expose the service over HTTP, with Zod validation on every request body.

#### Vitest test plan (write these first — expect red)

**File**: `src/lib/validations/mcq.test.ts`

| Test case | Red signal | Green signal |
|-----------|------------|--------------|
| Create schema rejects a missing or blank name | Accepts `""` | Validation error |
| Create schema rejects a name over 200 characters | Accepts | Validation error |
| Create schema rejects fewer than 2 choices | Accepts 1 | Validation error |
| Create schema rejects more than 6 choices | Accepts 7 | Validation error |
| Create schema rejects zero correct choices | Accepts | Validation error naming the correct-answer rule |
| Create schema rejects more than one correct choice | Accepts | Validation error |
| Create schema rejects blank choice text | Accepts `""` | Validation error |
| Create schema rejects a missing or blank question | Accepts `""` | Validation error |
| Create schema rejects a question over 1000 characters | Accepts | Validation error |
| Create schema accepts a valid payload | Rejects valid input | Parsed object |
| Update schema accepts choices with and without ids | Rejects mixed array | Parsed object |
| Attempt schema rejects a missing `userId` or `choiceId` | Accepts empty | Validation error |

**File**: `src/app/api/mcqs/route.test.ts` — `vi.mock("@/lib/services/mcq-service")`

| Test case | Red signal | Green signal |
|-----------|------------|--------------|
| GET returns 200 with the question list | 404 | `{ success: true, mcqs: [...] }` |
| GET returns 200 with `[]` for an empty bank | 404 or 500 | Empty array |
| GET returns 500 when the service throws | Unhandled rejection | `{ success: false, error: "Internal server error" }` |
| POST returns 201 with the created question | 404 or 500 | `{ success: true, mcq }` |
| POST returns 400 on an invalid body | 201 | Validation error; service not called |
| POST returns 500 when the service throws | Unhandled rejection | 500 |

**File**: `src/app/api/mcqs/[id]/route.test.ts`

| Test case | Red signal | Green signal |
|-----------|------------|--------------|
| GET returns 200 with the question and choices | 404 | `{ success: true, mcq }` |
| GET returns 404 for an unknown id | 200 or 500 | `{ success: false, error: "Question not found" }` |
| PUT returns 200 with the updated question | 404 | Updated object returned |
| PUT returns 400 on an invalid body | 200 | Validation error; service not called |
| PUT returns 404 when the service throws `McqNotFoundError` | 500 | 404 with a clear message |
| DELETE returns 200 on success | 404 | `{ success: true }` |
| DELETE returns 404 for an unknown id | 200 | 404 |
| Route reads the async `params` promise correctly | `params.id` undefined | Service called with the id from the URL |

**File**: `src/app/api/mcqs/[id]/attempts/route.test.ts`

| Test case | Red signal | Green signal |
|-----------|------------|--------------|
| POST returns 201 with the recorded attempt | 404 | `{ success: true, attempt }` including `isCorrect` |
| POST returns 400 on an invalid body | 201 | Validation error |
| POST returns 400 when the choice belongs to another question | 201 | Clear error message |
| POST returns 404 for an unknown question | 201 or 500 | 404 |
| POST does not let the client set `isCorrect` | Client value echoed back | Server-derived value returned |
| GET returns 200 with the attempt list | 404 | `{ success: true, attempts: [...] }` |
| GET returns 404 for an unknown question | 200 | 404 |

#### Implementation tasks (after red)

1. Write all tests above; run `npm test` — confirm red
2. Implement `src/lib/validations/mcq.ts` (reusing `formatValidationDetails` from `@/lib/validations/auth`, or moving it to a shared module if cleaner)
3. Implement the four route files
4. Run `npm test` — confirm Phases 1–3 green

#### Phase completion

- [ ] Validation and route tests written before implementations
- [ ] `npm test` green for Phases 1–3
- [ ] All seven endpoints return the documented status codes
- [ ] `isCorrect` cannot be set by the client
- [ ] Route handlers await the `params` promise (Next.js 16)

**Deliverables**: `src/lib/validations/mcq.ts` + test, `src/app/api/mcqs/route.ts` + test, `src/app/api/mcqs/[id]/route.ts` + test, `src/app/api/mcqs/[id]/attempts/route.ts` + test

---

### Phase 4: UI - PLANNED

**Objective**: Build the front end — the question bank table, the shared create/edit editor, and the preview page that records attempts.

This is the largest phase. Work through the three groups below in order, running `npm test` after each, so the table exists before the editor navigates back to it and the editor exists before preview reuses the same question fetch. Each group is still tests-first; the phase is not complete until all three are green.

#### Vitest test plan (write these first — expect red)

**4a — Question bank table**

**File**: `src/app/mcqs/page.test.tsx` — extend the existing file; keep the logout tests passing.

| Test case | Red signal | Green signal |
|-----------|------------|--------------|
| Fetches `GET /api/mcqs` on mount | No fetch | Endpoint called once |
| Renders a row per question with name and question text | Stub copy only | Both values visible |
| Renders the empty state when the bank is empty | Blank table | Empty-state message and Create call to action |
| Renders an error banner when the fetch fails | Silent failure | Error message visible |
| Create question links to `/mcqs/new` | Link missing | `href="/mcqs/new"` |
| Row actions menu opens with Edit, Preview, Delete | Menu missing | All three items visible after clicking the actions button |
| Edit navigates to `/mcqs/[id]/edit` | No navigation | Correct route pushed or linked |
| Preview navigates to `/mcqs/[id]/preview` | No navigation | Correct route |
| Delete opens a confirmation dialog before any request | Deletes immediately | Dialog shown; no fetch yet |
| Confirming delete calls `DELETE /api/mcqs/[id]` | No fetch | Endpoint called with the right id |
| Confirming delete removes the row from the table | Row remains | Row gone after the list refreshes |
| Cancelling the dialog sends no request | Delete fires | No `DELETE` call |
| Existing logout behaviour still works | Regression | Logout posts and redirects to `/login` |

**4b — Question editor (create and edit)**

**File**: `src/components/mcq-form.test.tsx`

| Test case | Red signal | Green signal |
|-----------|------------|--------------|
| Renders name, question, and two blank choices by default | Fewer fields | All present |
| Add choice appends a row | No change | Three rows |
| Add choice is disabled at six choices | Seventh row added | Disabled at six |
| Remove choice deletes a row | No change | Row removed |
| Remove is disabled at two choices | Drops to one | Disabled at two |
| Marking a choice correct deselects the previous one | Two selected | Exactly one selected |
| Removing the correct choice clears the selection | Stale selection persists | No choice marked correct |
| Save is blocked when the name is blank | Request sent | Validation message; no fetch |
| Save is blocked when the question is blank | Request sent | Validation message; no fetch |
| Save is blocked when a choice is blank | Request sent | Validation message; no fetch |
| Save is blocked when no choice is marked correct | Request sent | Validation message; no fetch |
| Create posts to `POST /api/mcqs` with `userId` from `sessionStorage` | Wrong endpoint or missing userId | Correct body |
| Edit puts to `PUT /api/mcqs/[id]` | POST used | Correct method and URL |
| Successful save navigates to `/mcqs` | Stays on the page | Navigation triggered |
| API error is shown and navigation does not happen | Silent failure or redirect | Error visible; still on the page |
| Cancel navigates to `/mcqs` without a request | Fetch fired | No fetch; navigation triggered |
| Edit mode pre-fills name, question, and existing choices | Blank form | Values populated |

**File**: `src/app/mcqs/new/page.test.tsx`

| Test case | Red signal | Green signal |
|-----------|------------|--------------|
| Renders the editor in create mode | Route missing | Empty form with two choices |
| Redirects to `/login` when no stored user | Renders anyway | Navigation to `/login` |

**File**: `src/app/mcqs/[id]/edit/page.test.tsx`

| Test case | Red signal | Green signal |
|-----------|------------|--------------|
| Fetches `GET /api/mcqs/[id]` on mount | No fetch | Endpoint called with the id |
| Renders the editor pre-filled | Blank form | Existing values shown |
| Renders a not-found state on 404 | Crash or blank | "Question not found" with a link to `/mcqs` |

**4c — Question preview and attempts**

**File**: `src/app/mcqs/[id]/preview/page.test.tsx`

| Test case | Red signal | Green signal |
|-----------|------------|--------------|
| Fetches the question on mount | No fetch | `GET /api/mcqs/[id]` called |
| Renders the name, question text, and all choices in `position` order | Missing or unordered | All choices in order |
| Does not reveal the correct answer before submitting | Correct choice highlighted | No correctness indicator |
| Submit is disabled until a choice is selected | Enabled immediately | Disabled, then enabled after selecting |
| Submit posts `choiceId` and `userId` to the attempts endpoint | Wrong body or endpoint | Correct request |
| Correct answer shows a success result | No feedback | Correct-answer feedback visible |
| Wrong answer shows which choice was correct | No feedback | Incorrect feedback naming the correct choice |
| Try again clears the result and allows another submission | Locked after one attempt | Second POST possible |
| Renders a not-found state on 404 | Crash or blank | "Question not found" with a link to `/mcqs` |
| Shows an error and no result when the attempt request fails | Fake success shown | Error message visible |

#### Implementation tasks (after red)

1. Get approval and add the three shadcn components: `npx shadcn@latest add @shadcn/dropdown-menu @shadcn/textarea @shadcn/radio-group`
2. **4a** — Write the question bank tests; run `npm test` (red). Build `src/components/mcq-table.tsx` (client) and rewrite `src/app/mcqs/page.tsx` around it, preserving the greeting and Logout button. Run `npm test` (green)
3. **4b** — Write the editor tests; run `npm test` (red). Implement `src/components/mcq-form.tsx` and the `/mcqs/new` and `/mcqs/[id]/edit` pages. Run `npm test` (green)
4. **4c** — Write the preview tests; run `npm test` (red). Implement `src/app/mcqs/[id]/preview/page.tsx`. Run `npm test` (green)
5. Run `npm test` once more — confirm Phases 1–4 green with no regressions

#### Phase completion

- [ ] Tests written before the implementation in each of 4a, 4b, and 4c
- [ ] `npm test` green for Phases 1–4
- [ ] Table shows name, question, and an actions column with three vertical ellipses
- [ ] Dropdown offers Edit, Preview, and Delete
- [ ] Delete is confirmed before the request is sent
- [ ] Logout still works
- [ ] One shared form component serves both create and edit
- [ ] Choice count is constrained to 2–6 in the UI
- [ ] Exactly one correct choice is enforced before save
- [ ] Save and Cancel behave as specified
- [ ] Submitting a preview answer records an attempt through the API
- [ ] Correctness is only revealed after submitting
- [ ] Repeat attempts are allowed and each is recorded

**Deliverables**: `src/components/ui/dropdown-menu.tsx`, `textarea.tsx`, and `radio-group.tsx` (generated); `src/components/mcq-table.tsx`; `src/components/mcq-form.tsx` + test; updated `src/app/mcqs/page.tsx` and extended `src/app/mcqs/page.test.tsx`; `src/app/mcqs/new/page.tsx` + test; `src/app/mcqs/[id]/edit/page.tsx` + test; `src/app/mcqs/[id]/preview/page.tsx` + test

---

### Phase 5: Verify - PLANNED

**Objective**: Confirm the feature meets the global acceptance criteria.

#### Vitest test plan

Run the complete suite from Phases 1–4 plus everything inherited from the auth sprint. Add tests only if manual preview reveals uncovered behaviour — test first, then fix.

| Check | Red signal | Green signal | Result |
|-------|------------|--------------|--------|
| Full Vitest suite | Any failure | `npm test` exits 0 | — |
| Lint | ESLint errors | `npm run lint` exits 0 | — |
| Build | Compile errors | `npm run build` succeeds | — |
| Preview smoke | Manual flow broken | Create → list → edit → preview → delete all work against real D1 | — |
| Cascade check | Orphan rows remain | Deleting a question removes its choices and attempts from local D1 | — |

#### Implementation tasks

1. `npm test` — full suite green
2. `npm run lint` — zero errors
3. `npm run build` — succeeds
4. `npm run preview` — walk the manual checklist in the Troubleshooting Guide
5. Verify cascade deletes by querying local D1 after a delete
6. Mark the global acceptance criteria below
7. Record any issues found in the Troubleshooting Guide

#### Phase completion

- [ ] `npm test` green across all phases
- [ ] `npm run lint` passes
- [ ] `npm run build` succeeds
- [ ] Manual preview flows pass
- [ ] Cascade delete verified in local D1
- [ ] All global acceptance criteria checked

**Deliverables**: green local checks, verified manual flows, troubleshooting notes

---

## Technical Implementation Details

### Key Files

**Production**

- `migrations/0002_create_mcq_tables.sql` — `mcqs`, `mcq_choices`, `mcq_attempts`
- `src/lib/services/mcq-service.ts` — question, choice, and attempt operations
- `src/lib/validations/mcq.ts` — Zod schemas for MCQ and attempt payloads
- `src/app/api/mcqs/route.ts` — list and create
- `src/app/api/mcqs/[id]/route.ts` — read, update, delete
- `src/app/api/mcqs/[id]/attempts/route.ts` — record and list attempts
- `src/components/mcq-table.tsx` — question bank table with row actions and delete dialog
- `src/components/mcq-form.tsx` — shared create/edit form
- `src/app/mcqs/page.tsx` — question bank page
- `src/app/mcqs/new/page.tsx` — create route
- `src/app/mcqs/[id]/edit/page.tsx` — edit route
- `src/app/mcqs/[id]/preview/page.tsx` — preview and attempt route
- `src/components/ui/dropdown-menu.tsx`, `textarea.tsx`, `radio-group.tsx` — generated shadcn components

**Tests (colocated, written before implementation)**

- `migrations/migrations.test.ts` (extended)
- `src/lib/services/mcq-service.test.ts`
- `src/lib/validations/mcq.test.ts`
- `src/app/api/mcqs/route.test.ts`
- `src/app/api/mcqs/[id]/route.test.ts`
- `src/app/api/mcqs/[id]/attempts/route.test.ts`
- `src/app/mcqs/page.test.tsx` (extended)
- `src/components/mcq-form.test.tsx`
- `src/app/mcqs/new/page.test.tsx`
- `src/app/mcqs/[id]/edit/page.test.tsx`
- `src/app/mcqs/[id]/preview/page.test.tsx`

### Implementation Patterns

**Service shape — mirrors `user-service.ts`:**

```typescript
import { getDatabase } from "@/lib/db";

export class McqNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "McqNotFoundError";
  }
}

type McqRow = {
  id: string;
  user_id: string;
  name: string;
  question: string;
  created_at: string;
  updated_at: string;
};

function toMcq(row: McqRow): Mcq {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    question: row.question,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
```

**Reading a question with its choices:**

```typescript
const choices = await db
  .prepare(
    "SELECT id, mcq_id, choice_text, is_correct, position FROM mcq_choices WHERE mcq_id = ?1 ORDER BY position ASC",
  )
  .bind(mcqId)
  .all<ChoiceRow>();
```

**SQLite booleans** are integers. Map at the boundary — `isCorrect: row.is_correct === 1` on read, `choice.isCorrect ? 1 : 0` on write. Never let a raw `0`/`1` reach the UI.

**Deriving attempt correctness server-side:**

```typescript
const choice = await getChoiceById(input.choiceId);
if (!choice || choice.mcqId !== mcqId) {
  throw new McqValidationError("Choice does not belong to this question");
}
const isCorrect = choice.isCorrect;
```

**Route params are a promise in Next.js 16:**

```typescript
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // ...
}
```

**The one-correct-answer rule** is enforced in two places: the Zod schema with `.refine()`, so the API rejects bad payloads, and the service, so a direct service call cannot bypass it. The tests cover both.

**Reading the current user in a client component:**

```typescript
const stored = sessionStorage.getItem("quizmaker.user");
if (!stored) {
  router.push("/login");
  return;
}
const { id: userId } = JSON.parse(stored) as { id: string };
```

**Mocking the service in route tests:**

```typescript
const mockListMcqs = vi.fn();

vi.mock("@/lib/services/mcq-service", () => ({
  listMcqs: (...args: unknown[]) => mockListMcqs(...args),
  McqNotFoundError: class extends Error {},
}));
```

Domain error classes must be included in the mock factory, otherwise `instanceof` checks in the route silently fail.

### Important Notes

- **D1 needs the Workers runtime.** Database behaviour is only real under `npm run preview`; `npm run dev` runs on Node and has no `DB` binding. Vitest mocks D1 entirely.
- **D1 enforces foreign keys by default**, so `ON DELETE CASCADE` works without a `PRAGMA`. Confirmed in Phase 1 against local D1: deleting an `mcqs` row removed its `mcq_choices` and `mcq_attempts` rows.
- **Prepared statements only.** Never concatenate user input into SQL. Use numbered placeholders (`?1`, `?2`).
- **`userId` is untrusted.** It comes from `sessionStorage` and is sent in the request body. There is no server-side session, so any caller can send any user id. This is attribution, not authorization, and it is a known limitation of this sprint.
- **No authorization checks.** Any user can edit or delete any question. Deliberate for a shared bank; revisit if ownership rules are ever needed.
- **Editing a question can delete attempt rows.** Removing a choice cascades to the attempts that selected it. `selected_choice_text` preserves the wording of attempts that survive.
- **Base UI, not Radix.** shadcn components in this project are generated on Base UI in the `base-nova` style. Add them with `npx shadcn@latest add @shadcn/{name}` and do not hand-edit the generated files.

---

## Acceptance Criteria

Global criteria for sign-off (Phase 5). Phase-specific gates live in each phase's "Phase completion" section.

**Automated (Vitest)**

- [ ] Tests were written **before** production code in every phase (TDD)
- [ ] `npm test` passes with zero failures, including all tests inherited from the auth sprint

**Functional**

- [ ] `/mcqs` lists every question in a shadcn table with name, question, and an actions column
- [ ] The actions column shows a three-vertical-ellipses button that opens a dropdown with Edit, Preview, and Delete
- [ ] A Create button on `/mcqs` opens the editor at `/mcqs/new`
- [ ] A teacher can create a question with a name, question text, and 2 to 6 choices, one marked correct, and it appears in the table
- [ ] The editor starts with two choices, allows adding up to six, and prevents dropping below two
- [ ] Save persists the question; Cancel returns to `/mcqs` without saving
- [ ] Edit loads the existing question with its choices pre-filled and saves changes
- [ ] Delete asks for confirmation and, once confirmed, removes the question, its choices, and its attempts
- [ ] Preview shows the question and choices without revealing the answer, and submitting records an attempt
- [ ] A recorded attempt stores the selected choice and whether it was correct
- [ ] Attempt correctness is calculated on the server and cannot be set by the client
- [ ] The API rejects questions with fewer than 2 choices, more than 6, or other than exactly one correct choice
- [ ] An empty question bank shows an empty state rather than a broken table
- [ ] Existing register, login, and logout flows still work

**Build quality**

- [ ] `npm run lint` passes with no errors
- [ ] `npm run build` succeeds
- [ ] `npm run preview` runs the full flow against real D1

---

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Phase TDD signal | Red → green in every phase | `npm test` fails before implementation, passes after |
| Question creation | A question saved in under 2 minutes | Manual preview walkthrough |
| CRUD completeness | Create, read, update, and delete all work end to end | Vitest (Phases 2–4) + manual preview |
| Referential integrity | Zero orphaned choices or attempts after a delete | Query local D1 after deleting a question |
| Attempt integrity | 100% of `is_correct` values match the stored answer key | Vitest (Phase 2) + inspect local D1 |
| Validation coverage | Every invalid choice configuration rejected with a clear message | Vitest (Phase 3) |
| Build health | Lint, build, and tests pass | `npm run lint && npm run build && npm test` |

---

## Dependencies

### External Dependencies

- **Cloudflare D1** — SQLite storage for all three tables (binding `DB`)

### Internal Dependencies

- **`users` table** — `mcqs.user_id` and `mcq_attempts.user_id` are foreign keys to it (auth sprint)
- **`src/lib/db.ts`** — `getDatabase()` for the D1 binding
- **`src/lib/validations/auth.ts`** — `formatValidationDetails` is reused for consistent error shapes
- **`sessionStorage["quizmaker.user"]`** — the only source of the current user id
- **`zod`** — already installed
- **Vitest stack** — already installed and configured
- **`.cursor/skills/testing/SKILL.md`** — Vitest setup, mocking, and quality rules

### New Dependencies (require approval before adding)

No new npm packages. Three shadcn components need to be generated into the repo:

All three are added at the start of Phase 4:

- **`dropdown-menu`** — the row actions menu on the question bank table
- **`textarea`** — the question field in the editor
- **`radio-group`** — marking the correct choice in the editor and selecting an answer in preview

```bash
npx shadcn@latest add @shadcn/dropdown-menu @shadcn/textarea @shadcn/radio-group
```

These generate source files under `src/components/ui/` and pull in Base UI primitives already covered by `@base-ui/react`.

### Environment Variables

None. D1 is a binding in `wrangler.jsonc`, not a secret.

---

## Risks and Mitigation

### Technical Risks

- **Risk**: Editing a question deletes the attempts tied to removed choices, silently losing history.
- **Mitigation**: The update is a diff, not a wipe-and-replace, so unchanged choices keep their ids and their attempts. `selected_choice_text` preserves the wording on surviving rows. Documented as expected behaviour.

- **Risk**: The client sends `userId`, so attribution can be forged.
- **Mitigation**: Accepted for this sprint and documented. `user_id` is never used for an access decision. Server-side sessions are the fix and belong to a later sprint.

- **Risk**: The client could send `isCorrect` and fake a correct attempt.
- **Mitigation**: The attempt schema does not accept `isCorrect`; the server derives it from the stored choice. A Phase 3 test asserts a client-supplied value is ignored.

- **Risk**: `ON DELETE CASCADE` silently does nothing if foreign keys are not enforced, leaving orphan rows.
- **Mitigation**: **Resolved in Phase 1.** Cascade was verified against local D1 with a real insert-and-delete probe, not just read from the DDL. Phase 5 re-checks it through the UI.

- **Risk**: The multi-statement create and update (question plus N choices) partially fails, leaving a question with the wrong choices.
- **Mitigation**: Use `db.batch()` so the statements run as one transaction. Note it in the service and cover the failure path in tests.

- **Risk**: Agent writes production code before tests, losing the TDD signal.
- **Mitigation**: The PRD mandates tests first in every phase; a phase is incomplete until `npm test` is green.

- **Risk**: The dynamic choice list is the most stateful UI in the project and is easy to get subtly wrong (stale correct-answer index after a removal).
- **Mitigation**: Track correctness on the choice object itself rather than by index, and test the remove-the-correct-choice case explicitly.

### User Experience Risks

- **Risk**: Deleting a question is irreversible and there is no undo.
- **Mitigation**: A confirmation dialog names the question and warns that choices and attempts go with it.

- **Risk**: With no ownership rules, one teacher can overwrite another's question.
- **Mitigation**: Intentional for a shared bank in this sprint. Out of scope, and flagged for a future permissions phase.

- **Risk**: Long question text breaks the table layout.
- **Mitigation**: Clamp the question cell to two lines and cap the field at 1000 characters.

---

## Troubleshooting Guide

### `npm run preview` fails on Windows with `EPERM`

**Problem**: The OpenNext build exits with `Error: EPERM, Permission denied` while removing `.open-next`.
**Cause**: OpenNext is not fully Windows-compatible; a running preview, the IDE, or antivirus can hold a lock on files under `.open-next`.
**Solution**: Stop any running preview or dev server, delete `.open-next` manually, then retry. WSL is an alternative. Carried over from the auth sprint.

### Verifying cascade deletes in local D1

**Problem**: `ON DELETE CASCADE` can be declared in the DDL but do nothing if the engine does not enforce foreign keys, leaving orphaned choices and attempts.
**Cause**: SQLite disables foreign key enforcement by default; D1 enables it, but that is worth proving rather than assuming.
**Solution**: Insert a probe row set, delete the parent, and count the children. Used in Phase 1:

```sql
INSERT INTO users (id, first_name, last_name, username, email, password_hash) VALUES ('p1probe-user','Phase','One','phase1_probe','phase1_probe@example.test','salt:hash');
INSERT INTO mcqs (id, user_id, name, question) VALUES ('p1probe-mcq','p1probe-user','Probe','Probe question?');
INSERT INTO mcq_choices (id, mcq_id, choice_text, is_correct, position) VALUES ('p1probe-c1','p1probe-mcq','Right',1,0),('p1probe-c2','p1probe-mcq','Wrong',0,1);
INSERT INTO mcq_attempts (id, mcq_id, user_id, choice_id, selected_choice_text, is_correct) VALUES ('p1probe-a1','p1probe-mcq','p1probe-user','p1probe-c1','Right',1);
DELETE FROM mcqs WHERE id='p1probe-mcq';
SELECT (SELECT COUNT(*) FROM mcq_choices WHERE mcq_id='p1probe-mcq') AS choices_after,
       (SELECT COUNT(*) FROM mcq_attempts WHERE mcq_id='p1probe-mcq') AS attempts_after;
DELETE FROM users WHERE id='p1probe-user';
```

Both counts must be `0`. Always delete the probe user afterwards so the local database is left clean.

### Manual smoke checklist (Phase 5)

Run after `npm run preview` starts, typically at `http://localhost:8787`:

1. Log in, land on `/mcqs`, confirm the empty state on a fresh database
2. Create a question with two choices — it appears in the table
3. Create a second question with six choices — the Add choice button disables at six
4. Edit the first question: change the name and question text, add a choice, remove a choice, change the correct answer, save
5. Preview a question, submit a wrong answer, confirm the correct answer is shown
6. Try again, submit the right answer, confirm the success result
7. Confirm both attempts exist: `npx wrangler d1 execute quizmaker-db --local --command "SELECT * FROM mcq_attempts"`
8. Delete a question through the dropdown and confirm the dialog
9. Confirm the cascade: `npx wrangler d1 execute quizmaker-db --local --command "SELECT COUNT(*) FROM mcq_choices WHERE mcq_id = '<deleted-id>'"` returns 0, and the same for `mcq_attempts`
10. Log out and confirm the redirect to `/login`

---

## Notes for AI Agents

When working with this PRD:

1. Read the Problem and Hypothesis first to understand intent.
2. Use Scope (In/Out/Cut) to set boundaries — do not build authentication, permissions, quizzes, search, or attempt reporting.
3. **Follow TDD with Vitest in every phase**: write failing tests → `npm test` (red) → implement → `npm test` (green). Never implement before the phase's tests exist.
4. Load `.cursor/skills/testing/SKILL.md` before writing or running tests.
5. Mirror the existing patterns exactly: `user-service.ts` for the service, `api/auth/*/route.ts` for routes, `login-form.tsx` for client forms.
6. A phase is complete only when Vitest is green **and** every "Phase completion" box is checked.
6a. **Stop at the end of every phase and wait for the user's review.** Never roll straight into the next phase. Commits, pushes, and deploys happen only when the user asks, onto one shared feature branch, one commit per phase.
7. Update the phase status markers as work progresses.
8. Add implementation details under "Technical Implementation Details" as code is written.
9. Mark acceptance criteria complete when features actually work, not when they look finished.
10. Add troubleshooting entries when bugs are found and fixed.
11. Use `filepath:line-number` when citing code.
12. Never apply D1 migrations to the remote database, and never run `npm run deploy` unless explicitly asked.
13. Ask before adding npm dependencies. The three shadcn component additions are pre-approved in the Dependencies section.
14. Test database behaviour with `npm run preview`, not `npm run dev`.

---

## Current Status

**Last Updated**: September 1, 2026
**Current Phase**: Phase 2 - MCQ Service (complete), awaiting review
**Status**: Phase 2 COMPLETED — `npm test` green (74 tests, 12 files), `npm run lint` clean
**Next Steps**: Awaiting user review of Phase 2. On approval, commit and push Phase 2 to `feature/mcq-v1`, then begin Phase 3 (API Endpoints).
