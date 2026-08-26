import { authenticateUser } from "@/lib/services/user-service";
import { formatValidationDetails, loginSchema } from "@/lib/validations/auth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
	try {
		const body = await request.json();
		const parsed = loginSchema.safeParse(body);

		if (!parsed.success) {
			return NextResponse.json(
				{
					success: false,
					error: "Validation failed",
					details: formatValidationDetails(parsed.error),
				},
				{ status: 400 },
			);
		}

		const user = await authenticateUser(parsed.data.username, parsed.data.passwordHash);

		if (!user) {
			return NextResponse.json(
				{ success: false, error: "Invalid username or password" },
				{ status: 401 },
			);
		}

		return NextResponse.json({ success: true, user }, { status: 200 });
	} catch {
		return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
	}
}
