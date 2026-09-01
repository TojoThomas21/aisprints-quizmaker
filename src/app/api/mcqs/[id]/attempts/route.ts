import {
	McqNotFoundError,
	McqValidationError,
	createAttempt,
	listAttemptsByMcq,
} from "@/lib/services/mcq-service";
import { createAttemptSchema, formatValidationDetails } from "@/lib/validations/mcq";
import { NextResponse } from "next/server";

type RouteContext = {
	params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
	try {
		const { id } = await params;
		const attempts = await listAttemptsByMcq(id);
		return NextResponse.json({ success: true, attempts }, { status: 200 });
	} catch (error) {
		if (error instanceof McqNotFoundError) {
			return NextResponse.json({ success: false, error: error.message }, { status: 404 });
		}

		return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
	}
}

export async function POST(request: Request, { params }: RouteContext) {
	try {
		const { id } = await params;
		const body = await request.json();
		const parsed = createAttemptSchema.safeParse(body);

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

		const attempt = await createAttempt(id, parsed.data);
		return NextResponse.json({ success: true, attempt }, { status: 201 });
	} catch (error) {
		if (error instanceof McqValidationError) {
			return NextResponse.json({ success: false, error: error.message }, { status: 400 });
		}

		if (error instanceof McqNotFoundError) {
			return NextResponse.json({ success: false, error: error.message }, { status: 404 });
		}

		return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
	}
}
