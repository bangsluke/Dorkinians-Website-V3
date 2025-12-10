// Core data types
export interface Player {
	name: string;
	allowOnSite: boolean;
}

export interface Fixture {
	id: number;
	season: string;
	fixId: number;
	seasonFixId: string;
	date: string;
	team: string;
	compType: string;
	competition: string;
	opposition: string;
	homeAway: string;
	result: string;
	homeScore: number;
	awayScore: number;
	status: string;
	oppoOwnGoals: number;
	fullResult: string;
	dorkiniansGoals: number;
	conceded: number;
}

export interface MatchDetail {
	team: string;
	playerName: string;
	date: string;
	min: number;
	class: string;
	mom: boolean;
	goals: number;
	assists: number;
	yellowCards: number;
	redCards: number;
	saves: number;
	ownGoals: number;
	conceded: number;
	cleanSheets: number;
	penaltiesScored: number;
	penaltiesMissed: number;
	penaltiesConceded: number;
	penaltiesSaved: number;
}

export interface WeeklyTOTW {
	season: string;
	week: number;
	seasonWeekNumRef: string;
	dateLookup: string;
	seasonMonthRef: string;
	weekAdjusted: string;
	bestFormation: string;
	totwScore: number;
	playerCount: number;
	starMan: string;
	starManScore: number;
	playerLookups: string;
	gk1: string;
	def1: string;
	def2: string;
	def3: string;
	def4: string;
	def5: string;
	mid1: string;
	mid2: string;
	mid3: string;
	mid4: string;
	mid5: string;
	fwd1: string;
	fwd2: string;
	fwd3: string;
}

export interface SeasonTOTW {
	season: string;
	month: string;
	seasonMonthRef: string;
	bestFormation: string;
	totwScore: number;
	playerCount: number;
	starMan: string;
	starManScore: number;
	playerLookups: string;
	gk1: string;
	def1: string;
	def2: string;
	def3: string;
	def4: string;
	def5: string;
	mid1: string;
	mid2: string;
	mid3: string;
	mid4: string;
	mid5: string;
	fwd1: string;
	fwd2: string;
	fwd3: string;
}

export interface PlayersOfTheMonth {
	season: string;
	month: string;
	seasonMonthRef: string;
	playerName: string;
	team: string;
	position: string;
	goals: number;
	assists: number;
	cleanSheets: number;
	totwAppearances: number;
	starManCount: number;
	totalScore: number;
}

export interface StatDetail {
	statName: string;
	statValue: string;
	statDescription: string;
}

export interface CaptainAward {
	season: string;
	team: string;
	captain: string;
	viceCaptain: string;
	mostImproved: string;
	playersPlayer: string;
	managersPlayer: string;
	topScorer: string;
	topAssister: string;
	mostCleanSheets: string;
	mostTOTW: string;
	mostStarMan: string;
}

export interface OppositionDetails {
	oppositionName: string;
	league: string;
	division: string;
	homeGround: string;
	contactPerson: string;
	contactEmail: string;
	contactPhone: string;
}

import { VisualizationType } from "../config/config";

// Chart component types
export interface ChartComponent {
	type: VisualizationType;
	data: any;
	config?: ChartConfig;
}

export interface ChartConfig {
	title?: string;
	subtitle?: string;
	colorScheme?: string[];
	showLegend?: boolean;
	responsive?: boolean;
}

// Navigation types
export type MainPage = "home" | "stats" | "totw" | "club-info";
export type StatsSubPage = "player-stats" | "club-stats" | "team-stats" | "comparison";

// API response types
export interface ChatbotResponse {
	answer: string;
	chartComponent?: ChartComponent;
	dataSource: string;
}

export interface DataUpdateResponse {
	success: boolean;
	message: string;
	recordsProcessed: number;
	errors?: string[];
}

export interface DataSource {
	name: string;
	url: string;
	type: string;
	maxRows?: number; // Optional property for reduced seeding mode
}
