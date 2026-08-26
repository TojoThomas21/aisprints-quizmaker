import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default function Home() {
	return (
		<div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
			<div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
				<div className="space-y-2">
					<h1 className="text-3xl font-semibold tracking-tight">Quiz Maker</h1>
					<p className="text-muted-foreground">
						Collaborate with other teachers to build a shared test bank of multiple-choice questions.
					</p>
				</div>
				<div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
					<Link href="/login" className={buttonVariants()}>
						Sign in
					</Link>
					<Link href="/register" className={buttonVariants({ variant: "outline" })}>
						Create account
					</Link>
				</div>
			</div>
		</div>
	);
}
