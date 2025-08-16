const { neo4jService } = require('../../lib/neo4j')

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

    // Import chatbot service dynamically
    const { chatbotService } = require('../../lib/services/chatbotService')
    const response = await chatbotService.processQuestion(body)

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response)
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
