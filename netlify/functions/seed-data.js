// Netlify Function for Seed Data API
// Simple implementation for static export deployment

exports.handler = async (event, context) => {
	// Enable CORS
	const headers = {
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Allow-Headers": "Content-Type",
		"Access-Control-Allow-Methods": "POST, GET, OPTIONS",
	};

	// Handle preflight requests
	if (event.httpMethod === "OPTIONS") {
		return {
			statusCode: 200,
			headers,
			body: "",
		};
	}

	if (event.httpMethod === "GET") {
		// Return basic stats for GET requests
		const stats = {
			database: {
				nodes: 0,
				relationships: 0,
			},
			cache: {
				hits: 0,
				misses: 0,
			},
		};

		return {
			statusCode: 200,
			headers,
			body: JSON.stringify(stats),
		};
	}

	if (event.httpMethod !== "POST") {
		return {
			statusCode: 405,
			headers,
			body: JSON.stringify({ error: "Method not allowed" }),
		};
	}

	try {
		const body = JSON.parse(event.body);
		const { dataSources, reducedMode } = body;

		if (!dataSources || !Array.isArray(dataSources)) {
			return {
				statusCode: 400,
				headers,
				body: JSON.stringify({ error: "dataSources array is required" }),
			};
		}

		console.log(`🌱 Seeding data with ${dataSources.length} sources${reducedMode ? ' (reduced mode)' : ''}`);

		// Simple response for now - you can enhance this later
		const response = {
			success: true,
			data: {
				nodesCreated: 0,
				relationshipsCreated: 0,
			},
			errors: [],
			unknownNodes: [],
		};

		return {
			statusCode: 200,
			headers,
			body: JSON.stringify(response),
		};
	} catch (error) {
		console.error("❌ Seed data API error:", error);

		return {
			statusCode: 500,
			headers,
			body: JSON.stringify({ error: "Internal server error" }),
		};
	}
};
