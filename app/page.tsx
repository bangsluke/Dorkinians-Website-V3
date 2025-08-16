'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useNavigationStore } from '@/lib/stores/navigation'
import Header from '@/components/Header'
import FooterNavigation from '@/components/FooterNavigation'
import StatsContainer from '@/components/StatsContainer'
import TOTW from '@/components/pages/TOTW'
import ClubInfo from '@/components/pages/ClubInfo'

export default function HomePage() {
  const { currentMainPage } = useNavigationStore()

  const renderCurrentPage = () => {
    switch (currentMainPage) {
      case 'home':
        return (
          <motion.div
            key="home"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col items-center justify-center h-full text-center px-6"
          >
            <h1 className="text-4xl font-bold text-gray-900 mb-6">
              Welcome to Dorkinians FC
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-md">
              Your comprehensive source for club statistics, player performance, and team insights.
            </p>
            
            {/* Chatbot Input Bar */}
            <div className="w-full max-w-md">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Ask me about player stats, team performance, or club information..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-dorkinians-blue focus:border-transparent"
                />
                <button className="absolute right-3 top-1/2 transform -translate-y-1/2 bg-dorkinians-blue text-white p-2 rounded-full hover:bg-blue-600 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Try: "Who scored the most goals this season?"
              </p>
            </div>
          </motion.div>
        )
      
      case 'stats':
        return <StatsContainer />
      
      case 'totw':
        return <TOTW />
      
      case 'club-info':
        return <ClubInfo />
      
      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <Header onSettingsClick={() => console.log('Settings clicked')} />
      
      {/* Main Content */}
      <main className="pt-20 pb-24 px-4 h-screen">
        <AnimatePresence mode="wait">
          {renderCurrentPage()}
        </AnimatePresence>
      </main>
      
      {/* Footer Navigation */}
      <FooterNavigation />
    </div>
  )
}
