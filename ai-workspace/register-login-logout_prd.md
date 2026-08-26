Date created: August 26, 2026
Date last modified: August 26, 2026

# Register, Login, and Logout - Technical PRD

## Overview/Problem

The Quiz Maker application is a collaborative tool for teachers to build a shared test bank of multiple-choice questions. Before any teacher can contribute questions, the app must know who they are. Today there is no user identity layer — anyone who reaches the app sees the same anonymous starter page with no way to register, sign in, or sign out.

Teachers need a simple account system so multiple users can create profiles and access the application. This phase delivers that foundation: a `users` table, a user service, register/login/logout API endpoints, and a stub MCQ page that successful authentication flows into. MCQ creation, collaboration features, and persistent sessions are intentionally deferred.

---

## Hypothesis

We believe that providing basic username-and-password registration and login will let multiple teachers create accounts and reach the MCQ workspace, establishing the identity layer required for future collaborative question-bank features.

---

## Scope

### In Scope

What will be built in this feature:

- **Database**: Cloudflare D1 `users` table with migration, storing hashed passwords and profile fields (first name, last name, username, email).
- **User service** (`src/lib/services/user-service.ts`): server-side module with create, read-by-username/email, update, and delete operations backed by D1 prepared statements.
- **Password hashing (client)**: the browser hashes the plaintext password with a deterministic algorithm before sending it in HTTP POST bodies during register and login.
- **Password storage (server)**: the API receives the client hash and applies a second server-side hash (salted) before persisting to D1. Login compares server-side hashes of the submitted client hash against the stored value.
- **API endpoints**:
  - `POST /api/auth/register` — create a new user
  - `POST /api/auth/login` — verify credentials
  - `POST /api/auth/logout` — acknowledge logout (no server-side session to destroy)
- **UI pages**:
  - `/register` — registration form
  - `/login` — login form
  - `/mcqs` — stub page reached after successful register or login
- **Input validation**: Zod schemas for all API request bodies and form submissions.
- **Error handling**: clear validation and auth-failure messages on forms and API responses.
- **Unit tests (TDD with Vitest)**: Vitest test suite colocated with source files; tests are written **before** implementation in every phase and must go from red to green as code is added.

### Out of Scope

What is explicitly not being built now but may be considered later:

- Social / OAuth login (Google, Microsoft, etc.)
- JWT, API tokens, or bearer-token authentication
- Session management (cookies, server-side sessions, refresh tokens)
- Protected routes / auth middleware (anyone can navigate to `/mcqs` by URL for now)
- Password reset or email verification
- MCQ CRUD, question banks, or teacher collaboration
- User profile editing UI (update/delete exist in the service for future use)
- Role-based access control (admin vs teacher)

### Cut

Things that were considered during planning but deliberately removed (and why):

- **Server Actions instead of API routes** — the project convention prefers Server Actions for form mutations, but this sprint explicitly calls for HTTP POST endpoints backed by a user service. Endpoints are the deliverable.
- **Plaintext or single-layer hashing only** — storing plaintext passwords is unacceptable; client-only hashing without a server-side salt is insufficient for database compromise scenarios, so both layers are required.
- **Persistent login state** — without sessions or tokens, "logged in" is represented only by client-side navigation to `/mcqs`. Logout clears no server state because none exists.
- **Username separate from email as a hard requirement** — username and email are separate columns, but they may hold the same value. No uniqueness constraint across both combined; each column is individually unique.

---

## Technical Requirements

### Database Schema

