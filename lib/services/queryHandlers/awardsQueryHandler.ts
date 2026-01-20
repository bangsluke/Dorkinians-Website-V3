import { neo4jService } from "../../../netlify/functions/lib/neo4j.js";
import { ChatbotService } from "../chatbotService";
import { loggingService } from "../loggingService";

export class AwardsQueryHandler {
	/**
	 * Query TOTW (Team of the Week) data for a player
	 */
	static async queryPlayerTOTWData(playerName: string, period: "weekly" | "season", question?: string): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying for TOTW awards for player: ${playerName}, period: ${period}`, null, "log");
		const relationshipType = period === "weekly" ? "IN_WEEKLY_TOTW" : "IN_SEASON_TOTW";
		const graphLabel = neo4jService.getGraphLabel();

		// Check if question is asking for count (e.g., "how many times", "how many")
		const isCountQuestion = question && (
			question.toLowerCase().includes("how many times") ||
			question.toLowerCase().includes("how many") ||
			question.toLowerCase().includes("how much")
		);

		if (isCountQuestion) {
			// Return count query
			const totwNodeType = period === "weekly" ? "WeeklyTOTW" : "SeasonTOTW";
			const countQuery = period === "weekly"
				? `
					MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[r:IN_WEEKLY_TOTW]->(totw:WeeklyTOTW {graphLabel: $graphLabel})
					RETURN count(r) as totwCount
				`
				: `
					MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[r:IN_SEASON_TOTW]->(totw:SeasonTOTW {graphLabel: $graphLabel})
					RETURN count(r) as totwCount
				`;

			// Push query to chatbotService for extraction
			try {
				const chatbotService = ChatbotService.getInstance();
				const readyToExecuteQuery = countQuery
					.replace(/\$graphLabel/g, `'${graphLabel}'`)
					.replace(/\$playerName/g, `'${playerName}'`);
				chatbotService.lastExecutedQueries.push(`TOTW_COUNT_QUERY: ${countQuery}`);
				chatbotService.lastExecutedQueries.push(`TOTW_COUNT_READY_TO_EXECUTE: ${readyToExecuteQuery}`);
			} catch (error) {
				// Ignore if chatbotService not available
			}

			try {
				const result = await neo4jService.executeQuery(countQuery, { playerName, graphLabel });
				const count = result && result.length > 0 && result[0].totwCount !== undefined 
					? (typeof result[0].totwCount === 'number' 
						? result[0].totwCount 
						: (result[0].totwCount?.low || 0) + (result[0].totwCount?.high || 0) * 4294967296)
					: 0;
				return { type: "totw_count", count, playerName, period };
			} catch (error) {
				loggingService.log(`❌ Error in TOTW count query:`, error, "error");
				return { type: "error", data: [], error: "Error querying TOTW count data" };
			}
		}

		// Return list query (existing behavior)
		const query = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[r:${relationshipType}]->(totw {graphLabel: $graphLabel})
			RETURN p.playerName as playerName, 
			       totw.week as week, 
			       totw.season as season,
			       totw.date as date
			ORDER BY totw.date DESC
		`;

