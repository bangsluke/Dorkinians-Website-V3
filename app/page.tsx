'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'

export default function HomePage() {
  const [question, setQuestion] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!question.trim()) return

    setIsLoading(true)
    // TODO: Implement chatbot API call
    console.log('Question submitted:', question)
    
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false)
      setQuestion('')
    }, 2000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-dorkinians-blue to-blue-800 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between p-4 text-white">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
            <span className="text-dorkinians-blue font-bold text-sm">DFC</span>
          </div>
          <span className="font-semibold">Dorkinians FC</span>
        </div>
        <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center text-white mb-8"
        >
          <h1 className="text-4xl font-bold mb-4">Dorkinians FC Stats</h1>
          <p className="text-xl opacity-90 max-w-md mx-auto">
            Ask me anything about the club's statistics, players, and performance
          </p>
        </motion.div>

        {/* Chatbot Interface */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="w-full max-w-md"
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="e.g., How many goals have I scored for the 3rd team?"
                className="w-full px-4 py-3 text-gray-900 bg-white rounded-xl shadow-lg focus:outline-none focus:ring-2 focus:ring-dorkinians-gold focus:ring-opacity-50"
                disabled={isLoading}
              />
              {isLoading && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-dorkinians-blue"></div>
                </div>
              )}
            </div>
            
            <button
              type="submit"
              disabled={!question.trim() || isLoading}
              className="w-full bg-dorkinians-gold hover:bg-yellow-600 disabled:opacity-50 disabled:cursor-not-allowed text-gray-900 font-semibold py-3 px-6 rounded-xl transition-colors duration-200 shadow-lg"
            >
              {isLoading ? 'Thinking...' : 'Ask Question'}
            </button>
          </form>
        </motion.div>

        {/* Example Questions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-8 text-center text-white/80"
        >
          <p className="text-sm mb-2">Try asking:</p>
          <div className="space-y-1 text-xs">
            <p>"Where did the 2s finish in the 2017/18 season?"</p>
            <p>"What's the highest score I have had in a week?"</p>
            <p>"How many clean sheets have I had in a row?"</p>
          </div>
        </motion.div>
      </main>

      {/* Footer Navigation */}
      <footer className="bg-white/10 backdrop-blur-sm border-t border-white/20">
        <nav className="flex justify-around py-4">
          <button className="flex flex-col items-center space-y-1 text-white/80 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z" />
            </svg>
            <span className="text-xs">Home</span>
          </button>
          
          <button className="flex flex-col items-center space-y-1 text-white/80 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-xs">Stats</span>
          </button>
          
          <button className="flex flex-col items-center space-y-1 text-white/80 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3z" />
            </svg>
            <span className="text-xs">TOTW</span>
          </button>
          
          <button className="flex flex-col items-center space-y-1 text-white/80 hover:text-white transition-colors">
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <span className="text-xs">Club Info</span>
          </button>
        </nav>
      </footer>
    </div>
  )
}