D1 is SQLite. The binding name in `wrangler.jsonc` will be `DB`. All schema changes go through Wrangler migrations.

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_username ON users (username);
CREATE INDEX idx_users_email ON users (email);
```

**Column notes:**

| Column | Type | Notes |
|--------|------|-------|
| `id` | TEXT | Random hex string primary key (D1 convention) |
| `first_name` | TEXT | Required, 1–100 characters |
| `last_name` | TEXT | Required, 1–100 characters |
| `username` | TEXT | Required, unique, 3–50 characters, alphanumeric + underscore |
| `email` | TEXT | Required, unique, valid email format |
| `password_hash` | TEXT | Server-side hash of the client-submitted password hash |
| `created_at` | DATETIME | Set on insert |
| `updated_at` | DATETIME | Set on insert and update |

**Migration steps (local only):**

1. `npx wrangler d1 create quizmaker-db`
2. Add `d1_databases` block to `wrangler.jsonc` with binding `DB`
3. `npm run cf-typegen`
4. `npx wrangler d1 migrations create quizmaker-db create_users_table`
5. Write the SQL above into the generated migration file
6. `npx wrangler d1 migrations apply quizmaker-db --local`

Never apply migrations to the remote database from an agent session.

### API Endpoints

All endpoints live under `src/app/api/auth/`. Request and response bodies are JSON. Password fields contain the **client-side hash**, never plaintext.

#### POST /api/auth/register

Creates a new user account.

**Request Body:**

```json
{
  "firstName": "Jane",
  "lastName": "Smith",
  "username": "jsmith",
  "email": "jsmith@school.edu",
  "passwordHash": "<client-hashed-password>"
}
```

**Response:**

- Success (201):
  ```json
  {
    "success": true,
    "user": {
      "id": "abc123",
      "firstName": "Jane",
      "lastName": "Smith",
      "username": "jsmith",
      "email": "jsmith@school.edu"
    }
  }
  ```
- Error (400): Validation failure (missing fields, invalid email, username too short, etc.)
  ```json
  { "success": false, "error": "Validation failed", "details": [...] }
  ```
- Error (409): Username or email already exists
  ```json
  { "success": false, "error": "Username already taken" }
  ```
- Error (500): Unexpected server error
  ```json
  { "success": false, "error": "Internal server error" }
  ```

**Server behavior:**

1. Validate input with Zod.
2. Check username and email uniqueness via user service.
3. Apply server-side salted hash to `passwordHash`.
4. Insert user via user service.
5. Return user object without password fields.

#### POST /api/auth/login

Verifies credentials for an existing user.

**Request Body:**

```json
{
  "username": "jsmith",
  "passwordHash": "<client-hashed-password>"
}
```

`username` accepts either the username or email address (lookup tries username first, then email).

**Response:**

- Success (200):
  ```json
  {
    "success": true,
    "user": {
      "id": "abc123",
      "firstName": "Jane",
      "lastName": "Smith",
      "username": "jsmith",
      "email": "jsmith@school.edu"
    }
  }
  ```
- Error (400): Validation failure
- Error (401): Invalid username or password (generic message — do not reveal which field failed)
  ```json
  { "success": false, "error": "Invalid username or password" }
  ```
- Error (500): Unexpected server error

**Server behavior:**

1. Validate input with Zod.
2. Look up user by username or email.
3. Compare server-side hash of submitted `passwordHash` against stored `password_hash`.
4. Return user object on match; 401 on mismatch or user not found.

#### POST /api/auth/logout

Acknowledges a logout request. Because there is no session or token state, this endpoint is a no-op on the server.

**Request Body:** none required

**Response:**

- Success (200):
  ```json
  { "success": true }
  ```

**Client behavior:** after a successful response, navigate the user to `/login`. No cookies are cleared because none were set.

### User Interface Requirements

Use shadcn/ui components (`field`, `input`, `button`, `card`, `label`) and Tailwind theme tokens. Forms are client components that hash the password in the browser, then POST JSON to the API routes.

#### Register Page (`/register`)

- Card layout with title "Create your account"
- Form fields:
  - First name — required, 1–100 characters
  - Last name — required, 1–100 characters
  - Username — required, 3–50 characters, alphanumeric and underscore only
  - Email — required, valid email format
  - Password — required, minimum 8 characters (validated before client-side hashing)
  - Confirm password — required, must match password
- On submit:
  1. Validate fields client-side
  2. Hash password with Web Crypto (see Implementation Details)
  3. `POST /api/auth/register` with hashed password
  4. On success → redirect to `/mcqs`
  5. On error → display message via `FieldError` or a banner
- Link to `/login` for users who already have an account

#### Login Page (`/login`)

- Card layout with title "Sign in"
- Form fields:
  - Username or email — required
  - Password — required
- On submit:
  1. Hash password client-side
  2. `POST /api/auth/login`
  3. On success → redirect to `/mcqs`
  4. On error → display "Invalid username or password"
- Link to `/register` for new users

#### MCQ Stub Page (`/mcqs`)

- Simple placeholder page confirming the user reached the authenticated destination
- Heading: "MCQ Question Bank" (or similar)
- Body text: "Question bank features coming soon."
- Display the returned user's first name if available in client state (optional; no session persistence required)
- Logout button that calls `POST /api/auth/logout` then redirects to `/login`
- No MCQ list, create, edit, or delete functionality

#### Home Page (`/`)

- Update the starter page to link to `/login` and `/register` rather than the default Next.js content

---

## Test-Driven Development with Vitest

This feature is built using **test-driven development (TDD)** with **Vitest** — the project's preferred testing framework (see `.cursor/skills/testing/SKILL.md`). Vitest is not installed in the starter; it is set up once at the beginning of Phase 1.

In **every phase**, the agent writes Vitest tests first. Those tests **fail (red)** because the code under test does not exist yet. As implementation progresses, the same tests **pass (green)**. Red → green is the primary automated signal that the phase is on track. Combined with each phase's acceptance criteria (below), this determines when a phase is complete.

### Preferred test stack (Vitest)

| Package | Purpose |
|---------|---------|
| `vitest` | Test runner and assertions (`describe`, `it`, `expect`, `vi`) |
| `@vitejs/plugin-react` | Transform React/TSX in tests |
| `@testing-library/react` | Render client components; query by role and accessible name |
| `@testing-library/user-event` | Realistic user interaction in component tests |
| `jsdom` | Browser-like DOM for component tests |
| `vite-tsconfig-paths` | Resolves `@/` imports in tests |

**One-time setup (Phase 1, before any feature tests):**

```bash
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/user-event jsdom vite-tsconfig-paths
```

Add `vitest.config.ts` at the repo root:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    globals: true,
  },
});
```

