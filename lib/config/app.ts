export const appConfig = {
	version: "1.1.2",
	name: "Dorkinians FC",
	description: "Comprehensive source for club statistics, player performance, and team insights",
	author: "Luke Bangs",
	contact: "bangsluke@gmail.com"
} as const;

export type AppConfig = typeof appConfig;
