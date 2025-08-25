"use client";

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigationStore } from '@/lib/stores/navigation'
import Header from '@/components/Header'
import FooterNavigation from '@/components/FooterNavigation'
import StatsContainer from '@/components/StatsContainer'
import TOTW from '@/components/pages/TOTW'
import ClubInfo from '@/components/pages/ClubInfo'
import ChatbotInterface from '@/components/ChatbotInterface'
import PlayerSelection from '@/components/PlayerSelection'

export default function HomePage() {
  const { currentMainPage, selectedPlayer, isPlayerSelected, isEditMode, selectPlayer, enterEditMode } = useNavigationStore()
  const [showChatbot, setShowChatbot] = useState(false)

  const handlePlayerSelect = (playerName: string) => {
    selectPlayer(playerName)
    // Trigger chatbot reveal after a brief delay
    setTimeout(() => setShowChatbot(true), 500)
  }

  const handleEditClick = () => {
    enterEditMode()
    setShowChatbot(false)
  }

  const renderCurrentPage = () => {
    switch (currentMainPage) {
      case 'home':
        return (
          <motion.div
            key="home"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex flex-col h-full px-6"
          >
            {/* Top Section: Welcome Header and Player Selection */}
            <div className="pt-8 pb-6">
              {/* Welcome Header and Subtitle */}
              <AnimatePresence mode="wait">
                {!isPlayerSelected && (
                  <motion.div
                    key="welcome"
                    initial={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -50 }}
                    transition={{ duration: 0.5 }}
                    className="text-center mb-8"
                  >
                    <h1 className="text-xl font-bold text-gray-900 mb-6">
                      Welcome to Dorkinians FC
                    </h1>
                    <p className="text-m text-gray-600 max-w-md mx-auto">
                      Your comprehensive source for club statistics, player performance, and team insights.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Player Selection or Player Name Display */}
              <AnimatePresence mode="wait">
                {!isPlayerSelected ? (
                  <motion.div
                    key="player-selection"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.5 }}
                    className="w-full"
                  >
                    <PlayerSelection 
                      onPlayerSelect={handlePlayerSelect}
                      onEditClick={handleEditClick}
                      selectedPlayer={selectedPlayer}
                      isEditMode={isEditMode}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="player-name"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="text-center"
                  >
                    <PlayerSelection 
                      onPlayerSelect={handlePlayerSelect}
                      onEditClick={handleEditClick}
                      selectedPlayer={selectedPlayer}
                      isEditMode={isEditMode}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Chatbot Interface - Positioned below with fade-in animation */}
            <AnimatePresence mode="wait">
              {showChatbot && (
                <motion.div
                  key="chatbot"
                  initial={{ opacity: 0, y: 50 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.2 }}
                  className="flex-1 flex items-center justify-center"
                >
                  <div className="w-full max-w-2xl mx-auto">
                    <ChatbotInterface />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
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
