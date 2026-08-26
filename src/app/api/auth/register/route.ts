import { DuplicateUserError, createUser } from "@/lib/services/user-service";
import { formatValidationDetails, registerSchema } from "@/lib/validations/auth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
	try {
		const body = await request.json();
		const parsed = registerSchema.safeParse(body);

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

		const user = await createUser(parsed.data);
		return NextResponse.json({ success: true, user }, { status: 201 });
	} catch (error) {
		if (error instanceof DuplicateUserError) {
			return NextResponse.json({ success: false, error: error.message }, { status: 409 });
		}

		return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
	}
}
