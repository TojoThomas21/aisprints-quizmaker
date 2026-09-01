import { createMcq, listMcqs } from "@/lib/services/mcq-service";
import { createMcqSchema, formatValidationDetails } from "@/lib/validations/mcq";
import { NextResponse } from "next/server";

export async function GET() {
	try {
		const mcqs = await listMcqs();
		return NextResponse.json({ success: true, mcqs }, { status: 200 });
	} catch {
		return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
	}
}

export async function POST(request: Request) {
	try {
		const body = await request.json();
		const parsed = createMcqSchema.safeParse(body);

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

		const mcq = await createMcq(parsed.data);
		return NextResponse.json({ success: true, mcq }, { status: 201 });
	} catch {
		return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
	}
}