		try {
			const result = await neo4jService.executeQuery(query, { playerName, graphLabel });
			return { type: "totw_awards", data: result, playerName, period };
		} catch (error) {
			loggingService.log(`❌ Error in TOTW query:`, error, "error");
			return { type: "error", data: [], error: "Error querying TOTW data" };
		}
	}

	/**
	 * Query Player of the Month data for a player
	 */
	static async queryPlayersOfTheMonthData(playerName: string): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying for Player of the Month awards for player: ${playerName}`, null, "log");
		const query = `
			MATCH (p:Player {playerName: $playerName})-[r:PLAYER_OF_THE_MONTH]->(potm)
			RETURN p.playerName as playerName, 
			       potm.month as month, 
			       potm.year as year,
			       potm.season as season
			ORDER BY potm.year DESC, potm.month DESC
		`;

		try {
			const result = await neo4jService.executeQuery(query, { playerName });
			return { type: "potm_awards", data: result, playerName };
		} catch (error) {
			loggingService.log(`❌ Error in POTM query:`, error, "error");
			return { type: "error", data: [], error: "Error querying POTM data" };
		}
	}

	/**
	 * Query Captain awards data for a player
	 */
	static async queryPlayerCaptainAwardsData(playerName: string): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying for Captain awards for player: ${playerName}`, null, "log");
		const query = `
			MATCH (p:Player {playerName: $playerName})-[r:HAS_CAPTAIN_AWARDS]->(ca:CaptainsAndAwards)
			RETURN p.playerName as playerName, 
			       ca.season as season,
			       r.awardType as awardType,
			       ca.id as nodeId
			ORDER BY ca.season DESC, r.awardType
		`;

		try {
			const result = await neo4jService.executeQuery(query, { playerName });
			return { type: "captain_awards", data: result, playerName };
		} catch (error) {
			loggingService.log(`❌ Error in Captain query:`, error, "error");
			return { type: "error", data: [], error: "Error querying Captain data" };
		}
	}

	/**
	 * Query player awards count (excluding Captain items)
	 */
	static async queryPlayerAwardsCount(playerName: string): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying for awards count (excluding Captain) for player: ${playerName}`, null, "log");
		const graphLabel = neo4jService.getGraphLabel();
		
		const query = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[r:HAS_CAPTAIN_AWARDS]->(ca:CaptainsAndAwards {graphLabel: $graphLabel})
			WHERE NOT (ca.itemName CONTAINS "Captain")
			RETURN count(r) as awardCount
		`;

		// Push query to chatbotService for extraction
		try {
			const chatbotService = ChatbotService.getInstance();
			const readyToExecuteQuery = query
				.replace(/\$graphLabel/g, `'${graphLabel}'`)
				.replace(/\$playerName/g, `'${playerName}'`);
			chatbotService.lastExecutedQueries.push(`AWARDS_COUNT_QUERY: ${query}`);
			chatbotService.lastExecutedQueries.push(`AWARDS_COUNT_READY_TO_EXECUTE: ${readyToExecuteQuery}`);
		} catch (error) {
			// Ignore if chatbotService not available
		}

		try {
			const result = await neo4jService.executeQuery(query, { playerName, graphLabel });
			const count = result && result.length > 0 && result[0].awardCount !== undefined 
				? (typeof result[0].awardCount === 'number' 
					? result[0].awardCount 
					: (result[0].awardCount?.low || 0) + (result[0].awardCount?.high || 0) * 4294967296)
				: 0;
			return { type: "awards_count", count, playerName };
		} catch (error) {
			loggingService.log(`❌ Error in awards count query:`, error, "error");
			return { type: "error", data: [], error: "Error querying awards count data" };
		}
	}

	/**
	 * Query historical award winners for a specific award and season
	 */
	static async queryHistoricalAwardWinner(awardName: string, season?: string): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying historical award winner: ${awardName}${season ? ` for season ${season}` : ""}`, null, "log");
		const graphLabel = neo4jService.getGraphLabel();
		
		// First, find the award in CaptainsAndAwards
		let query = `
			MATCH (ca:CaptainsAndAwards {graphLabel: $graphLabel})
			WHERE toLower(ca.itemName) CONTAINS toLower($awardName)
		`;
		
		if (season) {
			// Map season to property name (e.g., "2018/19" -> "season201819")
			const seasonProp = season.replace("/", "");
			query += ` AND ca.season${seasonProp} IS NOT NULL AND ca.season${seasonProp} <> ""`;
		}
		
		query += `
			RETURN ca.itemName as awardName,
			       ca.season201617 as season201617,
			       ca.season201718 as season201718,
			       ca.season201819 as season201819,
			       ca.season201920 as season202020,
			       ca.season202021 as season202021,
			       ca.season202122 as season202122,
			       ca.season202223 as season202223,
			       ca.season202324 as season202324,
			       ca.season202425 as season202425,
			       ca.season202526 as season202526,
			       ca.season202627 as season202627
		`;

		try {
			const result = await neo4jService.executeQuery(query, { awardName, graphLabel });
			if (result && result.length > 0) {
				const award = result[0];
				if (season) {
					const seasonProp = `season${season.replace("/", "")}`;
					const winner = award[seasonProp];
					return { type: "historical_award", awardName: award.awardName, season, winner, data: award };
				}
				return { type: "historical_award", awardName: award.awardName, data: award };
			}
			return { type: "historical_award", data: null };
		} catch (error) {
			loggingService.log(`❌ Error in historical award query:`, error, "error");
			return { type: "error", data: [], error: "Error querying historical award data" };
		}
	}

	/**
	 * Query all awards won by a player historically
	 */
	static async queryPlayerHistoricalAwards(playerName: string): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying historical awards for player: ${playerName}`, null, "log");
		const graphLabel = neo4jService.getGraphLabel();
		
		const query = `
			MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})-[r:HAS_CAPTAIN_AWARDS]->(ca:CaptainsAndAwards {graphLabel: $graphLabel})
			RETURN ca.itemName as awardName,
			       r.season as season,
			       r.awardType as awardType
			ORDER BY r.season DESC, ca.itemName
		`;

		try {
			const result = await neo4jService.executeQuery(query, { playerName, graphLabel });
			return { type: "player_historical_awards", data: result, playerName };
		} catch (error) {
			loggingService.log(`❌ Error in player historical awards query:`, error, "error");
			return { type: "error", data: [], error: "Error querying player historical awards data" };
		}
	}

	/**
	 * Query all winners of a specific award
	 */
	static async queryAllAwardWinners(awardName: string): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying all winners of award: ${awardName}`, null, "log");
		const graphLabel = neo4jService.getGraphLabel();
		
		const query = `
			MATCH (p:Player {graphLabel: $graphLabel})-[r:HAS_CAPTAIN_AWARDS]->(ca:CaptainsAndAwards {graphLabel: $graphLabel})
			WHERE toLower(ca.itemName) CONTAINS toLower($awardName)
			RETURN p.playerName as playerName,
			       ca.itemName as awardName,
			       r.season as season,
			       r.awardType as awardType
			ORDER BY r.season DESC, p.playerName
		`;

		try {
			const result = await neo4jService.executeQuery(query, { awardName, graphLabel });
			return { type: "all_award_winners", data: result, awardName };
		} catch (error) {
			loggingService.log(`❌ Error in all award winners query:`, error, "error");
			return { type: "error", data: [], error: "Error querying all award winners data" };
		}
	}

	/**
	 * Query PlayersOfTheMonth by month and year
	 */
	static async queryPlayersOfTheMonthByDate(month: string, year: number): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying PlayersOfTheMonth for ${month} ${year}`, null, "log");
		const graphLabel = neo4jService.getGraphLabel();
		
		const monthNames = [
			"January", "February", "March", "April", "May", "June",
			"July", "August", "September", "October", "November", "December"
		];
		
		const monthIndex = monthNames.findIndex((m) => m.toLowerCase() === month.toLowerCase());
		if (monthIndex === -1) {
			return { type: "error", data: [], error: `Invalid month name: ${month}` };
		}
		
		const monthNum = String(monthIndex + 1).padStart(2, "0");
		
		// Query PlayersOfTheMonth node matching the month and year
		// Return explicit properties to ensure we can access them correctly
		const query = `
			MATCH (pm:PlayersOfTheMonth {graphLabel: $graphLabel})
			WHERE pm.date IS NOT NULL
			WITH pm, pm.date as dateStr
			WHERE dateStr CONTAINS '-' OR dateStr CONTAINS '/' OR dateStr CONTAINS ','
			WITH pm, 
			     CASE 
			       WHEN dateStr CONTAINS 'T' THEN substring(dateStr, 0, size(dateStr) - size(split(dateStr, 'T')[1]) - 1)
			       ELSE dateStr
			     END as dateOnly
			WITH pm, dateOnly,
			     CASE 
			       WHEN dateOnly CONTAINS '-' THEN split(dateOnly, '-')[0]
			       WHEN dateOnly CONTAINS '/' THEN split(dateOnly, '/')[0]
			       WHEN dateOnly CONTAINS ',' THEN 
			         CASE 
			           WHEN dateOnly CONTAINS ' ' THEN split(dateOnly, ' ')[size(split(dateOnly, ' ')) - 1]
			           ELSE ''
			         END
			       ELSE ''
			     END as yearPart,
			     CASE 
			       WHEN dateOnly CONTAINS '-' THEN split(dateOnly, '-')[1]
			       WHEN dateOnly CONTAINS '/' THEN split(dateOnly, '/')[1]
			       WHEN dateOnly CONTAINS ',' THEN 
			         CASE 
			           WHEN dateOnly CONTAINS ' ' THEN 
			             CASE 
			               WHEN toLower(split(dateOnly, ' ')[size(split(dateOnly, ' ')) - 3]) CONTAINS 'jan' THEN '01'
			               WHEN toLower(split(dateOnly, ' ')[size(split(dateOnly, ' ')) - 3]) CONTAINS 'feb' THEN '02'
			               WHEN toLower(split(dateOnly, ' ')[size(split(dateOnly, ' ')) - 3]) CONTAINS 'mar' THEN '03'
			               WHEN toLower(split(dateOnly, ' ')[size(split(dateOnly, ' ')) - 3]) CONTAINS 'apr' THEN '04'
			               WHEN toLower(split(dateOnly, ' ')[size(split(dateOnly, ' ')) - 3]) CONTAINS 'may' THEN '05'
			               WHEN toLower(split(dateOnly, ' ')[size(split(dateOnly, ' ')) - 3]) CONTAINS 'jun' THEN '06'
			               WHEN toLower(split(dateOnly, ' ')[size(split(dateOnly, ' ')) - 3]) CONTAINS 'jul' THEN '07'
			               WHEN toLower(split(dateOnly, ' ')[size(split(dateOnly, ' ')) - 3]) CONTAINS 'aug' THEN '08'
			               WHEN toLower(split(dateOnly, ' ')[size(split(dateOnly, ' ')) - 3]) CONTAINS 'sep' THEN '09'
			               WHEN toLower(split(dateOnly, ' ')[size(split(dateOnly, ' ')) - 3]) CONTAINS 'oct' THEN '10'
			               WHEN toLower(split(dateOnly, ' ')[size(split(dateOnly, ' ')) - 3]) CONTAINS 'nov' THEN '11'
			               WHEN toLower(split(dateOnly, ' ')[size(split(dateOnly, ' ')) - 3]) CONTAINS 'dec' THEN '12'
			               ELSE ''
			             END
			           ELSE ''
			         END
			       ELSE ''
			     END as monthPart
			WHERE (yearPart = $yearStr OR yearPart = $yearStrShort) AND monthPart = $monthNum
			RETURN pm.player1Name as player1Name,
			       COALESCE(pm.player1Score, 0) as player1Score,
			       pm.player2Name as player2Name,
			       COALESCE(pm.player2Score, 0) as player2Score,
			       pm.player3Name as player3Name,
			       COALESCE(pm.player3Score, 0) as player3Score,
			       pm.player4Name as player4Name,
			       COALESCE(pm.player4Score, 0) as player4Score,
			       pm.player5Name as player5Name,
			       COALESCE(pm.player5Score, 0) as player5Score,
			       pm.season as season,
			       pm.date as date
			LIMIT 1
		`;
		
		const yearStr = String(year);
		const yearStrShort = String(year).slice(-2);
		
		// Push query to chatbotService for extraction
		try {
			const chatbotService = ChatbotService.getInstance();
			let readyToExecuteQuery = query
				.replace(/\$graphLabel/g, `'${graphLabel}'`)
				.replace(/\$yearStr/g, `'${yearStr}'`)
				.replace(/\$yearStrShort/g, `'${yearStrShort}'`)
				.replace(/\$monthNum/g, `'${monthNum}'`);
			chatbotService.lastExecutedQueries.push(`PLAYERS_OF_THE_MONTH_QUERY: ${query}`);
			chatbotService.lastExecutedQueries.push(`PLAYERS_OF_THE_MONTH_READY_TO_EXECUTE: ${readyToExecuteQuery}`);
		} catch (error) {
			// Ignore if chatbotService not available
		}
		
		try {
			const result = await neo4jService.executeQuery(query, { graphLabel, yearStr, yearStrShort, monthNum });
			
			if (!result || result.length === 0) {
				// Try alternative approach: fetch all and filter in JavaScript
				// Try alternative approach: fetch all and filter in JavaScript
				const allQuery = `
					MATCH (pm:PlayersOfTheMonth {graphLabel: $graphLabel})
					WHERE pm.date IS NOT NULL
					RETURN pm.player1Name as player1Name,
					       COALESCE(pm.player1Score, 0) as player1Score,
					       pm.player2Name as player2Name,
					       COALESCE(pm.player2Score, 0) as player2Score,
					       pm.player3Name as player3Name,
					       COALESCE(pm.player3Score, 0) as player3Score,
					       pm.player4Name as player4Name,
					       COALESCE(pm.player4Score, 0) as player4Score,
					       pm.player5Name as player5Name,
					       COALESCE(pm.player5Score, 0) as player5Score,
					       pm.season as season,
					       pm.date as date
				`;
				
				const allResult = await neo4jService.executeQuery(allQuery, { graphLabel });
				
				// Handle Neo4j Integer types for scores
				const getScore = (value: any): number => {
					if (value === null || value === undefined) return 0;
					if (typeof value === 'number') return value;
					// Handle Neo4j Integer objects
					if (value && typeof value === 'object') {
						if (typeof value.toNumber === 'function') {
							return value.toNumber();
						}
						if (value.low !== undefined || value.high !== undefined) {
							return (value.low || 0) + (value.high || 0) * 4294967296;
						}
					}
					const num = Number(value);
					return isNaN(num) ? 0 : num;
				};
				
				const matchingRecord = allResult.find((record: any) => {
					const dateValue = record.date;
					if (!dateValue) return false;
					
					let dateStr = String(dateValue);
					let date: Date;
					
					if (dateStr.includes("T")) {
						date = new Date(dateStr);
					} else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
						date = new Date(dateStr + "T00:00:00");
					} else {
						date = new Date(dateStr);
					}
					
					if (isNaN(date.getTime())) return false;
					return date.getMonth() === monthIndex && date.getFullYear() === year;
				});
				
				if (!matchingRecord) {
					return { type: "potm_by_date", data: null, month, year, error: "No PlayersOfTheMonth data found for the specified month and year" };
				}
				
				const season = matchingRecord.season || "";
				const seasonMonth = `${season}-${month}`;
				
				// Helper to calculate FTP score from MatchDetail if score is missing
				const calculateFtpScore = async (playerName: string): Promise<number> => {
					if (!playerName) return 0;
					
					const ftpQuery = `
						MATCH (md:MatchDetail {graphLabel: $graphLabel, playerName: $playerName, seasonMonth: $seasonMonth})
						RETURN sum(COALESCE(md.fantasyPoints, 0)) as totalFtpScore
					`;
					
					try {
						const ftpResult = await neo4jService.executeQuery(ftpQuery, { graphLabel, playerName, seasonMonth });
						if (ftpResult && ftpResult.length > 0) {
							const score = ftpResult[0].totalFtpScore;
							if (score !== null && score !== undefined) {
								if (typeof score === 'number') return score;
								if (score && typeof score === 'object') {
									if (typeof score.toNumber === 'function') return score.toNumber();
									if (score.low !== undefined || score.high !== undefined) {
										return (score.low || 0) + (score.high || 0) * 4294967296;
									}
								}
								return Number(score) || 0;
							}
						}
					} catch (error) {
						loggingService.log(`❌ Error calculating FTP score for ${playerName}:`, error, "error");
					}
					return 0;
				};
				
				// Get scores from the node first
				let player1Score = getScore(matchingRecord.player1Score);
				let player2Score = getScore(matchingRecord.player2Score);
				let player3Score = getScore(matchingRecord.player3Score);
				let player4Score = getScore(matchingRecord.player4Score);
				let player5Score = getScore(matchingRecord.player5Score);
				
				// If scores are 0, calculate from MatchDetail (fallback)
				if (player1Score === 0 && matchingRecord.player1Name) {
					player1Score = await calculateFtpScore(matchingRecord.player1Name);
				}
				if (player2Score === 0 && matchingRecord.player2Name) {
					player2Score = await calculateFtpScore(matchingRecord.player2Name);
				}
				if (player3Score === 0 && matchingRecord.player3Name) {
					player3Score = await calculateFtpScore(matchingRecord.player3Name);
				}
				if (player4Score === 0 && matchingRecord.player4Name) {
					player4Score = await calculateFtpScore(matchingRecord.player4Name);
				}
				if (player5Score === 0 && matchingRecord.player5Name) {
					player5Score = await calculateFtpScore(matchingRecord.player5Name);
				}
				
				// Round scores to 0 decimal places
				return {
					type: "potm_by_date",
					data: {
						player1Name: matchingRecord.player1Name || null,
						player1Score: Math.round(player1Score),
						player2Name: matchingRecord.player2Name || null,
						player2Score: Math.round(player2Score),
						player3Name: matchingRecord.player3Name || null,
						player3Score: Math.round(player3Score),
						player4Name: matchingRecord.player4Name || null,
						player4Score: Math.round(player4Score),
						player5Name: matchingRecord.player5Name || null,
						player5Score: Math.round(player5Score),
					},
					month,
					year,
				};
			}
			
			// executeQuery returns array of objects with the returned properties directly
			const firstResult = result[0];
			const season = firstResult?.season || "";
			
			// Handle Neo4j Integer types for scores
			const getScore = (value: any): number => {
				if (value === null || value === undefined) return 0;
				if (typeof value === 'number') return value;
				// Handle Neo4j Integer objects
				if (value && typeof value === 'object') {
					if (typeof value.toNumber === 'function') {
						return value.toNumber();
					}
					if (value.low !== undefined || value.high !== undefined) {
						return (value.low || 0) + (value.high || 0) * 4294967296;
					}
				}
				const num = Number(value);
				return isNaN(num) ? 0 : num;
			};
			
			// If scores are 0 or null, calculate them from MatchDetail nodes
			// Format: season-month (e.g., "2022/23-January")
			const seasonMonth = `${season}-${month}`;
			
			// Helper to calculate FTP score from MatchDetail if score is missing
			const calculateFtpScore = async (playerName: string): Promise<number> => {
				if (!playerName) return 0;
				
				const ftpQuery = `
					MATCH (md:MatchDetail {graphLabel: $graphLabel, playerName: $playerName, seasonMonth: $seasonMonth})
					RETURN sum(COALESCE(md.fantasyPoints, 0)) as totalFtpScore
				`;
				
				try {
					const ftpResult = await neo4jService.executeQuery(ftpQuery, { graphLabel, playerName, seasonMonth });
					if (ftpResult && ftpResult.length > 0) {
						const score = ftpResult[0].totalFtpScore;
						if (score !== null && score !== undefined) {
							if (typeof score === 'number') return score;
							if (score && typeof score === 'object') {
								if (typeof score.toNumber === 'function') return score.toNumber();
								if (score.low !== undefined || score.high !== undefined) {
									return (score.low || 0) + (score.high || 0) * 4294967296;
								}
							}
							return Number(score) || 0;
						}
					}
				} catch (error) {
					loggingService.log(`❌ Error calculating FTP score for ${playerName}:`, error, "error");
				}
				return 0;
			};
			
			// Get scores from the node first
			let player1Score = getScore(firstResult?.player1Score);
			let player2Score = getScore(firstResult?.player2Score);
			let player3Score = getScore(firstResult?.player3Score);
			let player4Score = getScore(firstResult?.player4Score);
			let player5Score = getScore(firstResult?.player5Score);
			
			// If scores are 0, calculate from MatchDetail (fallback)
			// This handles cases where scores aren't stored in the PlayersOfTheMonth node
			if (player1Score === 0 && firstResult?.player1Name) {
				player1Score = await calculateFtpScore(firstResult.player1Name);
			}
			if (player2Score === 0 && firstResult?.player2Name) {
				player2Score = await calculateFtpScore(firstResult.player2Name);
			}
			if (player3Score === 0 && firstResult?.player3Name) {
				player3Score = await calculateFtpScore(firstResult.player3Name);
			}
			if (player4Score === 0 && firstResult?.player4Name) {
				player4Score = await calculateFtpScore(firstResult.player4Name);
			}
			if (player5Score === 0 && firstResult?.player5Name) {
				player5Score = await calculateFtpScore(firstResult.player5Name);
			}
			
			// Round scores to 0 decimal places
			return {
				type: "potm_by_date",
				data: {
					player1Name: firstResult?.player1Name || null,
					player1Score: Math.round(player1Score),
					player2Name: firstResult?.player2Name || null,
					player2Score: Math.round(player2Score),
					player3Name: firstResult?.player3Name || null,
					player3Score: Math.round(player3Score),
					player4Name: firstResult?.player4Name || null,
					player4Score: Math.round(player4Score),
					player5Name: firstResult?.player5Name || null,
					player5Score: Math.round(player5Score),
				},
				month,
				year,
			};
		} catch (error) {
			loggingService.log(`❌ Error in PlayersOfTheMonth by date query:`, error, "error");
			return { type: "error", data: [], error: "Error querying PlayersOfTheMonth data" };
		}
	}

	/**
	 * Query WeeklyTOTW by month, year, and week
	 */
	static async queryWeeklyTOTWByDate(month: string, year: number, weekNumber?: number): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying WeeklyTOTW for ${month} ${year}${weekNumber ? ` week ${weekNumber}` : " (first week)"}`, null, "log");
		const graphLabel = neo4jService.getGraphLabel();
		
		const monthNames = [
			"January", "February", "March", "April", "May", "June",
			"July", "August", "September", "October", "November", "December"
		];
		
		const monthIndex = monthNames.findIndex((m) => m.toLowerCase() === month.toLowerCase());
		if (monthIndex === -1) {
			return { type: "error", data: [], error: `Invalid month name: ${month}` };
		}
		
		// Calculate first week of month: first 7 days
		const firstDayOfMonth = new Date(year, monthIndex, 1);
		const lastDayOfFirstWeek = new Date(year, monthIndex, 7);
		
		// Query WeeklyTOTW nodes and find the one in the first week of the month
		const query = `
			MATCH (wt:WeeklyTOTW {graphLabel: $graphLabel})
			WHERE wt.dateLookup IS NOT NULL OR wt.date IS NOT NULL
			RETURN wt
			ORDER BY wt.season, wt.week
		`;
		
		// Push query to chatbotService for extraction
		try {
			const chatbotService = ChatbotService.getInstance();
			const readyToExecuteQuery = query.replace(/\$graphLabel/g, `'${graphLabel}'`);
			chatbotService.lastExecutedQueries.push(`TOTW_BY_DATE_QUERY: ${query}`);
			chatbotService.lastExecutedQueries.push(`TOTW_BY_DATE_READY_TO_EXECUTE: ${readyToExecuteQuery}`);
		} catch (error) {
			// Ignore if chatbotService not available
		}
		
		try {
			const result = await neo4jService.executeQuery(query, { graphLabel });
			
			if (!result || result.length === 0) {
				return { type: "totw_by_date", data: null, month, year, week: weekNumber || 1, error: "No WeeklyTOTW data found" };
			}
			
			// Find the WeeklyTOTW node for the first week of the specified month/year
			let matchingTOTW: any = null;
			
			for (const record of result) {
				// executeQuery returns objects with properties directly
				const wt = record.wt || record;
				const properties = wt?.properties || wt;
				const dateLookup = properties?.dateLookup || properties?.date;
				
				if (!dateLookup) continue;
				
				let date: Date;
				const dateStr = String(dateLookup);
				
				if (dateStr.includes("T")) {
					date = new Date(dateStr);
				} else if (dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
					date = new Date(dateStr + "T00:00:00");
				} else {
					date = new Date(dateStr);
				}
				
				if (isNaN(date.getTime())) continue;
				
				// Check if date is in the first week of the specified month/year
				if (date.getFullYear() === year && date.getMonth() === monthIndex) {
					const dayOfMonth = date.getDate();
					if (dayOfMonth <= 7) {
						matchingTOTW = properties;
						break;
					}
				}
			}
			
			if (!matchingTOTW) {
				return { type: "totw_by_date", data: null, month, year, week: weekNumber || 1, error: "No WeeklyTOTW data found for the first week of the specified month and year" };
			}
			
			// Extract players based on bestFormation
			const bestFormation = matchingTOTW.bestFormation || "";
			const season = matchingTOTW.season || "";
			const week = matchingTOTW.week || weekNumber || 1;
			const seasonWeek = `${season}-${week}`;
			
			// Parse bestFormation to determine which positions to include
			// Format is typically "DEF-MID-FWD" (e.g., "4-4-2")
			let numDef = 4; // Default
			let numMid = 4; // Default
			let numFwd = 2; // Default
			
			if (bestFormation) {
				const formationParts = bestFormation.split("-");
				if (formationParts.length >= 3) {
					numDef = parseInt(formationParts[0], 10) || 4;
					numMid = parseInt(formationParts[1], 10) || 4;
					numFwd = parseInt(formationParts[2], 10) || 2;
				} else if (formationParts.length === 2) {
					// Handle formats like "4-4" (assume 2 forwards)
					numDef = parseInt(formationParts[0], 10) || 4;
					numMid = parseInt(formationParts[1], 10) || 4;
					numFwd = 2;
				}
			}
			
			// Clamp values to valid ranges
			numDef = Math.max(0, Math.min(5, numDef));
			numMid = Math.max(0, Math.min(5, numMid));
			numFwd = Math.max(0, Math.min(3, numFwd));
			
			// Get all players from the formation
			const players: Array<{ playerName: string; position: string; points: number }> = [];
			
			// Build position fields based on bestFormation
			const positionFields: Array<{ field: string; position: string }> = [];
			
			// Always include goalkeeper
			positionFields.push({ field: "gk1", position: "GK" });
			
			// Add defenders based on formation
			for (let i = 1; i <= numDef; i++) {
				positionFields.push({ field: `def${i}`, position: "DEF" });
			}
			
			// Add midfielders based on formation
			for (let i = 1; i <= numMid; i++) {
				positionFields.push({ field: `mid${i}`, position: "MID" });
			}
			
			// Add forwards based on formation
			for (let i = 1; i <= numFwd; i++) {
				positionFields.push({ field: `fwd${i}`, position: "FWD" });
			}
			
			for (const { field, position } of positionFields) {
				const playerName = matchingTOTW[field];
				if (playerName && String(playerName).trim() !== "") {
					// Query FTP score for this player for this week
					const ftpQuery = `
						MATCH (md:MatchDetail {graphLabel: $graphLabel, playerName: $playerName, seasonWeek: $seasonWeek})
						RETURN sum(COALESCE(md.fantasyPoints, 0)) as totalFtpScore
					`;
					
					try {
						const ftpResult = await neo4jService.executeQuery(ftpQuery, { graphLabel, playerName, seasonWeek });
						const ftpScore = ftpResult && ftpResult.length > 0 && ftpResult[0].totalFtpScore !== undefined
							? (typeof ftpResult[0].totalFtpScore === 'number' 
								? ftpResult[0].totalFtpScore 
								: (ftpResult[0].totalFtpScore?.low || 0) + (ftpResult[0].totalFtpScore?.high || 0) * 4294967296)
							: 0;
						
						// Round points to 0 decimal places
						players.push({
							playerName: String(playerName),
							position: position,
							points: Math.round(ftpScore),
						});
					} catch (error) {
						loggingService.log(`❌ Error querying FTP score for ${playerName}:`, error, "error");
						players.push({
							playerName: String(playerName),
							position: position,
							points: 0,
						});
					}
				}
			}
			
			return {
				type: "totw_by_date",
				data: {
					players: players,
					bestFormation: bestFormation,
					season: season,
					week: week,
				},
				month,
				year,
				week: week,
			};
		} catch (error) {
			loggingService.log(`❌ Error in WeeklyTOTW by date query:`, error, "error");
			return { type: "error", data: [], error: "Error querying WeeklyTOTW data" };
		}
	}

	/**
	 * Query SeasonTOTW (Team of the Season) data for a specific season
	 * @param season Optional season string (e.g., "2023/24"). If not provided, uses current season.
	 */
	static async querySeasonTOTW(season?: string): Promise<Record<string, unknown>> {
		loggingService.log(`🔍 Querying SeasonTOTW for season: ${season || "current"}`, null, "log");
		const graphLabel = neo4jService.getGraphLabel();

		try {
			// If no season provided, get current season from SiteDetail
			let targetSeason = season;
			if (!targetSeason) {
				const currentSeasonQuery = `
					MATCH (sd:SiteDetail {graphLabel: $graphLabel})
					RETURN sd.currentSeason as currentSeason
					LIMIT 1
				`;
				
				const seasonResult = await neo4jService.executeQuery(currentSeasonQuery, { graphLabel });
				if (seasonResult && seasonResult.length > 0 && seasonResult[0].currentSeason) {
					targetSeason = seasonResult[0].currentSeason;
					loggingService.log(`🔍 Using current season: ${targetSeason}`, null, "log");
				} else {
					// Fallback: get most recent SeasonTOTW season
					const recentSeasonQuery = `
						MATCH (st:SeasonTOTW {graphLabel: $graphLabel})
						WHERE st.season IS NOT NULL AND st.season <> ''
						WITH DISTINCT st.season as season
						ORDER BY season DESC
						LIMIT 1
						RETURN season
					`;
					const recentResult = await neo4jService.executeQuery(recentSeasonQuery, { graphLabel });
					if (recentResult && recentResult.length > 0 && recentResult[0].season) {
						targetSeason = recentResult[0].season;
						loggingService.log(`🔍 Using most recent SeasonTOTW season: ${targetSeason}`, null, "log");
					} else {
						return { 
							type: "error", 
							data: [], 
							error: "Could not determine season for Team of the Season query" 
						};
					}
				}
			}

			// Normalize season format (handle "22/23" -> "2022/23")
			if (targetSeason && targetSeason.match(/^\d{2}\/\d{2}$/)) {
				const parts = targetSeason.split("/");
				targetSeason = `20${parts[0]}/${parts[1]}`;
			}

			// Query SeasonTOTW node for the specified season
			const totwQuery = `
				MATCH (st:SeasonTOTW {graphLabel: $graphLabel, season: $season})
				RETURN st
				LIMIT 1
			`;

			// Push query to chatbotService for extraction
			try {
				const chatbotService = ChatbotService.getInstance();
				const readyToExecuteQuery = totwQuery
					.replace(/\$graphLabel/g, `'${graphLabel}'`)
					.replace(/\$season/g, `'${targetSeason}'`);
				chatbotService.lastExecutedQueries.push(`SEASON_TOTW_QUERY: ${totwQuery}`);
				chatbotService.lastExecutedQueries.push(`SEASON_TOTW_READY_TO_EXECUTE: ${readyToExecuteQuery}`);
			} catch (error) {
				// Ignore if chatbotService not available
			}

			const totwResult = await neo4jService.executeQuery(totwQuery, { graphLabel, season: targetSeason });

			if (!totwResult || totwResult.length === 0) {
				return { 
					type: "season_totw_not_found", 
					data: [], 
					season: targetSeason,
					message: `No Team of the Season data found for ${targetSeason}` 
				};
			}

			// Extract SeasonTOTW properties
			const totwRecord = totwResult[0];
			const st = totwRecord.st || totwRecord;
			const stProperties = st?.properties || st;

			// Get bestFormation to determine which players to include
			const bestFormation = stProperties.bestFormation || "";

			// Parse bestFormation to determine which positions to include
			// Format is typically "DEF-MID-FWD" (e.g., "4-4-2")
			let numDef = 4; // Default
			let numMid = 4; // Default
			let numFwd = 2; // Default

			if (bestFormation) {
				const formationParts = bestFormation.split("-");
				if (formationParts.length >= 3) {
					numDef = parseInt(formationParts[0], 10) || 4;
					numMid = parseInt(formationParts[1], 10) || 4;
					numFwd = parseInt(formationParts[2], 10) || 2;
				} else if (formationParts.length === 2) {
					// Handle formats like "4-4" (assume 2 forwards)
					numDef = parseInt(formationParts[0], 10) || 4;
					numMid = parseInt(formationParts[1], 10) || 4;
					numFwd = 2;
				}
			}

			// Clamp values to valid ranges
			numDef = Math.max(0, Math.min(5, numDef));
			numMid = Math.max(0, Math.min(5, numMid));
			numFwd = Math.max(0, Math.min(3, numFwd));

			// Build position fields based on bestFormation (only 11 players total)
			const positionFields: Array<{ field: string; position: string }> = [];

			// Always include goalkeeper
			positionFields.push({ field: "gk1", position: "GK" });

			// Add defenders based on formation
			for (let i = 1; i <= numDef; i++) {
				positionFields.push({ field: `def${i}`, position: "DEF" });
			}

			// Add midfielders based on formation
			for (let i = 1; i <= numMid; i++) {
				positionFields.push({ field: `mid${i}`, position: "MID" });
			}

			// Add forwards based on formation
			for (let i = 1; i <= numFwd; i++) {
				positionFields.push({ field: `fwd${i}`, position: "FWD" });
			}

			const players: Array<{ playerName: string; position: string; ftpScore: number }> = [];

			// Helper function to calculate FTP score for a player in a season
			const calculateFtpScore = async (playerName: string): Promise<number> => {
				if (!playerName || String(playerName).trim() === "") return 0;

				const ftpQuery = `
					MATCH (p:Player {graphLabel: $graphLabel, playerName: $playerName})
					MATCH (p)-[:PLAYED_IN]->(md:MatchDetail {graphLabel: $graphLabel, season: $season})
					RETURN sum(COALESCE(md.fantasyPoints, 0)) as totalFtpScore
				`;

				try {
					const ftpResult = await neo4jService.executeQuery(ftpQuery, { 
						graphLabel, 
						playerName, 
						season: targetSeason 
					});

					if (ftpResult && ftpResult.length > 0 && ftpResult[0].totalFtpScore !== undefined) {
						const score = ftpResult[0].totalFtpScore;
						if (typeof score === 'number') {
							return Math.round(score);
						}
						if (score && typeof score === 'object') {
							if (typeof score.toNumber === 'function') {
								return Math.round(score.toNumber());
							}
							if (score.low !== undefined || score.high !== undefined) {
								return Math.round((score.low || 0) + (score.high || 0) * 4294967296);
							}
						}
						return Math.round(Number(score) || 0);
					}
				} catch (error) {
					loggingService.log(`❌ Error calculating FTP score for ${playerName}:`, error, "error");
				}
				return 0;
			};

			// Process each position
			for (const { field, position } of positionFields) {
				const playerName = stProperties[field];
				if (playerName && String(playerName).trim() !== "") {
					const ftpScore = await calculateFtpScore(String(playerName));
					players.push({
						playerName: String(playerName),
						position: position,
						ftpScore: ftpScore
					});
				}
			}

			if (players.length === 0) {
				return { 
					type: "season_totw_no_players", 
					data: [], 
					season: targetSeason,
					message: `No players found in Team of the Season for ${targetSeason}` 
				};
			}

			return {
				type: "season_totw",
				data: {
					season: targetSeason,
					players: players
				}
			};
		} catch (error) {
			loggingService.log(`❌ Error in SeasonTOTW query:`, error, "error");
			return { type: "error", data: [], error: "Error querying SeasonTOTW data" };
		}
	}
}

export const awardsQueryHandler = new AwardsQueryHandler();
