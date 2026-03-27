/** @jest-environment jsdom */
import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

const mockStore = {
	selectedPlayer: "Luke Bangs",
	setMainPage: jest.fn(),
	setStatsSubPage: jest.fn(),
	playerFilters: {
		timeRange: { type: "allTime", seasons: [], beforeDate: "", afterDate: "", startDate: "", endDate: "" },
		teams: [],
		location: ["Home", "Away"],
		opposition: { mode: "all", searchTerm: "" },
		competition: { mode: "types", types: ["League", "Cup", "Friendly"], searchTerm: "" },
		result: ["Win", "Draw", "Loss"],
		position: ["GK", "DEF", "MID", "FWD"],
	},
	updatePlayerFilters: jest.fn(),
	applyPlayerFilters: jest.fn(),
	resetPlayerFilters: jest.fn(),
	hasUnsavedFilters: false,
	filterData: { seasons: [], teams: [], opposition: [], competitions: [] },
	isFilterDataLoaded: false,
	loadFilterData: jest.fn(),
	currentStatsSubPage: "player-stats",
};

jest.mock("@/lib/stores/navigation", () => ({
	useNavigationStore: jest.fn((selector?: (state: typeof mockStore) => unknown) =>
		typeof selector === "function" ? selector(mockStore) : mockStore
	),
}));

jest.mock("@/lib/hooks/useToast", () => ({
	useToast: jest.fn(() => ({ showSuccess: jest.fn(), showError: jest.fn() })),
}));

jest.mock("next/dynamic", () => ({
	__esModule: true,
	default: () => () => null,
}));

// jsdom integration tests for FilterSidebar and ChatbotInterface with navigation/toast stores mocked and fetch stubbed.
// No real API calls: components load dynamically; session/local storage cleared each run. Relies on stable data-testid hooks.
// Async tests use waitFor around mocked network resolution; flakes usually mean DOM/testid drift rather than backend issues.

describe("UI integration coverage", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		const { useNavigationStore } = require("@/lib/stores/navigation");
		useNavigationStore.mockImplementation((selector?: (state: typeof mockStore) => unknown) =>
			typeof selector === "function" ? selector(mockStore) : mockStore
		);
		const { useToast } = require("@/lib/hooks/useToast");
		useToast.mockImplementation(() => ({ showSuccess: jest.fn(), showError: jest.fn() }));
		(global.fetch as any) = jest.fn();
		sessionStorage.clear();
		localStorage.clear();
	});

	test("FilterSidebar loads filter data when opened", async () => {
		// Arrange: render open sidebar with mocked store callbacks
		const FilterSidebar = (await import("../../components/filters/FilterSidebar")).default;
		render(React.createElement(FilterSidebar, { isOpen: true, onClose: jest.fn() }));

		// Assert: opening triggers async filter hydration
		await waitFor(() => {
			expect(mockStore.loadFilterData).toHaveBeenCalled();
		});
	});

	test("ChatbotInterface submits and renders response", async () => {
		// Arrange: successful chat API payload
		(global.fetch as jest.Mock).mockResolvedValue({
			ok: true,
			json: async () => ({
				answer: "Luke Bangs has scored goals.",
				debug: { question: "How many goals?" },
			}),
		});
		const ChatbotInterface = (await import("../../components/chatbot/ChatbotInterface")).default;
		render(React.createElement(ChatbotInterface));

		// Act: user submits a question
		fireEvent.change(screen.getByTestId("chatbot-input"), { target: { value: "How many goals?" } });
		fireEvent.click(screen.getByTestId("chatbot-submit"));

		// Assert: answer region populated and session id persisted
		await waitFor(() => {
			expect(screen.getByTestId("chatbot-answer")).toBeTruthy();
		});
		expect(global.fetch).toHaveBeenCalled();
		expect(sessionStorage.getItem("chatbotSessionId")).toBeTruthy();
	});

	test("ChatbotInterface shows error state on API failure", async () => {
		// Arrange: failed HTTP response from chat endpoint
		(global.fetch as jest.Mock).mockResolvedValue({
			ok: false,
			status: 500,
			json: async () => ({ error: "failed" }),
			text: async () => "failed",
		});
		const ChatbotInterface = (await import("../../components/chatbot/ChatbotInterface")).default;
		render(React.createElement(ChatbotInterface));

		// Act: submit triggers error handling UI path
		fireEvent.change(screen.getByTestId("chatbot-input"), { target: { value: "Bad question" } });
		fireEvent.click(screen.getByTestId("chatbot-submit"));

		// Assert: answer container still renders (error state)
		await waitFor(() => {
			expect(screen.getByTestId("chatbot-answer")).toBeTruthy();
		});
	});
});
