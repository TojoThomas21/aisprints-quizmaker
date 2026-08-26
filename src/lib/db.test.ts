import { getCloudflareContext } from "@opennextjs/cloudflare";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@opennextjs/cloudflare", () => ({
	getCloudflareContext: vi.fn(),
}));

describe("getDatabase", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("returns env.DB from getCloudflareContext", async () => {
		const mockDb = { prepare: vi.fn() };
		vi.mocked(getCloudflareContext).mockResolvedValue({
			env: { DB: mockDb },
		} as never);

		const { getDatabase } = await import("@/lib/db");
		const db = await getDatabase();

		expect(db).toBe(mockDb);
		expect(getCloudflareContext).toHaveBeenCalledWith({ async: true });
	});

	it("throws when DB binding is absent", async () => {
		vi.mocked(getCloudflareContext).mockResolvedValue({
			env: {},
		} as never);

		const { getDatabase } = await import("@/lib/db");

		await expect(getDatabase()).rejects.toThrow(/DB/i);
	});
});
