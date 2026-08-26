import { z } from "zod";

export const registerSchema = z.object({
	firstName: z.string().trim().min(1).max(100),
	lastName: z.string().trim().min(1).max(100),
	username: z
		.string()
		.trim()
		.min(3)
		.max(50)
		.regex(/^[a-zA-Z0-9_]+$/),
	email: z.string().trim().email(),
	passwordHash: z.string().min(1),
});

export const loginSchema = z.object({
	username: z.string().trim().min(1),
	passwordHash: z.string().min(1),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export function formatValidationDetails(error: z.ZodError) {
	return error.issues.map((issue) => ({ message: issue.message }));
}