Add scripts to `package.json`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

### TDD workflow (every phase)

1. **Red** — Write Vitest tests for the phase. Run `npm test`. Confirm new tests **fail for the right reason** (missing module, unimplemented export, wrong return value). Fix harness errors before proceeding; intended failures are the signal.
2. **Green** — Implement the minimum production code to make those tests pass. Run `npm test` again until all phase tests and prior-phase tests pass.
3. **Refactor** — Clean up while keeping `npm test` green.
4. **Gate** — Mark the phase complete only when **both** signals are satisfied:
   - **Vitest green**: `npm test` exits 0; all new and existing tests pass
   - **Phase acceptance criteria**: every checkbox in that phase's "Phase completion" section is checked

Do not write production code before its Vitest tests exist for that phase.

### Vitest conventions

| Rule | Detail |
|------|--------|
| Colocation | `src/lib/foo.ts` → `src/lib/foo.test.ts`; pages → `page.test.tsx` |
| Mock boundaries | Mock D1 and `getCloudflareContext()` with `vi.mock`; unit tests never hit a real database or network |
| Meaningful assertions | No hollow tests (`expect(true).toBe(true)`). Assert outputs and failure paths |
| Isolation | Reset mocks in `beforeEach(() => vi.clearAllMocks())`. Each test passes when run alone |
| Run commands | `npm test` (CI / phase gate) or `npm run test:watch` (during development) |
| React components | Use Testing Library; query by role/name; prefer `userEvent` over `fireEvent` |
| Server Components | Do not render with Testing Library; test extracted logic as plain functions |

### Agent checklist (repeat every phase)

- [ ] Vitest tests for this phase written **before** production code
- [ ] `npm test` run — new tests fail (red) for expected reasons
- [ ] Production code implemented
- [ ] `npm test` run — all tests pass (green); no regressions
- [ ] Phase acceptance criteria checkboxes marked complete

---

## Implementation Phases

### Phase 1: Database - COMPLETED

**Objective**: Set up Vitest, Cloudflare D1, and persist the `users` table schema locally.

#### Vitest test plan (write these first — expect red)

**File**: `src/lib/db.test.ts`

| Test case | Red signal | Green signal |
|-----------|------------|--------------|
| `getDatabase` returns `env.DB` from mocked `getCloudflareContext()` | Import or function missing; returns undefined | Returns the mocked D1 binding |
| `getDatabase` throws or rejects when binding is absent | N/A or passes prematurely | Clear error when `env.DB` is missing |

