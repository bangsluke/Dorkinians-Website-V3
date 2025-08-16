// Netlify Function for Chatbot API
exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  }

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    }
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const body = JSON.parse(event.body)
    const { question } = body

    if (!question || typeof question !== 'string') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Question is required and must be a string' })
      }
    }

    console.log(`🤖 Received question: ${question}`)

    // For now, return a mock response since we can't import the full service
    // In production, you'd need to bundle the dependencies or use a different approach
    const mockResponse = {
      answer: "I'm currently being deployed to production. Please try again in a few minutes.",
      confidence: 0.5,
      sources: [],
      visualization: undefined
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(mockResponse)
    }
  } catch (error) {
    console.error('❌ Chatbot API error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal server error' })
    }
  }
}
