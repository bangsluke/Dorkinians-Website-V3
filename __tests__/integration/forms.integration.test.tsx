/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

jest.mock("@/lib/stores/navigation", () => ({
	useNavigationStore: jest.fn(() => ({ selectedPlayer: "Luke Bangs" })),
}));

jest.mock("@/lib/utils/trackEvent", () => ({
	trackEvent: jest.fn(),
}));

// jsdom form flows for FeedbackModal and DataPrivacyModal with navigation store + trackEvent mocked and fetch stubbed.
// Validates happy-path POST and visible error copy on HTTP failure. No real email/API backend.
// waitFor handles async submit handlers; flakes imply label/button text drift.

describe("Integration - feedback and data-removal forms", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		(global.fetch as any) = jest.fn();
	});

	test("FeedbackModal validates and submits success flow", async () => {
		// Arrange: successful feedback API
		(global.fetch as jest.Mock).mockResolvedValue({ ok: true });
		const FeedbackModal = (await import("../../components/modals/FeedbackModal")).default;
		render(<FeedbackModal isOpen={true} onClose={jest.fn()} />);

		// Act: fill required fields and submit
		fireEvent.change(screen.getByLabelText("Your Name"), { target: { value: "Luke Bangs" } });
		fireEvent.change(screen.getByLabelText("Bug Description"), { target: { value: "Something broke" } });
		fireEvent.click(screen.getByRole("button", { name: "Send" }));

		// Assert: POST issued to feedback endpoint
		await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
			"/api/feedback",
			expect.objectContaining({ method: "POST" })
		));
	});

	test("DataPrivacyModal submits and shows error state on failure", async () => {
		// Arrange: privacy endpoint rejects request
		(global.fetch as jest.Mock).mockResolvedValue({ ok: false });
		const DataPrivacyModal = (await import("../../components/modals/DataPrivacyModal")).default;
		render(<DataPrivacyModal isOpen={true} onClose={jest.fn()} />);

		// Act: minimal valid submit
		fireEvent.change(screen.getByLabelText("Your Name"), { target: { value: "Luke Bangs" } });
		fireEvent.click(screen.getByRole("button", { name: "Send" }));

		// Assert: user-visible error copy appears
		await waitFor(() => expect(screen.getByText(/there was an error/i)).toBeTruthy());
	});
});
