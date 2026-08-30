/** @jest-environment jsdom */
import React from "react";
import { act, render, screen } from "@testing-library/react";
import Toast from "@/components/ui/Toast";
import ToastContainer from "@/components/ui/ToastContainer";
import { useToastStore } from "@/lib/stores/toast";

describe("Toast", () => {
	beforeEach(() => {
		useToastStore.getState().clear();
	});

	test("every type uses the Filter-reset surface plus a semantic accent", () => {
		const { rerender } = render(
			React.createElement(Toast, { message: "Filters reset", type: "success", duration: 0 }),
		);

		let toast = screen.getByRole("status");
		expect(toast.className).toContain("bg-[var(--color-surface)]");
		expect(toast.className).toContain("border-[var(--color-border)]");
		expect(toast.className).toContain("border-l-[var(--color-success)]");
		expect(toast.textContent).toContain("Filters reset");

		rerender(React.createElement(Toast, { message: "Failed to load", type: "error", duration: 0 }));
		toast = screen.getByRole("alert");
		expect(toast.className).toContain("bg-[var(--color-surface)]");
		expect(toast.className).toContain("border-l-[var(--color-error)]");
	});

	test("container reads the global store so a toast raised anywhere is visible", () => {
		render(React.createElement(ToastContainer));
		expect(screen.getByTestId("toast-container")).toBeTruthy();
		expect(screen.queryByText("Connected.")).toBeNull();

		act(() => {
			useToastStore.getState().show("Connected.", "success", 0);
		});
		expect(screen.getByText("Connected.")).toBeTruthy();
	});
});
