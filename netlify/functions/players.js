const { neo4jService } = require('./lib/neo4j');

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type, Authorization",
};

exports.handler = async (event, context) => {
	// Handle CORS preflight requests
	if (event.httpMethod === 'OPTIONS') {
		return {
			statusCode: 200,
			headers: corsHeaders,
			body: ''
		};
	}

	// Only allow GET requests
	if (event.httpMethod !== 'GET') {
		return {
			statusCode: 405,
			headers: corsHeaders,
			body: JSON.stringify({ error: 'Method not allowed' })
		};
	}

	try {
		// Connect to Neo4j
		const connected = await neo4jService.connect();
		if (!connected) {
			return {
				statusCode: 500,
				headers: corsHeaders,
				body: JSON.stringify({ error: "Database connection failed" })
			};
		}

		// Fetch all players that are allowed on site
		const query = `
			MATCH (p:Player {graphLabel: $graphLabel})
			WHERE p.allowOnSite = true
			RETURN p.playerName as playerName, p.mostPlayedForTeam as mostPlayedForTeam
			ORDER BY p.playerName
		`;
		const params = { graphLabel: neo4jService.getGraphLabel() };

		const result = await neo4jService.runQuery(query, params);

		const players = result.records
			.map((record) => ({
				playerName: String(record.get("playerName") || ""),
				mostPlayedForTeam: String(record.get("mostPlayedForTeam") || ""),
			}))
			.filter((player) => player.playerName && player.playerName.trim() !== "");

		return {
			statusCode: 200,
			headers: corsHeaders,
			body: JSON.stringify({ players })
		};
	} catch (error) {
		console.error('Error fetching players:', error);
		return {
			statusCode: 500,
			headers: corsHeaders,
			body: JSON.stringify({ error: "Failed to fetch players" })
		};
	}
};