**File**: `migrations/migrations.test.ts` (optional)

| Test case | Red signal | Green signal |
|-----------|------------|--------------|
| Migration SQL creates `users` table with required columns | Migration file missing or SQL incomplete | `CREATE TABLE users` includes `id`, `first_name`, `last_name`, `username`, `email`, `password_hash`, `created_at`, `updated_at` |
| Migration SQL creates username and email indexes | Indexes not in SQL | `idx_users_username` and `idx_users_email` present |

**Harness setup (before feature tests):**

1. Install Vitest packages and add `vitest.config.ts` + `npm test` script
2. Run `npm test` with only harness smoke test if needed — confirm runner works

#### Implementation tasks (after red)

1. Write Vitest tests above; run `npm test` — confirm new tests **fail (red)**
2. Create D1 database and add binding to `wrangler.jsonc`
3. Run `npm run cf-typegen`
4. Create and apply local migration for `users` table
5. Implement `src/lib/db.ts` to obtain `env.DB` via `getCloudflareContext()`
6. Run `npm test` — confirm all Phase 1 tests **pass (green)**

#### Phase completion

A phase is done when Vitest is green **and** every box below is checked:

- [x] Vitest installed and configured; `npm test` runs
- [x] `src/lib/db.test.ts` written before `src/lib/db.ts`
- [x] `npm test` passes (green) for Phase 1 tests
- [x] `wrangler.jsonc` D1 binding configured
- [x] Migration file exists in `migrations/` and applied locally
- [x] `users` table schema matches PRD (supports acceptance: "table exists via migration")

**Deliverables**: `vitest.config.ts`, `src/lib/db.test.ts`, `wrangler.jsonc`, migration file, `src/lib/db.ts`

---

### Phase 2: User Service - COMPLETED

**Objective**: Build the server-side user service layer backed by D1.

#### Vitest test plan (write these first — expect red)

**File**: `src/lib/services/user-service.test.ts`  
Mock `@/lib/db` or D1 prepared statements with `vi.mock`; never use a real database.

| Test case | Red signal | Green signal |
|-----------|------------|--------------|
| `createUser` inserts row and returns user without `password_hash` | Function missing or returns hash | User object returned; password hash not exposed |
| `getUserByUsername` returns user when found | Returns null always | Returns matching user |
| `getUserByUsername` returns null when not found | Throws or returns wrong shape | Returns null |
| `getUserByEmail` returns user when found | Same as above | Returns matching user |
| `updateUser` updates fields and returns updated user | No-op or wrong fields | Updated user returned |
| `deleteUser` removes user by id | User still "exists" in mock | Delete called; success returned |
| `hashPassword` produces stable salted output | Missing or returns plaintext | Non-empty hash string, not equal to input |
| `verifyPassword` returns true for matching hash | Always false | True on correct client hash |
| `verifyPassword` returns false for wrong hash | Always true | False on mismatch |
| `createUser` rejects duplicate username | Duplicate allowed | Throws or returns conflict error |
| `createUser` rejects duplicate email | Duplicate allowed | Throws or returns conflict error |

#### Implementation tasks (after red)

1. Propose Workers-compatible hashing utility if needed beyond Web Crypto PBKDF2
2. Write Vitest tests above; run `npm test` — confirm new tests **fail (red)**
3. Implement `src/lib/services/user-service.ts` with CRUD + `hashPassword` / `verifyPassword`
4. Run `npm test` — confirm Phase 1 + Phase 2 tests **pass (green)**

#### Phase completion

- [x] `user-service.test.ts` written before `user-service.ts`
- [x] `npm test` passes (green) for Phase 1 and Phase 2 tests
- [x] User service exposes create, read (by username/email), update, delete
- [x] Passwords stored as server-side hash only (supports acceptance: "never plaintext in D1")

**Deliverables**: `src/lib/services/user-service.test.ts`, `src/lib/services/user-service.ts`

---

### Phase 3: API Endpoints - COMPLETED

**Objective**: Expose register, login, and logout over HTTP.

#### Vitest test plan (write these first — expect red)

