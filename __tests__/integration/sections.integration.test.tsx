/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

const storeState = {
	currentTOTWSubPage: "totw",
	setTOTWSubPage: jest.fn(),
	nextTOTWSubPage: jest.fn(),
	previousTOTWSubPage: jest.fn(),
	setMainPage: jest.fn(),
	setStatsSubPage: jest.fn(),
	setClubInfoSubPage: jest.fn(),
};

jest.mock("@/lib/stores/navigation", () => ({
	useNavigationStore: jest.fn((selector?: (state: typeof storeState) => unknown) =>
		typeof selector === "function" ? selector(storeState) : storeState
	),
}));

jest.mock("@/components/totw/TeamOfTheWeek", () => () => <div data-testid="totw-team-page">TeamOfTheWeek</div>);
jest.mock("@/components/totw/PlayersOfMonth", () => () => <div data-testid="totw-pom-page">PlayersOfMonth</div>);
jest.mock("@/components/admin/PWAInstallButton", () => () => <div data-testid="pwa-install">PWA</div>);
jest.mock("@/lib/services/seedingStatusService", () => ({
	seedingStatusService: {
		getSeedingStatus: jest.fn(() => ({
			lastSeedingStatus: "success",
			lastSeedingAt: "2026-01-01",
			lastSeederVersion: "1.0.0",
		})),
	},
}));

// jsdom integration for TOTW container subpage switching and Settings navigation shortcuts with navigation store mocked.
// Heavy child components (TOTW pages, PWA button) are stubbed; seedingStatusService returns static success metadata.
// Exercises store wiring and testids only—no real routing or API.

describe("Integration - TOTW/Club/Settings sections", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	test("TOTWContainer renders current page and allows subpage switch", async () => {
		// Arrange: load TOTW shell with mocked subpages
		const TOTWContainer = (await import("../../components/totw/TOTWContainer")).default;
		render(<TOTWContainer />);
		// Assert: default team view visible
		expect(screen.getByTestId("totw-team-page")).toBeTruthy();

		// Act & assert: indicator click requests subpage change
		fireEvent.click(screen.getByTestId("totw-subpage-indicator-players-of-month"));
		expect(storeState.setTOTWSubPage).toHaveBeenCalledWith("players-of-month");
	});

	test("Settings page renders and navigation shortcuts trigger store actions", async () => {
		// Arrange: render settings with mocked navigation hooks
		const Settings = (await import("../../components/pages/Settings")).default;
		render(<Settings />);

		// Act: use in-page shortcut to home
		expect(screen.getByTestId("settings-heading")).toBeTruthy();
		fireEvent.click(screen.getByTestId("settings-nav-home"));
		// Assert: store receives navigation intent
		expect(storeState.setMainPage).toHaveBeenCalledWith("home");
	});
});
