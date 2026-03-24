/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

jest.mock("@/lib/stores/navigation", () => ({
	useNavigationStore: jest.fn(() => ({ selectedPlayer: "Luke Bangs" })),
}));

jest.mock("@/lib/utils/trackEvent", () => ({
	trackEvent: jest.fn(),
}));

describe("Integration - feedback and data-removal forms", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		(global.fetch as any) = jest.fn();
	});

	test("FeedbackModal validates and submits success flow", async () => {
		(global.fetch as jest.Mock).mockResolvedValue({ ok: true });
		const FeedbackModal = (await import("../../components/modals/FeedbackModal")).default;
		render(<FeedbackModal isOpen={true} onClose={jest.fn()} />);

		fireEvent.change(screen.getByLabelText("Your Name"), { target: { value: "Luke Bangs" } });
		fireEvent.change(screen.getByLabelText("Bug Description"), { target: { value: "Something broke" } });
		fireEvent.click(screen.getByRole("button", { name: "Send" }));

		await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
			"/api/feedback",
			expect.objectContaining({ method: "POST" })
		));
	});

	test("DataPrivacyModal submits and shows error state on failure", async () => {
		(global.fetch as jest.Mock).mockResolvedValue({ ok: false });
		const DataPrivacyModal = (await import("../../components/modals/DataPrivacyModal")).default;
		render(<DataPrivacyModal isOpen={true} onClose={jest.fn()} />);

		fireEvent.change(screen.getByLabelText("Your Name"), { target: { value: "Luke Bangs" } });
		fireEvent.click(screen.getByRole("button", { name: "Send" }));

		await waitFor(() => expect(screen.getByText(/there was an error/i)).toBeTruthy());
	});
});