**File**: `src/lib/validations/auth.test.ts`

| Test case | Red signal | Green signal |
|-----------|------------|--------------|
| Register schema rejects missing required fields | Accepts empty object | Validation error |
| Register schema rejects invalid email | Accepts `"not-an-email"` | Validation error |
| Register schema rejects short username | Accepts `"ab"` | Validation error |
| Register schema accepts valid register payload | Rejects valid input | Parsed object returned |
| Login schema rejects empty username or passwordHash | Accepts empty | Validation error |
| Login schema accepts valid login payload | Rejects valid input | Parsed object returned |

**File**: `src/app/api/auth/register/route.test.ts`  
Mock user service with `vi.mock("@/lib/services/user-service")`.

| Test case | Red signal | Green signal |
|-----------|------------|--------------|
| POST register returns 201 and user on success | 404 or 500 | 201 + `{ success: true, user }` without password |
| POST register returns 400 on invalid body | 201 on bad input | 400 + validation error |
| POST register returns 409 on duplicate username/email | 201 on duplicate | 409 + clear error message |

**File**: `src/app/api/auth/login/route.test.ts`

| Test case | Red signal | Green signal |
|-----------|------------|--------------|
| POST login returns 200 and user on valid credentials | 401 always | 200 + `{ success: true, user }` |
| POST login returns 401 on wrong password | 200 on bad password | 401 + `"Invalid username or password"` |
| POST login returns 401 on unknown user | 404 or 500 | 401 + generic message (no enumeration) |
| POST login returns 400 on invalid body | 401 on empty body | 400 + validation error |

**File**: `src/app/api/auth/logout/route.test.ts`

| Test case | Red signal | Green signal |
|-----------|------------|--------------|
| POST logout returns 200 with `{ success: true }` | 404 or missing route | 200 + `{ success: true }` |

#### Implementation tasks (after red)

1. Add approved dependency: `zod`
2. Write all Vitest tests above; run `npm test` — confirm new tests **fail (red)**
3. Implement `src/lib/validations/auth.ts`
4. Implement `register`, `login`, and `logout` route handlers
5. Run `npm test` — confirm all tests **pass (green)**
6. Smoke-test with `npm run preview` (real D1 binding)

#### Phase completion

- [x] Validation and route tests written before route implementations
- [x] `npm test` passes (green) for Phases 1–3
- [x] Register returns 201 / 400 / 409 as specified
- [x] Login returns 200 / 401 / 400 as specified; generic error on failure
- [x] Logout returns 200

**Deliverables**: `auth.test.ts`, three `route.test.ts` files, `auth.ts` schemas, three route handlers

---

### Phase 4: Frontend Pages - PLANNED

**Objective**: Teachers can register, log in, log out, and land on the MCQ stub.

#### Vitest test plan (write these first — expect red)

**File**: `src/lib/password-client.test.ts`

| Test case | Red signal | Green signal |
|-----------|------------|--------------|
| Same plaintext produces same SHA-256 hex hash | Different hash each call or missing export | Deterministic hex string |
| Different plaintext produces different hash | Same hash for different inputs | Hashes differ |
| Hash is never plaintext | Returns input unchanged | Output ≠ input |

**File**: `src/app/register/page.test.tsx`  
Mock `fetch`; use `@testing-library/react` + `userEvent`.

| Test case | Red signal | Green signal |
|-----------|------------|--------------|
| Renders all registration fields | Missing fields in DOM | first name, last name, username, email, password, confirm visible |
| Submit sends POST with hashed password (not plaintext) | Plaintext in body or no fetch | `passwordHash` in JSON; no raw password field |
| Shows error on API failure | No error shown | Error message visible |
| Redirects to `/mcqs` on success | Stays on page | Navigation to `/mcqs` triggered |

**File**: `src/app/login/page.test.tsx`

| Test case | Red signal | Green signal |
|-----------|------------|--------------|
| Renders username and password fields | Missing fields | Both fields visible |
| Submit sends hashed password | Plaintext sent | `passwordHash` in request body |
| Shows generic error on 401 | No error or specific field hint | "Invalid username or password" shown |
| Redirects to `/mcqs` on success | Stays on page | Navigation triggered |

