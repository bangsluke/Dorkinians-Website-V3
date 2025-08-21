// Netlify Function for Chatbot API
// Simple implementation for static export deployment

exports.handler = async (event, context) => {
	// Enable CORS
	const headers = {
		"Access-Control-Allow-Origin": "*",
		"Access-Control-Allow-Headers": "Content-Type",
		"Access-Control-Allow-Methods": "POST, OPTIONS",
	};

	// Handle preflight requests
	if (event.httpMethod === "OPTIONS") {
		return {
			statusCode: 200,
			headers,
			body: "",
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
		const { question } = body;

		if (!question || typeof question !== "string") {
			return {
				statusCode: 400,
				headers,
				body: JSON.stringify({ error: "Question is required and must be a string" }),
			};
		}

		console.log(`🤖 Received question: ${question}`);

		// Simple response for now - you can enhance this later
		const response = {
			answer: "I'm a simple chatbot that's currently being set up. I can't process complex questions yet, but I'm here to help!",
			confidence: 0.8,
			sources: [],
			visualization: undefined,
		};

		return {
			statusCode: 200,
			headers,
			body: JSON.stringify(response),
		};
	} catch (error) {
		console.error("❌ Chatbot API error:", error);

		// Return a user-friendly error response
		const errorResponse = {
			answer: "I'm sorry, I'm having trouble processing your question right now. Please try again in a moment.",
			confidence: 0.1,
			sources: [],
			visualization: undefined,
		};

		return {
			statusCode: 500,
			headers,
			body: JSON.stringify(errorResponse),
		};
	}
};
