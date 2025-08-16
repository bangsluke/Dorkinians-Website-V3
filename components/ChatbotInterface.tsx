'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ChatbotResponse } from '@/lib/services/chatbotService'
import { AnimatePresence } from 'framer-motion'

interface SavedConversation {
  question: string
  response: ChatbotResponse
  timestamp: number
}

export default function ChatbotInterface() {
  const [question, setQuestion] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [response, setResponse] = useState<ChatbotResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [conversationHistory, setConversationHistory] = useState<SavedConversation[]>([])

  // Load conversation history from localStorage on component mount
  useEffect(() => {
    const saved = localStorage.getItem('chatbotConversations')
    if (saved) {
      try {
        const history = JSON.parse(saved) as SavedConversation[]
        setConversationHistory(history)
      } catch (e) {
        console.warn('Failed to parse saved conversations:', e)
      }
    }
  }, [])

  // Save conversation history to localStorage whenever it changes
  useEffect(() => {
    if (conversationHistory.length > 0) {
      localStorage.setItem('chatbotConversations', JSON.stringify(conversationHistory))
    }
  }, [conversationHistory])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!question.trim()) return

    setIsLoading(true)
    setError(null)
    setResponse(null)

    try {
      const res = await fetch('/.netlify/functions/chatbot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question: question.trim() })
      })

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`)
      }

      const data: ChatbotResponse = await res.json()
      setResponse(data)
      
      // Save to conversation history
      const newConversation: SavedConversation = {
        question: question.trim(),
        response: data,
        timestamp: Date.now()
      }
      setConversationHistory(prev => [...prev, newConversation])
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  const renderVisualization = (visualization: ChatbotResponse['visualization']) => {
    if (!visualization) return null

    switch (visualization.type) {
      case 'table':
        return (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold text-gray-900 mb-2">Player Information</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    {visualization.config?.columns?.map((col: string) => (
                      <th key={col} className="text-left py-2 px-3 font-medium text-gray-700">
                        {col === 'name' ? 'Player Name' : col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visualization.data?.slice(0, 5).map((row: any, index: number) => (
                    <tr key={index} className="border-b border-gray-100">
                      {visualization.config?.columns?.map((col: string) => (
                        <td key={col} className="py-2 px-3 text-gray-600">
                          {row[col] || '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      
      case 'chart':
        return (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <h4 className="font-semibold text-gray-900 mb-2">Chart Visualization</h4>
            <p className="text-sm text-gray-600">Chart component will be integrated here</p>
          </div>
        )
      
      default:
        return null
    }
  }

  return (
    <div className="w-full max-w-2xl">
      {/* Question Input */}
      <form onSubmit={handleSubmit} className="mb-6">
        <div className="relative">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask me about player stats, team performance, or club information..."
            className="w-full px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-dorkinians-blue focus:border-transparent pr-12"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!question.trim() || isLoading}
            className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-dorkinians-blue text-white p-2 rounded-full hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
        
        <p className="text-sm text-gray-500 mt-2 text-center">
          Try: "How many players are in the club?" or "Who are the players?"
        </p>
      </form>

      {/* Response Display */}
      <AnimatePresence mode="wait">
        {isLoading && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-center py-8"
          >
            <div className="inline-flex items-center space-x-2">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-dorkinians-blue"></div>
              <span className="text-gray-600">Thinking...</span>
            </div>
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4"
          >
            <p className="text-red-800 text-sm">❌ {error}</p>
          </motion.div>
        )}

        {response && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm"
          >
            {/* Answer */}
            <div className="mb-4">
              <h3 className="font-semibold text-gray-900 mb-2">Answer:</h3>
              <p className="text-gray-700">{response.answer}</p>
            </div>

            {/* Confidence */}
            <div className="mb-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Confidence:</span>
                <div className="flex-1 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-dorkinians-blue h-2 rounded-full transition-all duration-300"
                    style={{ width: `${response.confidence * 100}%` }}
                  ></div>
                </div>
                <span className="text-sm text-gray-600">{Math.round(response.confidence * 100)}%</span>
              </div>
            </div>

            {/* Visualization */}
            {response.visualization && renderVisualization(response.visualization)}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Conversation History */}
      {conversationHistory.length > 0 && (
        <div className="mt-8">
          <h3 className="font-semibold text-gray-900 mb-4">Previous Conversations</h3>
          <div className="space-y-3">
            {conversationHistory.slice(-5).reverse().map((conv, index) => (
              <motion.div
                key={conv.timestamp}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="bg-gray-50 border border-gray-200 rounded-lg p-4"
              >
                <div className="flex items-start justify-between mb-2">
                  <p className="font-medium text-gray-900 text-sm">Q: {conv.question}</p>
                  <span className="text-xs text-gray-500">
                    {new Date(conv.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm text-gray-600">{conv.response.answer}</p>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
