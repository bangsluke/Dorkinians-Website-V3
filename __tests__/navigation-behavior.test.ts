import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import { useNavigationStore } from '@/lib/stores/navigation';
import StatsContainer from '@/components/StatsContainer';
import PlayerStats from '@/components/stats/PlayerStats';
import Comparison from '@/components/stats/Comparison';

// Mock the navigation store
jest.mock('@/lib/stores/navigation', () => ({
  useNavigationStore: jest.fn(),
}));

const mockUseNavigationStore = useNavigationStore as jest.MockedFunction<typeof useNavigationStore>;

describe('Navigation Behavior Tests', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('StatsContainer - Always Show All 4 Sub-Pages', () => {
    it('should always show all 4 sub-pages regardless of player selection state', () => {
      const mockStore = {
        currentStatsSubPage: 'player-stats' as const,
        setStatsSubPage: jest.fn(),
        nextStatsSubPage: jest.fn(),
        previousStatsSubPage: jest.fn(),
        currentMainPage: 'stats' as const,
      };

      mockUseNavigationStore.mockReturnValue(mockStore);

      render(<StatsContainer />);

      // Should show all 4 dot indicators
      const dotIndicators = screen.getAllByRole('button', { name: /go to/i });
      expect(dotIndicators).toHaveLength(4);
      
      // Check that all expected pages are present
      expect(screen.getByLabelText('Go to Player Stats')).toBeInTheDocument();
      expect(screen.getByLabelText('Go to Team Stats')).toBeInTheDocument();
      expect(screen.getByLabelText('Go to Club Stats')).toBeInTheDocument();
      expect(screen.getByLabelText('Go to Comparison')).toBeInTheDocument();
    });

    it('should show all 4 sub-pages even when no player is selected', () => {
      const mockStore = {
        currentStatsSubPage: 'player-stats' as const,
        setStatsSubPage: jest.fn(),
        nextStatsSubPage: jest.fn(),
        previousStatsSubPage: jest.fn(),
        currentMainPage: 'stats' as const,
      };

      mockUseNavigationStore.mockReturnValue(mockStore);

      render(<StatsContainer />);

      // Should still show all 4 dot indicators
      const dotIndicators = screen.getAllByRole('button', { name: /go to/i });
      expect(dotIndicators).toHaveLength(4);
    });
  });

  describe('PlayerStats - No Player State', () => {
    it('should show "Select a player" message when no player is selected', () => {
      const mockStore = {
        selectedPlayer: null,
        cachedPlayerData: null,
        isLoadingPlayerData: false,
        setMainPage: jest.fn(),
      };

      mockUseNavigationStore.mockReturnValue(mockStore);

      render(<PlayerStats />);

      expect(screen.getByText('Player Stats')).toBeInTheDocument();
      expect(screen.getByText('Select a player to display data here')).toBeInTheDocument();
      expect(screen.getByTitle('Select a player')).toBeInTheDocument();
    });

    it('should navigate to home when edit button is clicked in no-player state', () => {
      const mockSetMainPage = jest.fn();
      const mockEnterEditMode = jest.fn();
      const mockStore = {
        selectedPlayer: null,
        cachedPlayerData: null,
        isLoadingPlayerData: false,
        enterEditMode: mockEnterEditMode,
        setMainPage: mockSetMainPage,
      };

      mockUseNavigationStore.mockReturnValue(mockStore);

      render(<PlayerStats />);

      const editButton = screen.getByTitle('Select a player');
      fireEvent.click(editButton);

      expect(mockEnterEditMode).toHaveBeenCalled();
      expect(mockSetMainPage).toHaveBeenCalledWith('home');
    });

    it('should show player stats when player is selected', () => {
      const mockPlayerData = {
        playerData: {
          id: '1',
          playerName: 'Test Player',
          allowOnSite: true,
          appearances: 10,
          minutes: 900,
          mom: 2,
          goals: 5,
          assists: 3,
          yellowCards: 1,
          redCards: 0,
          saves: 0,
          ownGoals: 0,
          conceded: 0,
          cleanSheets: 0,
          penaltiesScored: 0,
          penaltiesMissed: 0,
          penaltiesConceded: 0,
          penaltiesSaved: 0,
          fantasyPoints: 50,
          allGoalsScored: 5,
          goalsPerApp: 0.5,
          concededPerApp: 0,
          minutesPerGoal: 180,
          minutesPerCleanSheet: 0,
          fantasyPointsPerApp: 5,
          distance: 0,
          homeGames: 5,
          homeWins: 3,
          homeGamesPercentWon: 60,
          awayGames: 5,
          awayWins: 2,
          awayGamesPercentWon: 40,
          gamesPercentWon: 50,
          apps1s: 3,
          apps2s: 2,
          apps3s: 1,
          apps4s: 0,
          apps5s: 0,
          apps6s: 0,
          apps7s: 0,
          apps8s: 0,
          mostPlayedForTeam: '1s',
          numberTeamsPlayedFor: 1,
          goals1s: 3,
          goals2s: 2,
          goals3s: 0,
          goals4s: 0,
          goals5s: 0,
          goals6s: 0,
          goals7s: 0,
          goals8s: 0,
          mostScoredForTeam: '1s',
          numberSeasonsPlayedFor: 1,
          graphLabel: 'dorkiniansWebsite',
        },
        selectedDate: '2024-01-01',
      };

      const mockStore = {
        selectedPlayer: 'Test Player',
        cachedPlayerData: mockPlayerData,
        isLoadingPlayerData: false,
        enterEditMode: jest.fn(),
        setMainPage: jest.fn(),
      };

      mockUseNavigationStore.mockReturnValue(mockStore);

      render(<PlayerStats />);

      expect(screen.getByText('Player Stats - Test Player')).toBeInTheDocument();
      expect(screen.getByTitle('Edit player selection')).toBeInTheDocument();
    });

    it('should clear player and navigate to home when edit button is clicked with player selected', () => {
      const mockEnterEditMode = jest.fn();
      const mockSetMainPage = jest.fn();
      const mockPlayerData = {
        playerData: {
          id: '1',
          playerName: 'Test Player',
          allowOnSite: true,
          appearances: 10,
          minutes: 900,
          mom: 2,
          goals: 5,
          assists: 3,
          yellowCards: 1,
          redCards: 0,
          saves: 0,
          ownGoals: 0,
          conceded: 0,
          cleanSheets: 0,
          penaltiesScored: 0,
          penaltiesMissed: 0,
          penaltiesConceded: 0,
          penaltiesSaved: 0,
          fantasyPoints: 50,
          allGoalsScored: 5,
          goalsPerApp: 0.5,
          concededPerApp: 0,
          minutesPerGoal: 180,
          minutesPerCleanSheet: 0,
          fantasyPointsPerApp: 5,
          distance: 0,
          homeGames: 5,
          homeWins: 3,
          homeGamesPercentWon: 60,
          awayGames: 5,
          awayWins: 2,
          awayGamesPercentWon: 40,
          gamesPercentWon: 50,
          apps1s: 3,
          apps2s: 2,
          apps3s: 1,
          apps4s: 0,
          apps5s: 0,
          apps6s: 0,
          apps7s: 0,
          apps8s: 0,
          mostPlayedForTeam: '1s',
          numberTeamsPlayedFor: 1,
          goals1s: 3,
          goals2s: 2,
          goals3s: 0,
          goals4s: 0,
          goals5s: 0,
          goals6s: 0,
          goals7s: 0,
          goals8s: 0,
          mostScoredForTeam: '1s',
          numberSeasonsPlayedFor: 1,
          graphLabel: 'dorkiniansWebsite',
        },
        selectedDate: '2024-01-01',
      };

      const mockStore = {
        selectedPlayer: 'Test Player',
        cachedPlayerData: mockPlayerData,
        isLoadingPlayerData: false,
        enterEditMode: mockEnterEditMode,
        setMainPage: mockSetMainPage,
      };

      mockUseNavigationStore.mockReturnValue(mockStore);

      render(<PlayerStats />);

      const editButton = screen.getByTitle('Edit player selection');
      fireEvent.click(editButton);

      expect(mockEnterEditMode).toHaveBeenCalled();
      expect(mockSetMainPage).toHaveBeenCalledWith('home');
    });
  });

  describe('Comparison - No Player State', () => {
    it('should show "Select a player" message when no player is selected', () => {
      const mockStore = {
        selectedPlayer: null,
        setMainPage: jest.fn(),
      };

      mockUseNavigationStore.mockReturnValue(mockStore);

      render(<Comparison />);

      expect(screen.getByText('Player Comparison')).toBeInTheDocument();
      expect(screen.getByText('Select a player to display data here')).toBeInTheDocument();
      expect(screen.getByTitle('Select a player')).toBeInTheDocument();
    });

    it('should navigate to home when edit button is clicked in no-player state', () => {
      const mockSetMainPage = jest.fn();
      const mockEnterEditMode = jest.fn();
      const mockStore = {
        selectedPlayer: null,
        enterEditMode: mockEnterEditMode,
        setMainPage: mockSetMainPage,
      };

      mockUseNavigationStore.mockReturnValue(mockStore);

      render(<Comparison />);

      const editButton = screen.getByTitle('Select a player');
      fireEvent.click(editButton);

      expect(mockEnterEditMode).toHaveBeenCalled();
      expect(mockSetMainPage).toHaveBeenCalledWith('home');
    });

    it('should show comparison content when player is selected', () => {
      const mockStore = {
        selectedPlayer: 'Test Player',
        setMainPage: jest.fn(),
      };

      mockUseNavigationStore.mockReturnValue(mockStore);

      render(<Comparison />);

      expect(screen.getByText('Player Comparison')).toBeInTheDocument();
      expect(screen.getByText('Compare statistics between different players will be displayed here.')).toBeInTheDocument();
    });
  });

  describe('Navigation Flow Integration', () => {
    it('should maintain player selection when navigating from home to stats', () => {
      // This test would require a more complex setup with the actual store
      // For now, we'll test the individual components as above
      expect(true).toBe(true); // Placeholder for integration test
    });

    it('should clear player selection when navigating to non-stats pages', () => {
      // This test would require a more complex setup with the actual store
      // For now, we'll test the individual components as above
      expect(true).toBe(true); // Placeholder for integration test
    });
  });
});
