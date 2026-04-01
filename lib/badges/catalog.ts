/**
 * Feature 9 - achievement badge catalogue for the website (progress UI).
 * Keep in sync with `database-dorkinians/services/badgeDefinitions.js`.
 */

import type { BadgePlayer } from "./neo4jProps";

export type BadgeTier = "bronze" | "silver" | "gold" | "diamond";

export type BadgeTierDef = { threshold: number; description: string };

export type BadgeDefinition = {
	name: string;
	category: string;
	description: string;
	tiers: Partial<Record<BadgeTier, BadgeTierDef>>;
	evaluate: (player: BadgePlayer) => number;
};

export const BADGE_DEFINITIONS: Record<string, BadgeDefinition> = {
	club_stalwart: {
		name: "Club Stalwart",
		category: "appearances",
		description: "Build your all-time appearance count for the club.",
		tiers: {
			bronze: { threshold: 50, description: "Make 50 appearances" },
			silver: { threshold: 100, description: "Make 100 appearances" },
			gold: { threshold: 200, description: "Make 200 appearances" },
			diamond: { threshold: 300, description: "Make 300 appearances" },
		},
		evaluate: (player) => Number(player.appearances ?? 0) || 0,
	},
	season_regular: {
		name: "Season Regular",
		category: "appearances",
		description: "Hit high appearance totals within a single season.",
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
		description: "Extend your consecutive appearance streak.",
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
		description: "Represent more XIs across your career.",
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
		description: "Accumulate seasons played for the club.",
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
		description: "Grow your all-time goals tally.",
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
		description: "Post strong goal totals in a single season.",
		tiers: {
			bronze: { threshold: 5, description: "Score 5 goals in a season" },
			silver: { threshold: 10, description: "Score 10 goals in a season" },
			gold: { threshold: 15, description: "Score 15 goals in a season" },
			diamond: { threshold: 20, description: "Score 20+ goals in a season" },
		},
		evaluate: (player) => Number(player.maxGoalsInSeason ?? 0) || 0,
	},
	double_hattrick: {
		name: "Double Hattrick",
		category: "goals",
		description: "Score 6+ goals in a single game.",
		tiers: {
			gold: { threshold: 1, description: "Score 6+ goals in a game" },
		},
		evaluate: (player) => Number(player.doubleHattrickCount ?? 0) || 0,
	},
	penalty_machine: {
		name: "Penalty Machine",
		category: "goals",
		description: "Score multiple penalties in a single game.",
		tiers: {
			bronze: { threshold: 1, description: "Score 1 penalty in a game" },
			gold: { threshold: 2, description: "Score 2 penalties in a game" },
			diamond: { threshold: 3, description: "Score 3 penalties in a game" },
		},
		evaluate: (player) => Number(player.maxPenaltiesInGame ?? 0) || 0,
	},
	hat_trick_hero: {
		name: "Hat-Trick Hero",
		category: "goals",
		description: "Record hat-tricks across your career.",
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
		description: "Score in consecutive matches.",
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
		description: "Maintain elite goals-per-90 output (min 360 mins).",
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
		description: "Increase your all-time assists tally.",
		tiers: {
			bronze: { threshold: 5, description: "Provide 5 assists" },
			silver: { threshold: 15, description: "Provide 15 assists" },
			gold: { threshold: 30, description: "Provide 30 assists" },
			diamond: { threshold: 50, description: "Provide 50 assists" },
		},
		evaluate: (player) => Number(player.assists ?? 0) || 0,
	},
	double_provider: {
		name: "Double Provider",
		category: "assists",
		description: "Register multiple assists in a single game.",
		tiers: {
			bronze: { threshold: 2, description: "Record 2 assists in a game" },
			silver: { threshold: 3, description: "Record 3 assists in a game" },
			gold: { threshold: 4, description: "Record 4 assists in a game" },
			diamond: { threshold: 5, description: "Record 5 assists in a game" },
		},
		evaluate: (player) => Number(player.maxAssistsInGame ?? 0) || 0,
	},
	creator_streak: {
		name: "Creator Streak",
		category: "assists",
		description: "Build consecutive-match assist streaks.",
		tiers: {
			bronze: { threshold: 2, description: "Assist in 2 consecutive matches" },
			silver: { threshold: 3, description: "Assist in 3 consecutive matches" },
			gold: { threshold: 5, description: "Assist in 5 consecutive matches" },
			diamond: { threshold: 7, description: "Assist in 7 consecutive matches" },
		},
		evaluate: (player) => Number(player.currentAssistStreak ?? 0) || 0,
	},
	assist_goal_combo: {
		name: "Assist+Goal Combo",
		category: "assists",
		description: "Record matches with both a goal and an assist.",
		tiers: {
			bronze: { threshold: 1, description: "Record a match with both a goal and an assist" },
			silver: { threshold: 3, description: "Record 3 goal+assist combo matches" },
			gold: { threshold: 5, description: "Record 5 goal+assist combo matches" },
			diamond: { threshold: 10, description: "Record 10 goal+assist combo matches" },
		},
		evaluate: (player) => Number(player.assistGoalComboCount ?? 0) || 0,
	},
	playmaker: {
		name: "Playmaker",
		category: "assists",
		description: "Maintain elite assists-per-90 output (min 360 mins).",
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
		description: "Rack up total clean sheets.",
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
		description: "Keep consecutive clean sheets.",
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
		description: "Make saves across your appearances.",
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
		description: "Save penalties.",
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
		description: "Collect Man of the Match awards.",
		tiers: {
			bronze: { threshold: 3, description: "Win 3 MoM awards" },
			silver: { threshold: 8, description: "Win 8 MoM awards" },
			gold: { threshold: 15, description: "Win 15 MoM awards" },
			diamond: { threshold: 25, description: "Win 25 MoM awards" },
		},
		evaluate: (player) => Number(player.mom ?? 0) || 0,
	},
	century_starter: {
		name: "Century Starter",
		category: "performance",
		description: "Rack up starts across your career.",
		tiers: {
			bronze: { threshold: 50, description: "Make 50 starts" },
			silver: { threshold: 100, description: "Make 100 starts" },
			gold: { threshold: 150, description: "Make 150 starts" },
			diamond: { threshold: 200, description: "Make 200 starts" },
		},
		evaluate: (player) => Number(player.starts ?? 0) || 0,
	},
	star_man: {
		name: "Star Man",
		category: "performance",
		description: "Earn TOTW Star Man awards.",
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
		description: "Make Team of the Week appearances.",
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
		description: "Win Player of the Month awards.",
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
		description: "Deliver matches rated 8.0+.",
		tiers: {
			bronze: { threshold: 1, description: "1 match rated 8.0+" },
			silver: { threshold: 5, description: "5 matches rated 8.0+" },
			gold: { threshold: 15, description: "15 matches rated 8.0+" },
			diamond: { threshold: 30, description: "30 matches rated 8.0+" },
		},
		evaluate: (player) => Number(player.matchesRated8Plus ?? 0) || 0,
	},
	on_fire: {
		name: "On Fire",
		category: "performance",
		description: "Hit elite current-form levels.",
		tiers: {
			bronze: { threshold: 7.5, description: "Reach 7.5+ current form rating" },
			silver: { threshold: 8.0, description: "Reach 8.0+ current form rating" },
			gold: { threshold: 8.5, description: "Reach 8.5+ current form rating" },
			diamond: { threshold: 9.0, description: "Reach 9.0+ current form rating" },
		},
		evaluate: (player) => Number(player.formCurrent ?? 0) || 0,
	},
	consistent_8s: {
		name: "Consistent 8s",
		category: "performance",
		description: "Maintain long runs of 8.0+ ratings.",
		tiers: {
			bronze: { threshold: 3, description: "3 consecutive matches rated 8.0+" },
			silver: { threshold: 5, description: "5 consecutive matches rated 8.0+" },
			gold: { threshold: 8, description: "8 consecutive matches rated 8.0+" },
			diamond: { threshold: 12, description: "12 consecutive matches rated 8.0+" },
		},
		evaluate: (player) => Number(player.allTimeBestHighRatingStreak ?? 0) || 0,
	},
	highly_rated: {
		name: "Highly Rated",
		category: "performance",
		description: "Set elite single-game match ratings.",
		tiers: {
			bronze: { threshold: 8.5, description: "Record an 8.5+ match rating" },
			silver: { threshold: 9.0, description: "Record a 9.0+ match rating" },
			gold: { threshold: 9.5, description: "Record a 9.5+ match rating" },
			diamond: { threshold: 10.0, description: "Record a perfect 10.0 rating" },
		},
		evaluate: (player) => Number(player.highestMatchRating ?? 0) || 0,
	},
	fantasy_centurion: {
		name: "Fantasy Centurion",
		category: "performance",
		description: "Hit major fantasy-point totals in a season.",
		tiers: {
			bronze: { threshold: 100, description: "Score 100 fantasy points in a season" },
			silver: { threshold: 200, description: "Score 200 fantasy points in a season" },
			gold: { threshold: 300, description: "Score 300 fantasy points in a season" },
			diamond: { threshold: 400, description: "Score 400 fantasy points in a season" },
		},
		evaluate: (player) => Number(player.maxFantasyPointsInSeason ?? 0) || 0,
	},
	back_to_back_mom: {
		name: "Back-to-Back MoM",
		category: "performance",
		description: "String together consecutive Man of the Match awards.",
		tiers: {
			bronze: { threshold: 2, description: "Win MoM in 2 consecutive matches" },
			silver: { threshold: 3, description: "Win MoM in 3 consecutive matches" },
			gold: { threshold: 5, description: "Win MoM in 5 consecutive matches" },
			diamond: { threshold: 8, description: "Win MoM in 8 consecutive matches" },
		},
		evaluate: (player) => Number(player.currentMomStreak ?? 0) || 0,
	},
	season_20_gi: {
		name: "20 GI Season",
		category: "performance",
		description: "Deliver 20+ goal involvements in a season.",
		tiers: {
			bronze: { threshold: 1, description: "Record 1 season with 20+ goal involvements" },
			silver: { threshold: 2, description: "Record 2 seasons with 20+ goal involvements" },
			gold: { threshold: 3, description: "Record 3 seasons with 20+ goal involvements" },
			diamond: { threshold: 5, description: "Record 5 seasons with 20+ goal involvements" },
		},
		evaluate: (player) => Number(player.seasons20GI ?? 0) || 0,
	},
	justified_starter: {
		name: "Justified Starter",
		category: "performance",
		description: "Convert starts into wins.",
		tiers: {
			bronze: { threshold: 5, description: "Win 5 games when starting" },
			silver: { threshold: 15, description: "Win 15 games when starting" },
			gold: { threshold: 30, description: "Win 30 games when starting" },
			diamond: { threshold: 50, description: "Win 50 games when starting" },
		},
		evaluate: (player) => Number(player.winsWhenStarting ?? 0) || 0,
	},
	impact_sub: {
		name: "Impact Sub",
		category: "performance",
		description: "Turn substitute appearances into wins.",
		tiers: {
			bronze: { threshold: 3, description: "Win 3 games from the bench" },
			silver: { threshold: 8, description: "Win 8 games from the bench" },
			gold: { threshold: 15, description: "Win 15 games from the bench" },
			diamond: { threshold: 25, description: "Win 25 games from the bench" },
		},
		evaluate: (player) => Number(player.winsFromBench ?? 0) || 0,
	},
	debut_scorer: {
		name: "Debut Scorer",
		category: "special",
		description: "Score on your first-ever appearance.",
		tiers: {
			gold: { threshold: 1, description: "Score on your first ever appearance" },
		},
		evaluate: (player) => (player.scoredOnDebut === true ? 1 : 0),
	},
	the_traveller: {
		name: "The Traveller",
		category: "special",
		description: "Play at more away grounds.",
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
		description: "Travel farther for away matches.",
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
		description: "Score penalties with perfect conversion (min 5 scored).",
		tiers: {
			gold: { threshold: 1, description: "Score 5+ penalties with 100% conversion" },
		},
		evaluate: (player) =>
			(Number(player.penaltiesScored ?? 0) || 0) >= 5 && (Number(player.penaltiesMissed ?? 0) || 0) === 0 ? 1 : 0,
	},
	swiss_army_knife: {
		name: "Swiss Army Knife",
		category: "special",
		description: "Play all four positions across your career.",
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
		description: "Win club awards.",
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
		description: "Play 10+ matches across 2+ XIs in a single season.",
		tiers: {
			gold: { threshold: 1, description: "Play 10+ matches across 2+ different XIs in a single season" },
		},
		evaluate: (player) => Number(player.multiTeamSeasons ?? 0) || 0,
	},
	full_90_engine: {
		name: "Full-90 Engine",
		category: "special",
		description: "Build long streaks of full-match appearances.",
		tiers: {
			bronze: { threshold: 3, description: "Play 3 consecutive full matches" },
			silver: { threshold: 5, description: "Play 5 consecutive full matches" },
			gold: { threshold: 8, description: "Play 8 consecutive full matches" },
			diamond: { threshold: 12, description: "Play 12 consecutive full matches" },
		},
		evaluate: (player) => Number(player.currentFullMatchStreak ?? 0) || 0,
	},
	clutch_scorer: {
		name: "Clutch Scorer",
		category: "special",
		description: "Drive wins in games where you score.",
		tiers: {
			bronze: { threshold: 5, description: "Win 5 matches while scoring" },
			silver: { threshold: 15, description: "Win 15 matches while scoring" },
			gold: { threshold: 30, description: "Win 30 matches while scoring" },
			diamond: { threshold: 50, description: "Win 50 matches while scoring" },
		},
		evaluate: (player) => Number(player.winsWhenScoring ?? 0) || 0,
	},
	mr_versitile: {
		name: "Mr Versitile",
		category: "special",
		description: "Cover more position groups across your career.",
		tiers: {
			bronze: { threshold: 1, description: "Play in 1 position group (GK/DEF/MID/FWD)" },
			silver: { threshold: 2, description: "Play in 2 position groups" },
			gold: { threshold: 3, description: "Play in 3 position groups" },
			diamond: { threshold: 4, description: "Play in all 4 position groups" },
		},
		evaluate: (player) => {
			const positions = [player.gk, player.def, player.mid, player.fwd].map((v) => Number(v ?? 0) || 0).filter((v) => v > 0);
			return positions.length;
		},
	},
	derby_specialist: {
		name: "Derby Specialist",
		category: "special",
		description: 'Win against opponents with "Reigations" in their name.',
		tiers: {
			bronze: { threshold: 1, description: 'Win 1 match vs a team with "Reigations" in the name' },
			silver: { threshold: 3, description: 'Win 3 matches vs "Reigations" opposition' },
			gold: { threshold: 5, description: 'Win 5 matches vs "Reigations" opposition' },
			diamond: { threshold: 10, description: 'Win 10 matches vs "Reigations" opposition' },
		},
		evaluate: (player) => Number(player.derbyWinsReigations ?? 0) || 0,
	},
	betrayal: {
		name: "Betrayal",
		category: "special",
		description: 'Win against opponents with "Dorkinians" in their name.',
		tiers: {
			bronze: { threshold: 1, description: 'Win 1 match vs a team with "Dorkinians" in the name' },
			silver: { threshold: 2, description: 'Win 2 matches vs "Dorkinians" opposition' },
			gold: { threshold: 3, description: 'Win 3 matches vs "Dorkinians" opposition' },
			diamond: { threshold: 5, description: 'Win 5 matches vs "Dorkinians" opposition' },
		},
		evaluate: (player) => Number(player.betrayalWinsDorkinians ?? 0) || 0,
	},
	league_winner: {
		name: "League Winner",
		category: "special",
		description: "Count league titles won.",
		tiers: {
			bronze: { threshold: 1, description: "Win 1 league title" },
			silver: { threshold: 2, description: "Win 2 league titles" },
			gold: { threshold: 3, description: "Win 3 league titles" },
			diamond: { threshold: 5, description: "Win 5 league titles" },
		},
		evaluate: (player) => Number(player.leagueTitles ?? 0) || 0,
	},
	cup_winner: {
		name: "Cup Winner",
		category: "special",
		description: "Count cup titles won.",
		tiers: {
			bronze: { threshold: 1, description: "Win 1 cup title" },
			silver: { threshold: 2, description: "Win 2 cup titles" },
			gold: { threshold: 3, description: "Win 3 cup titles" },
			diamond: { threshold: 5, description: "Win 5 cup titles" },
		},
		evaluate: (player) => Number(player.cupTitles ?? 0) || 0,
	},
	gk_clean_sheet_specilaist: {
		name: "GK Clean Sheet Specilaist",
		category: "special",
		description: "Build clean sheets while playing as a goalkeeper.",
		tiers: {
			bronze: { threshold: 5, description: "Keep 5 goalkeeper clean sheets" },
			silver: { threshold: 15, description: "Keep 15 goalkeeper clean sheets" },
			gold: { threshold: 30, description: "Keep 30 goalkeeper clean sheets" },
			diamond: { threshold: 50, description: "Keep 50 goalkeeper clean sheets" },
		},
		evaluate: (player) => Number(player.gkCleanSheets ?? 0) || 0,
	},
	golden_gloves: {
		name: "Golden Gloves",
		category: "special",
		description: "Accumulate big save totals.",
		tiers: {
			bronze: { threshold: 25, description: "Make 25 saves" },
			silver: { threshold: 75, description: "Make 75 saves" },
			gold: { threshold: 150, description: "Make 150 saves" },
			diamond: { threshold: 300, description: "Make 300 saves" },
		},
		evaluate: (player) => Number(player.saves ?? 0) || 0,
	},
	ftp_points_scored: {
		name: "FTP Points Scored",
		category: "special",
		description: "Accumulate total fantasy points (FTP).",
		tiers: {
			bronze: { threshold: 250, description: "Score 250 fantasy points" },
			silver: { threshold: 500, description: "Score 500 fantasy points" },
			gold: { threshold: 1000, description: "Score 1000 fantasy points" },
			diamond: { threshold: 2000, description: "Score 2000 fantasy points" },
		},
		evaluate: (player) => Number(player.fantasyPoints ?? 0) || 0,
	},
	clean_season: {
		name: "Clean Season",
		category: "special",
		description: "Complete a season with no yellow or red cards.",
		tiers: {
			gold: { threshold: 1, description: "Complete a season without a yellow or red card" },
		},
		evaluate: (player) => {
			const bestNoCardRun = Number(player.seasonBestDisciplineStreak ?? 0) || 0;
			const seasonAppsPeak = Number(player.maxAppsInSeason ?? 0) || 0;
			return seasonAppsPeak > 0 && bestNoCardRun >= seasonAppsPeak ? 1 : 0;
		},
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