**File**: `src/app/mcqs/page.test.tsx`

| Test case | Red signal | Green signal |
|-----------|------------|--------------|
| Renders stub heading and placeholder text | Empty or wrong content | MCQ stub copy visible |
| Logout button calls POST `/api/auth/logout` | No fetch | Logout endpoint called |
| Logout navigates to `/login` | Stays on `/mcqs` | Redirect to `/login` |

#### Implementation tasks (after red)

1. Write Vitest tests above; run `npm test` — confirm new tests **fail (red)**
2. Implement `src/lib/password-client.ts`
3. Build `/register`, `/login`, `/mcqs` pages and update `/` home page
4. Run `npm test` — confirm all tests **pass (green)**
5. Verify full flow in browser via `npm run preview`

#### Phase completion

- [ ] Frontend tests written before page implementations
- [ ] `npm test` passes (green) for Phases 1–4
- [ ] Client hashes password before POST (supports acceptance: "hashed in browser")
- [ ] Register and login redirect to `/mcqs` on success
- [ ] Logout calls API and redirects to `/login`

**Deliverables**: four test files, `password-client.ts`, four pages

---

### Phase 5: Verification - PLANNED

**Objective**: Confirm the full feature meets global acceptance criteria.

#### Vitest test plan (no new tests unless gaps found)

Run the **complete Vitest suite** built across Phases 1–4. Any failing test must be fixed before sign-off. Add new tests only if manual preview reveals behavior not covered by existing tests (write test first, then fix — still TDD).

| Check | Red signal | Green signal |
|-------|------------|--------------|
| Full Vitest suite | Any test failure | `npm test` exits 0 |
| Lint | ESLint errors | `npm run lint` exits 0 |
| Build | Compile errors | `npm run build` succeeds |
| Preview smoke | Manual flow broken | Register → `/mcqs`, login → `/mcqs`, logout → `/login`, duplicate → error |

#### Implementation tasks

1. Run `npm test` — entire suite **green**
2. Run `npm run lint` — zero errors
3. Run `npm run build` — succeeds
4. Run `npm run preview` — end-to-end manual flows
5. Mark global acceptance criteria below
6. Record manual test notes in Troubleshooting Guide if issues found

#### Phase completion

- [ ] `npm test` — full Vitest suite green (all phases)
- [ ] `npm run lint` passes
- [ ] `npm run build` succeeds
- [ ] Manual preview flows pass
- [ ] All global acceptance criteria (below) checked

**Deliverables**: Green CI-local checks; troubleshooting notes if any

---

## Technical Implementation Details

### Key Files

**Production**

- `wrangler.jsonc` — D1 database binding (`DB`)
- `migrations/0001_create_users_table.sql` — users table schema
- `src/lib/db.ts` — D1 access via `getCloudflareContext()`
- `src/lib/services/user-service.ts` — user CRUD and password hashing
- `src/lib/validations/auth.ts` — Zod schemas for auth payloads
- `src/lib/password-client.ts` — browser-side password hashing before POST
- `src/app/api/auth/register/route.ts` — registration endpoint
- `src/app/api/auth/login/route.ts` — login endpoint
- `src/app/api/auth/logout/route.ts` — logout endpoint
- `src/app/register/page.tsx` — registration UI
- `src/app/login/page.tsx` — login UI
- `src/app/mcqs/page.tsx` — MCQ stub UI

**Tests (colocated, written before implementation)**

- `vitest.config.ts` — test runner configuration
- `src/lib/db.test.ts`
- `src/lib/services/user-service.test.ts`
- `src/lib/validations/auth.test.ts`
- `src/app/api/auth/register/route.test.ts`
- `src/app/api/auth/login/route.test.ts`
- `src/app/api/auth/logout/route.test.ts`
- `src/lib/password-client.test.ts`
- `src/app/register/page.test.tsx`
- `src/app/login/page.test.tsx`
- `src/app/mcqs/page.test.tsx`

### Implementation Patterns

**Obtaining the D1 binding (server-only):**

```typescript
import { getCloudflareContext } from "@opennextjs/cloudflare";

export function getDatabase() {
  const { env } = getCloudflareContext();
  return env.DB;
}
```

**D1 query with numbered placeholders:**

