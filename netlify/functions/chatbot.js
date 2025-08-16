// Netlify Function for Chatbot API
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

    // Import and use the chatbot service
    const { chatbotService } = require('../../lib/services/chatbotService')
    
    // Process the question
    const response = await chatbotService.processQuestion({ question })

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(response)
    }
  } catch (error) {
    console.error('❌ Chatbot API error:', error)
    
    // Return a user-friendly error response
    const errorResponse = {
      answer: "I'm sorry, I'm having trouble processing your question right now. Please try again in a moment.",
      confidence: 0.1,
      sources: [],
      visualization: undefined
    }

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify(errorResponse)
    }
  }
}
