"use client";

import { MoreVertical } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";

type McqListItem = {
	id: string;
	userId: string;
	name: string;
	question: string;
	choiceCount: number;
	createdAt: string;
	updatedAt: string;
};

export function McqTable() {
	const router = useRouter();
	const [mcqs, setMcqs] = useState<McqListItem[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [deleteTarget, setDeleteTarget] = useState<McqListItem | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);

	const loadMcqs = useCallback(async () => {
		setIsLoading(true);
		setError(null);

		try {
			const response = await fetch("/api/mcqs");
			const data = (await response.json()) as {
				success?: boolean;
				mcqs?: McqListItem[];
			};

			if (!response.ok || !data.success || !data.mcqs) {
				setError("Could not load questions. Please try again.");
				setMcqs([]);
				return;
			}

			setMcqs(data.mcqs);
		} catch {
			setError("Could not load questions. Please try again.");
			setMcqs([]);
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		// eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount
		void loadMcqs();
	}, [loadMcqs]);

	async function handleConfirmDelete() {
		if (!deleteTarget) {
			return;
		}

		setIsDeleting(true);

		try {
			const response = await fetch(`/api/mcqs/${deleteTarget.id}`, { method: "DELETE" });
			const data = (await response.json()) as { success?: boolean };

			if (!response.ok || !data.success) {
				setError("Could not delete the question. Please try again.");
				return;
			}

			setDeleteTarget(null);
			await loadMcqs();
		} catch {
			setError("Could not delete the question. Please try again.");
		} finally {
			setIsDeleting(false);
		}
	}

	if (isLoading) {
		return <p className="text-sm text-muted-foreground">Loading questions…</p>;
	}

	if (error) {
		return (
			<div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
				{error}
			</div>
		);
	}

	if (mcqs.length === 0) {
		return (
			<div className="flex flex-col items-center gap-4 rounded-lg border border-dashed p-8 text-center">
				<p className="text-sm text-muted-foreground">No questions yet. Create your first multiple-choice question.</p>
			</div>
		);
	}

	return (
		<>
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead>Name</TableHead>
						<TableHead>Question</TableHead>
						<TableHead className="w-[4rem] text-right">Actions</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{mcqs.map((mcq) => (
						<TableRow key={mcq.id}>
							<TableCell className="font-medium">{mcq.name}</TableCell>
							<TableCell className="max-w-md whitespace-normal">
								<p className="line-clamp-2">{mcq.question}</p>
							</TableCell>
							<TableCell className="text-right">
								<DropdownMenu>
									<DropdownMenuTrigger
										render={
											<Button
												variant="ghost"
												size="icon-sm"
												aria-label={`Actions for ${mcq.name}`}
											>
												<MoreVertical />
											</Button>
										}
									/>
									<DropdownMenuContent align="end">
										<DropdownMenuItem onClick={() => router.push(`/mcqs/${mcq.id}/edit`)}>
											Edit
										</DropdownMenuItem>
										<DropdownMenuItem onClick={() => router.push(`/mcqs/${mcq.id}/preview`)}>
											Preview
										</DropdownMenuItem>
										<DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(mcq)}>
											Delete
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							</TableCell>
						</TableRow>
					))}
				</TableBody>
			</Table>

			<Dialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
				<DialogContent showCloseButton={false}>
					<DialogHeader>
						<DialogTitle>Delete question?</DialogTitle>
						<DialogDescription>
							{deleteTarget
								? `"${deleteTarget.name}" and all of its choices and recorded attempts will be permanently removed.`
								: null}
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
							Cancel
						</Button>
						<Button variant="destructive" onClick={() => void handleConfirmDelete()} disabled={isDeleting}>
							Delete
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