```typescript
const result = await db
  .prepare("SELECT * FROM users WHERE username = ?1")
  .bind(username)
  .all<UserRow>();

const user = result.results[0] ?? null;
```

**Client-side password hashing (browser, before POST):**

```typescript
export async function hashPasswordClient(plaintext: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}
```

**Server-side password hashing (Workers-compatible, after receiving client hash):**

```typescript
// Use Web Crypto PBKDF2 with a per-user or app-level salt stored alongside the hash.
// Exact implementation depends on the approved dependency; pattern:
// stored = `${salt}:${hex(pbkdf2(clientHash, salt, iterations))}`
```

**Mocking D1 in tests (write before importing server modules):**

```typescript
vi.mock("@opennextjs/cloudflare", () => ({
  getCloudflareContext: vi.fn(async () => ({
    env: { DB: mockDb },
  })),
}));
```

See `.cursor/skills/testing/SKILL.md` for full mocking patterns.

**Register flow (end-to-end):**

```
Browser: plaintext → SHA-256 → passwordHash
   ↓ POST /api/auth/register
Server:  validate → check uniqueness → PBKDF2(passwordHash) → INSERT → 201
   ↓
Browser: redirect → /mcqs
```

**Login flow (end-to-end):**

```
Browser: plaintext → SHA-256 → passwordHash
   ↓ POST /api/auth/login
Server:  validate → SELECT user → verify PBKDF2(passwordHash, stored) → 200 or 401
   ↓
Browser: redirect → /mcqs
```

### Important Notes

- **D1 requires Workers runtime.** Use `npm run preview` to test database operations. `npm run dev` runs on Node and will not expose the D1 binding.
- **Never log passwords or hashes** in server output.
- **Generic login errors** — always return "Invalid username or password" for failed lookups and failed comparisons to avoid user enumeration.
- **No session persistence** — the app does not remember who is logged in across page reloads. `/mcqs` is reachable by URL without authentication. Session management is a future sprint.
- **Dependency approval required** — `zod` and a hashing library are not in `package.json` yet. Propose and get approval before adding.
- **Prepared statements only** — never concatenate user input into SQL strings.

---

## Acceptance Criteria

Global criteria for feature sign-off (Phase 5). Phase-specific gates are in each phase's **Phase completion** section above.

**Automated (Vitest)**

- [ ] Vitest configured; `npm test` runs across all phases
- [ ] Tests were written **before** production code in each phase (TDD)
- [ ] `npm test` passes with zero failures (full suite green)

**Functional (covered by Vitest + manual preview)**

- [ ] A teacher can open `/register`, fill in first name, last name, username, email, and password, and create an account
- [ ] On successful registration, the user is redirected to `/mcqs`
- [ ] A teacher can open `/login`, enter username (or email) and password, and sign in
- [ ] On successful login, the user is redirected to `/mcqs`
- [ ] On the MCQ stub page, clicking Logout calls the logout endpoint and redirects to `/login`
- [ ] Registering with a duplicate username or email returns a clear error message
- [ ] Login with wrong credentials returns "Invalid username or password" without revealing which field failed
- [ ] Passwords are never stored in plaintext in D1
- [ ] Passwords are hashed in the browser before being sent in POST requests
- [ ] The `users` table exists via a Wrangler migration applied locally
- [ ] User service provides create, read, update, and delete methods

**Build quality**

- [ ] `npm run lint` passes with no errors
- [ ] `npm run build` succeeds

---

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Phase TDD signal | Red → green each phase | `npm test` fails before implementation, passes after |
| Registration completion | User reaches `/mcqs` after register | Vitest (Phase 4) + manual preview |
| Login completion | User reaches `/mcqs` after login | Vitest (Phase 4) + manual preview |
| Password security | Zero plaintext passwords in D1 | Vitest (Phase 2) + inspect local D1 |
| Duplicate prevention | Second register rejected | Vitest (Phase 3, 409) + manual preview |
| Build health | Lint, build, Vitest pass | `npm run lint && npm run build && npm test` |

---

## Dependencies

### External Dependencies

- **Cloudflare D1** — SQLite database for user storage (binding `DB` in `wrangler.jsonc`)
- **Web Crypto API** — client-side SHA-256 hashing (built into browsers; no package needed)
- **Web Crypto API (Workers)** — server-side PBKDF2 hashing (built into Workers runtime)

