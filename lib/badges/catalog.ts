/**
 * Feature 9 — achievement badge catalogue for the website (progress UI).
 * Keep in sync with `database-dorkinians/services/badgeDefinitions.js`.
 */

import type { BadgePlayer } from "./neo4jProps";

export type BadgeTier = "bronze" | "silver" | "gold" | "diamond";

export type BadgeTierDef = { threshold: number; description: string };

export type BadgeDefinition = {
	name: string;
	category: string;
	tiers: Partial<Record<BadgeTier, BadgeTierDef>>;
	evaluate: (player: BadgePlayer) => number;
};

export const BADGE_DEFINITIONS: Record<string, BadgeDefinition> = {
	club_stalwart: {
		name: "Club Stalwart",
		category: "appearances",
		tiers: {
			bronze: { threshold: 25, description: "Make 25 appearances" },
			silver: { threshold: 50, description: "Make 50 appearances" },
			gold: { threshold: 100, description: "Make 100 appearances" },
			diamond: { threshold: 200, description: "Make 200 appearances" },
		},
		evaluate: (player) => Number(player.appearances ?? 0) || 0,
	},
	season_regular: {
		name: "Season Regular",
		category: "appearances",
		tiers: {
			bronze: { threshold: 15, description: "Play 15 matches in a season" },
			silver: { threshold: 20, description: "Play 20 matches in a season" },
			gold: { threshold: 25, description: "Play 25 matches in a season" },
			diamond: { threshold: 30, description: "Play 30+ matches in a season" },
		},
		evaluate: (player) => Number(player.maxAppsInSeason ?? 0) || 0,
	},
	ever_present: {
		name: "Ever Present",
		category: "appearances",
		tiers: {
			bronze: { threshold: 5, description: "5 consecutive appearances" },
			silver: { threshold: 15, description: "15 consecutive appearances" },
			gold: { threshold: 25, description: "25 consecutive appearances" },
			diamond: { threshold: 40, description: "40+ consecutive appearances" },
		},
		evaluate: (player) => Number(player.allTimeBestAppearanceStreak ?? 0) || 0,
	},
	multi_team: {
		name: "Multi-Team Player",
		category: "appearances",
		tiers: {
			bronze: { threshold: 2, description: "Play for 2 different XIs" },
			silver: { threshold: 3, description: "Play for 3 different XIs" },
			gold: { threshold: 5, description: "Play for 5 different XIs" },
			diamond: { threshold: 7, description: "Play for all 7 XIs" },
		},
		evaluate: (player) => Number(player.numberTeamsPlayedFor ?? 0) || 0,
	},
	veteran: {
		name: "Veteran",
		category: "appearances",
		tiers: {
			bronze: { threshold: 3, description: "Play for 3 seasons" },
			silver: { threshold: 5, description: "Play for 5 seasons" },
			gold: { threshold: 7, description: "Play for 7 seasons" },
			diamond: { threshold: 10, description: "Play for 10 seasons" },
		},
		evaluate: (player) => Number(player.numberSeasonsPlayedFor ?? 0) || 0,
	},
	goalscorer: {
		name: "Goalscorer",
		category: "goals",
		tiers: {
			bronze: { threshold: 5, description: "Score 5 goals" },
			silver: { threshold: 25, description: "Score 25 goals" },
			gold: { threshold: 50, description: "Score 50 goals" },
			diamond: { threshold: 100, description: "Score 100 goals" },
		},
		evaluate: (player) => Number(player.goals ?? 0) || 0,
	},
	season_scorer: {
		name: "Season Scorer",
		category: "goals",
		tiers: {
			bronze: { threshold: 5, description: "Score 5 goals in a season" },
			silver: { threshold: 10, description: "Score 10 goals in a season" },
			gold: { threshold: 15, description: "Score 15 goals in a season" },
			diamond: { threshold: 20, description: "Score 20+ goals in a season" },
		},
		evaluate: (player) => Number(player.maxGoalsInSeason ?? 0) || 0,
	},
	hat_trick_hero: {
		name: "Hat-Trick Hero",
		category: "goals",
		tiers: {
			bronze: { threshold: 1, description: "Score a hat-trick" },
			silver: { threshold: 3, description: "Score 3 hat-tricks" },
			gold: { threshold: 5, description: "Score 5 hat-tricks" },
			diamond: { threshold: 10, description: "Score 10 hat-tricks" },
		},
		evaluate: (player) => Number(player.hatTrickCount ?? 0) || 0,
	},
	hot_streak: {
		name: "Hot Streak",
		category: "goals",
		tiers: {
			bronze: { threshold: 3, description: "Score in 3 consecutive matches" },
			silver: { threshold: 5, description: "Score in 5 consecutive matches" },
			gold: { threshold: 7, description: "Score in 7 consecutive matches" },
			diamond: { threshold: 10, description: "Score in 10 consecutive matches" },
		},
		evaluate: (player) => Number(player.allTimeBestScoringStreak ?? 0) || 0,
	},
	poacher: {
		name: "Poacher",
		category: "goals",
		tiers: {
			bronze: { threshold: 0.3, description: "0.3+ goals per 90 (min 360 mins)" },
			silver: { threshold: 0.5, description: "0.5+ goals per 90" },
			gold: { threshold: 0.7, description: "0.7+ goals per 90" },
			diamond: { threshold: 1.0, description: "1.0+ goals per 90" },
		},
		evaluate: (player) => ((Number(player.minutes ?? 0) || 0) >= 360 ? Number(player.goalsPer90 ?? 0) || 0 : 0),
	},
	provider: {
		name: "Provider",
		category: "assists",
		tiers: {
			bronze: { threshold: 5, description: "Provide 5 assists" },
			silver: { threshold: 15, description: "Provide 15 assists" },
			gold: { threshold: 30, description: "Provide 30 assists" },
			diamond: { threshold: 50, description: "Provide 50 assists" },
		},
		evaluate: (player) => Number(player.assists ?? 0) || 0,
	},
	playmaker: {
		name: "Playmaker",
		category: "assists",
		tiers: {
			bronze: { threshold: 0.2, description: "0.2+ assists per 90 (min 360 mins)" },
			silver: { threshold: 0.3, description: "0.3+ assists per 90" },
			gold: { threshold: 0.5, description: "0.5+ assists per 90" },
			diamond: { threshold: 0.7, description: "0.7+ assists per 90" },
		},
		evaluate: (player) => ((Number(player.minutes ?? 0) || 0) >= 360 ? Number(player.assistsPer90 ?? 0) || 0 : 0),
	},
	clean_sheet_king: {
		name: "Clean Sheet King",
		category: "defence",
		tiers: {
			bronze: { threshold: 5, description: "Keep 5 clean sheets" },
			silver: { threshold: 15, description: "Keep 15 clean sheets" },
			gold: { threshold: 30, description: "Keep 30 clean sheets" },
			diamond: { threshold: 50, description: "Keep 50 clean sheets" },
		},
		evaluate: (player) => Number(player.cleanSheets ?? 0) || 0,
	},
	brick_wall: {
		name: "Brick Wall",
		category: "defence",
		tiers: {
			bronze: { threshold: 3, description: "3 consecutive clean sheets" },
			silver: { threshold: 5, description: "5 consecutive clean sheets" },
			gold: { threshold: 7, description: "7 consecutive clean sheets" },
			diamond: { threshold: 10, description: "10 consecutive clean sheets" },
		},
		evaluate: (player) => Number(player.allTimeBestCleanSheetStreak ?? 0) || 0,
	},
	shot_stopper: {
		name: "Shot Stopper",
		category: "defence",
		tiers: {
			bronze: { threshold: 20, description: "Make 20 saves" },
			silver: { threshold: 50, description: "Make 50 saves" },
			gold: { threshold: 100, description: "Make 100 saves" },
			diamond: { threshold: 200, description: "Make 200 saves" },
		},
		evaluate: (player) => Number(player.saves ?? 0) || 0,
	},
	penalty_saver: {
		name: "Penalty Saver",
		category: "defence",
		tiers: {
			bronze: { threshold: 1, description: "Save 1 penalty" },
			silver: { threshold: 3, description: "Save 3 penalties" },
			gold: { threshold: 5, description: "Save 5 penalties" },
			diamond: { threshold: 10, description: "Save 10 penalties" },
		},
		evaluate: (player) => Number(player.penaltiesSaved ?? 0) || 0,
	},
	man_of_the_match: {
		name: "Man of the Match",
		category: "performance",
		tiers: {
			bronze: { threshold: 3, description: "Win 3 MoM awards" },
			silver: { threshold: 8, description: "Win 8 MoM awards" },
			gold: { threshold: 15, description: "Win 15 MoM awards" },
			diamond: { threshold: 25, description: "Win 25 MoM awards" },
		},
		evaluate: (player) => Number(player.mom ?? 0) || 0,
	},
	star_man: {
		name: "Star Man",
		category: "performance",
		tiers: {
			bronze: { threshold: 2, description: "Earn 2 TOTW Star Man awards" },
			silver: { threshold: 5, description: "Earn 5 Star Man awards" },
			gold: { threshold: 10, description: "Earn 10 Star Man awards" },
			diamond: { threshold: 20, description: "Earn 20 Star Man awards" },
		},
		evaluate: (player) => Number(player.totwStarManCount ?? 0) || 0,
	},
	totw_regular: {
		name: "TOTW Regular",
		category: "performance",
		tiers: {
			bronze: { threshold: 5, description: "Appear in 5 TOTWs" },
			silver: { threshold: 15, description: "Appear in 15 TOTWs" },
			gold: { threshold: 30, description: "Appear in 30 TOTWs" },
			diamond: { threshold: 50, description: "Appear in 50 TOTWs" },
		},
		evaluate: (player) => Number(player.totwAppearanceCount ?? 0) || 0,
	},
	potm_winner: {
		name: "Player of the Month",
		category: "performance",
		tiers: {
			bronze: { threshold: 1, description: "Win 1 Player of the Month" },
			silver: { threshold: 3, description: "Win 3 Player of the Month" },
			gold: { threshold: 6, description: "Win 6 Player of the Month" },
			diamond: { threshold: 10, description: "Win 10 Player of the Month" },
		},
		evaluate: (player) => Number(player.potmCount ?? 0) || 0,
	},
	peak_performer: {
		name: "Peak Performer",
		category: "performance",
		tiers: {
			bronze: { threshold: 1, description: "1 match rated 8.0+" },
			silver: { threshold: 5, description: "5 matches rated 8.0+" },
			gold: { threshold: 15, description: "15 matches rated 8.0+" },
			diamond: { threshold: 30, description: "30 matches rated 8.0+" },
		},
		evaluate: (player) => Number(player.matchesRated8Plus ?? 0) || 0,
	},
	debut_scorer: {
		name: "Debut Scorer",
		category: "special",
		tiers: {
			gold: { threshold: 1, description: "Score on your first ever appearance" },
		},
		evaluate: (player) => (player.scoredOnDebut === true ? 1 : 0),
	},
	the_traveller: {
		name: "The Traveller",
		category: "special",
		tiers: {
			bronze: { threshold: 10, description: "Play at 10 different away grounds" },
			silver: { threshold: 15, description: "Play at 15 different away grounds" },
			gold: { threshold: 20, description: "Play at 20 different away grounds" },
			diamond: { threshold: 30, description: "Play at 30 different away grounds" },
		},
		evaluate: (player) => Number(player.uniqueAwayGrounds ?? 0) || 0,
	},
	globe_trotter: {
		name: "Globe Trotter",
		category: "special",
		tiers: {
			bronze: { threshold: 200, description: "Travel 200 miles to away matches" },
			silver: { threshold: 500, description: "Travel 500 miles" },
			gold: { threshold: 1000, description: "Travel 1,000 miles" },
			diamond: { threshold: 2000, description: "Travel 2,000 miles" },
		},
		evaluate: (player) => Math.round(Number(player.distance ?? 0) || 0),
	},
	penalty_perfect: {
		name: "Penalty Perfect",
		category: "special",
		tiers: {
			gold: { threshold: 1, description: "Score 5+ penalties with 100% conversion" },
		},
		evaluate: (player) =>
			(Number(player.penaltiesScored ?? 0) || 0) >= 5 && (Number(player.penaltiesMissed ?? 0) || 0) === 0 ? 1 : 0,
	},
	swiss_army_knife: {
		name: "Swiss Army Knife",
		category: "special",
		tiers: {
			gold: { threshold: 1, description: "Play all 4 positions across your career" },
		},
		evaluate: (player) => {
			const positions = [player.gk, player.def, player.mid, player.fwd].map((v) => Number(v ?? 0) || 0).filter((v) => v > 0);
			return positions.length >= 4 ? 1 : 0;
		},
	},
	award_winner: {
		name: "Award Winner",
		category: "special",
		tiers: {
			bronze: { threshold: 1, description: "Win a club award" },
			silver: { threshold: 3, description: "Win 3 club awards" },
			gold: { threshold: 5, description: "Win 5 club awards" },
			diamond: { threshold: 10, description: "Win 10 club awards" },
		},
		evaluate: (player) => Number(player.clubAwardCount ?? 0) || 0,
	},
	weekend_warrior: {
		name: "Weekend Warrior",
		category: "special",
		tiers: {
			gold: { threshold: 1, description: "Play 10+ matches across 2+ different XIs in a single season" },
		},
		evaluate: (player) => Number(player.multiTeamSeasons ?? 0) || 0,
	},
};

export const BADGE_CATEGORY_ORDER = ["appearances", "goals", "assists", "defence", "performance", "special"] as const;

export const CATEGORY_LABELS: Record<string, string> = {
	appearances: "Appearances",
	goals: "Goals",
	assists: "Assists",
	defence: "Defence",
	performance: "Performance",
	special: "Special",
};
