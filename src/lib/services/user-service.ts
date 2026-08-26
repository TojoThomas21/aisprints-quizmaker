import { getDatabase } from "@/lib/db";

const PBKDF2_ITERATIONS = 100_000;
const PBKDF2_KEY_LENGTH = 256;

export class DuplicateUserError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "DuplicateUserError";
	}
}

export type User = {
	id: string;
	firstName: string;
	lastName: string;
	username: string;
	email: string;
	createdAt: string;
	updatedAt: string;
};

export type CreateUserInput = {
	firstName: string;
	lastName: string;
	username: string;
	email: string;
	passwordHash: string;
};

export type UpdateUserInput = Partial<Pick<CreateUserInput, "firstName" | "lastName" | "username" | "email">>;

type UserRow = {
	id: string;
	first_name: string;
	last_name: string;
	username: string;
	email: string;
	password_hash: string;
	created_at: string;
	updated_at: string;
};

function toPublicUser(row: UserRow): User {
	return {
		id: row.id,
		firstName: row.first_name,
		lastName: row.last_name,
		username: row.username,
		email: row.email,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	};
}

function bufferToHex(buffer: ArrayBuffer | Uint8Array): string {
	const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
	return Array.from(bytes)
		.map((byte) => byte.toString(16).padStart(2, "0"))
		.join("");
}

function hexToBuffer(hex: string): Uint8Array {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < hex.length; i += 2) {
		bytes[i / 2] = Number.parseInt(hex.slice(i, i + 2), 16);
	}
	return bytes;
}

function generateId(): string {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	return bufferToHex(bytes);
}

async function derivePbkdf2(clientHash: string, salt: Uint8Array): Promise<ArrayBuffer> {
	const keyMaterial = await crypto.subtle.importKey("raw", new TextEncoder().encode(clientHash), "PBKDF2", false, [
		"deriveBits",
	]);

	return crypto.subtle.deriveBits(
		{
			name: "PBKDF2",
			salt: new Uint8Array(salt),
			iterations: PBKDF2_ITERATIONS,
			hash: "SHA-256",
		},
		keyMaterial,
		PBKDF2_KEY_LENGTH,
	);
}

export async function hashPassword(clientHash: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(16));
	const derived = await derivePbkdf2(clientHash, salt);
	return `${bufferToHex(salt)}:${bufferToHex(derived)}`;
}

export async function verifyPassword(clientHash: string, storedHash: string): Promise<boolean> {
	const [saltHex, hashHex] = storedHash.split(":");
	if (!saltHex || !hashHex) {
		return false;
	}

	const derived = await derivePbkdf2(clientHash, hexToBuffer(saltHex));
	return bufferToHex(derived) === hashHex;
}

export async function getUserByUsername(username: string): Promise<User | null> {
	const db = await getDatabase();
	const result = await db
		.prepare("SELECT id, first_name, last_name, username, email, password_hash, created_at, updated_at FROM users WHERE username = ?1")
		.bind(username)
		.all<UserRow>();

	const row = result.results[0];
	return row ? toPublicUser(row) : null;
}

export async function getUserByEmail(email: string): Promise<User | null> {
	const db = await getDatabase();
	const result = await db
		.prepare("SELECT id, first_name, last_name, username, email, password_hash, created_at, updated_at FROM users WHERE email = ?1")
		.bind(email)
		.all<UserRow>();

	const row = result.results[0];
	return row ? toPublicUser(row) : null;
}

async function getUserRowByUsernameOrEmail(identifier: string): Promise<UserRow | null> {
	const db = await getDatabase();
	const byUsername = await db
		.prepare("SELECT id, first_name, last_name, username, email, password_hash, created_at, updated_at FROM users WHERE username = ?1")
		.bind(identifier)
		.all<UserRow>();

	if (byUsername.results[0]) {
		return byUsername.results[0];
	}

	const byEmail = await db
		.prepare("SELECT id, first_name, last_name, username, email, password_hash, created_at, updated_at FROM users WHERE email = ?1")
		.bind(identifier)
		.all<UserRow>();

	return byEmail.results[0] ?? null;
}

export async function authenticateUser(usernameOrEmail: string, clientHash: string): Promise<User | null> {
	const row = await getUserRowByUsernameOrEmail(usernameOrEmail);
	if (!row) {
		return null;
	}

	const valid = await verifyPassword(clientHash, row.password_hash);
	if (!valid) {
		return null;
	}

	return toPublicUser(row);
}

export async function createUser(input: CreateUserInput): Promise<User> {
	if (await getUserByUsername(input.username)) {
		throw new DuplicateUserError("Username already taken");
	}

	if (await getUserByEmail(input.email)) {
		throw new DuplicateUserError("Email already taken");
	}

	const passwordHash = await hashPassword(input.passwordHash);
	const id = generateId();
	const db = await getDatabase();

	await db
		.prepare(
			"INSERT INTO users (id, first_name, last_name, username, email, password_hash) VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
		)
		.bind(id, input.firstName, input.lastName, input.username, input.email, passwordHash)
		.run();

	const user = await getUserByUsername(input.username);
	if (!user) {
		throw new Error("Failed to create user");
	}

	return user;
}

export async function updateUser(id: string, data: UpdateUserInput): Promise<User> {
	const db = await getDatabase();
	const current = await db
		.prepare("SELECT id, first_name, last_name, username, email, password_hash, created_at, updated_at FROM users WHERE id = ?1")
		.bind(id)
		.all<UserRow>();

	const row = current.results[0];
	if (!row) {
		throw new Error("User not found");
	}

	const firstName = data.firstName ?? row.first_name;
	const lastName = data.lastName ?? row.last_name;
	const username = data.username ?? row.username;
	const email = data.email ?? row.email;

	await db
		.prepare(
			"UPDATE users SET first_name = ?1, last_name = ?2, username = ?3, email = ?4, updated_at = CURRENT_TIMESTAMP WHERE id = ?5",
		)
		.bind(firstName, lastName, username, email, id)
		.run();

	const updated = await db
		.prepare("SELECT id, first_name, last_name, username, email, password_hash, created_at, updated_at FROM users WHERE id = ?1")
		.bind(id)
		.all<UserRow>();

	const updatedRow = updated.results[0];
	if (!updatedRow) {
		throw new Error("Failed to update user");
	}

	return toPublicUser(updatedRow);
}

export async function deleteUser(id: string): Promise<void> {
	const db = await getDatabase();
	await db.prepare("DELETE FROM users WHERE id = ?1").bind(id).run();
}