### Internal Dependencies

- **`@opennextjs/cloudflare`** — `getCloudflareContext()` for D1 access (already installed)
- **shadcn/ui components** — form UI (`field`, `input`, `button`, `card`) (already installed)
- **`.cursor/skills/testing/SKILL.md`** — Vitest setup, mocking, and quality rules (project standard)

### New Dependencies (require approval before adding)

- **Vitest stack (Phase 1, required before feature tests)**: `vitest`, `@vitejs/plugin-react`, `@testing-library/react`, `@testing-library/user-event`, `jsdom`, `vite-tsconfig-paths`
- **`zod`** — request and form validation (Phase 3)
- **Hashing library (TBD)** — if Web Crypto PBKDF2 alone is insufficient, propose an edge-compatible option such as `@noble/hashes` (Phase 2)

### Environment Variables

No new secrets required for this feature. D1 binding is configured in `wrangler.jsonc`, not `.dev.vars`.

---

## Risks and Mitigation

### Technical Risks

- **Risk**: Agent implements code before tests, losing TDD feedback loop.
- **Mitigation**: PRD mandates tests-first in every phase; phase is incomplete until `npm test` is green.

- **Risk**: Hollow tests that always pass without testing real behavior.
- **Mitigation**: Follow `.cursor/skills/testing/SKILL.md`; assert on outputs and failure paths, not implementation internals.

- **Risk**: D1 binding unavailable during `npm run dev`, leading to false "it works" conclusions.
- **Mitigation**: Document and test with `npm run preview`. Note in acceptance testing checklist.

- **Risk**: Client-side hashing alone does not protect against database compromise if the server stores the client hash directly without salting.
- **Mitigation**: Apply a second server-side salted hash (PBKDF2) before persistence. Never store the raw client hash.

- **Risk**: bcrypt and other Node-native crypto libraries may fail on Cloudflare Workers.
- **Mitigation**: Use Web Crypto PBKDF2 or an edge-tested library. Verify in `npm run preview`.

- **Risk**: Without sessions, "authentication" is not enforced on `/mcqs`.
- **Mitigation**: Explicitly documented as out of scope. Stub page is a navigation target, not a protected resource.

### User Experience Risks

- **Risk**: Users expect to stay logged in after closing the browser.
- **Mitigation**: Acceptable for this sprint. Session management is a future phase; stub page copy can note this is early access.

- **Risk**: Password reset unavailable if a user forgets their password.
- **Mitigation**: Out of scope. Document for future sprint.

---

## Troubleshooting Guide

_(Entries will be added during implementation.)_

---

## Notes for AI Agents

When working with this PRD:

1. Start by reading the Problem and Hypothesis to understand intent.
2. Use Scope (In/Out/Cut) to determine boundaries — do not build MCQ features, sessions, or tokens.
3. **Follow TDD with Vitest in every phase**: write failing Vitest tests → run `npm test` (red) → implement → run `npm test` (green). Never implement before tests exist for that phase.
4. Load `.cursor/skills/testing/SKILL.md` whenever setting up, writing, or running Vitest tests.
5. A phase is complete only when **Vitest is green** and that phase's **Phase completion** checkboxes are all checked.
6. Update phase status markers as work progresses.
7. Add implementation details under "Technical Implementation Details" as code is written.
8. Mark acceptance criteria as complete when features work.
9. Add troubleshooting entries when bugs are found and fixed.
10. Keep all sections current — remove outdated information.
11. Use code references format: `filepath:line-number` when citing code.
12. Never apply D1 migrations to the remote database.
13. Ask before adding dependencies (Vitest stack, `zod`, hashing libraries).
14. Test database features with `npm run preview`, not `npm run dev`. Vitest unit tests mock D1; preview validates real binding behavior.

---

## Current Status

**Last Updated**: August 26, 2026
**Current Phase**: Phase 4 - Frontend Pages
**Status**: PLANNED (Phase 3 complete — awaiting review)
**Next Steps**: Review Phase 3; on approval commit and push to `feature/register-login-logout`. Then begin Phase 4.
