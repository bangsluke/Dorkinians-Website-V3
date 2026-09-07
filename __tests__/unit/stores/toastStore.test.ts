import { useToastStore } from "@/lib/stores/toast";

describe("Toast store", () => {
	beforeEach(() => {
		useToastStore.getState().clear();
	});

	test("queues toasts that any caller can read", () => {
		const firstId = useToastStore.getState().show("Filters reset", "success");
		const secondId = useToastStore.getState().show("Failed to load", "error", 3000);

		const toasts = useToastStore.getState().toasts;
		expect(toasts).toHaveLength(2);
		expect(toasts[0]).toEqual({ id: firstId, message: "Filters reset", type: "success", duration: undefined });
		expect(toasts[1]).toEqual({ id: secondId, message: "Failed to load", type: "error", duration: 3000 });
	});

	test("dismiss removes one toast without touching the rest", () => {
		const keepId = useToastStore.getState().show("Keep me", "info");
		const dropId = useToastStore.getState().show("Drop me", "warning");

		useToastStore.getState().dismiss(dropId);

		const toasts = useToastStore.getState().toasts;
		expect(toasts).toHaveLength(1);
		expect(toasts[0].id).toBe(keepId);
	});

	test("clear empties the queue", () => {
		useToastStore.getState().show("One", "success");
		useToastStore.getState().show("Two", "info");
		useToastStore.getState().clear();
		expect(useToastStore.getState().toasts).toEqual([]);
	});
});
