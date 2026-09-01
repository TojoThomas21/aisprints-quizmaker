import {
	McqNotFoundError,
	deleteMcq,
	getMcqById,
	updateMcq,
} from "@/lib/services/mcq-service";
import { formatValidationDetails, updateMcqSchema } from "@/lib/validations/mcq";
import { NextResponse } from "next/server";

type RouteContext = {
	params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
	try {
		const { id } = await params;
		const mcq = await getMcqById(id);

		if (!mcq) {
			return NextResponse.json({ success: false, error: "Question not found" }, { status: 404 });
		}

		return NextResponse.json({ success: true, mcq }, { status: 200 });
	} catch {
		return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
	}
}

export async function PUT(request: Request, { params }: RouteContext) {
	try {
		const { id } = await params;
		const body = await request.json();
		const parsed = updateMcqSchema.safeParse(body);

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

		const mcq = await updateMcq(id, parsed.data);
		return NextResponse.json({ success: true, mcq }, { status: 200 });
	} catch (error) {
		if (error instanceof McqNotFoundError) {
			return NextResponse.json({ success: false, error: error.message }, { status: 404 });
		}

		return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
	}
}

export async function DELETE(_request: Request, { params }: RouteContext) {
	try {
		const { id } = await params;
		await deleteMcq(id);
		return NextResponse.json({ success: true }, { status: 200 });
	} catch (error) {
		if (error instanceof McqNotFoundError) {
			return NextResponse.json({ success: false, error: error.message }, { status: 404 });
		}

		return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
	}
}
