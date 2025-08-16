'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Listbox } from '@headlessui/react'
import { ChevronUpDownIcon, CheckIcon, PencilIcon } from '@heroicons/react/20/solid'
import { useNavigationStore } from '@/lib/stores/navigation'

// Sample player data - replace with real data when available
const samplePlayers = [
  'Luke Bangs',
  'Kieran Mackrell', 
  'Oli Goddard',
  'Al Thom'
]

interface PlayerSelectionProps {
  onPlayerSelect: (playerName: string) => void
  onEditClick: () => void
  selectedPlayer: string | null
  isEditMode: boolean
}

export default function PlayerSelection({ onPlayerSelect, onEditClick, selectedPlayer, isEditMode }: PlayerSelectionProps) {
  const [localSelectedPlayer, setLocalSelectedPlayer] = useState('')
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [query, setQuery] = useState('')

  // Reset local state when entering edit mode
  useEffect(() => {
    if (isEditMode) {
      setLocalSelectedPlayer('')
      setIsSubmitted(false)
      setQuery('')
    }
  }, [isEditMode])

  // Set local state when player is selected
  useEffect(() => {
    if (selectedPlayer && !isEditMode) {
      setLocalSelectedPlayer(selectedPlayer)
      setIsSubmitted(true)
    }
  }, [selectedPlayer, isEditMode])

  const handlePlayerSelect = (playerName: string) => {
    setLocalSelectedPlayer(playerName)
    setIsSubmitted(true)
    onPlayerSelect(playerName)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && localSelectedPlayer.trim()) {
      handlePlayerSelect(localSelectedPlayer.trim())
    }
  }

  // Filter players based on query
  const filteredPlayers = query === ''
    ? samplePlayers
    : samplePlayers.filter((player) =>
        player.toLowerCase().includes(query.toLowerCase())
      )

  // If we're in edit mode, show the selection form
  if (isEditMode) {
    return (
      <motion.div
        key="player-selection-edit"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md mx-auto"
      >
        <div className="space-y-4">
          <div>
            <Listbox value={localSelectedPlayer} onChange={handlePlayerSelect}>
              <div className="relative">
                <Listbox.Button className="relative w-full cursor-default rounded-lg bg-white py-2 pl-3 pr-10 text-left shadow-md focus:outline-none focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-orange-300 sm:text-sm">
                  <span className={`block truncate ${localSelectedPlayer ? 'text-gray-900' : 'text-gray-500'}`}>
                    {localSelectedPlayer || 'Choose a player...'}
                  </span>
                  <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                    <ChevronUpDownIcon
                      className="h-5 w-5 text-gray-400"
                      aria-hidden="true"
                    />
                  </span>
                </Listbox.Button>
                <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                  <div className="px-3 py-2">
                    <input
                      type="text"
                      placeholder="Type to filter players..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  {filteredPlayers.map((player, playerIdx) => (
                    <Listbox.Option
                      key={playerIdx}
                      className={({ active }) =>
                        `relative cursor-default select-none py-2 pl-10 pr-4 ${
                          active ? 'bg-amber-100 text-amber-900' : 'text-gray-900'
                        }`
                      }
                      value={player}
                    >
                      {({ selected }) => (
                        <>
                          <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                            {player}
                          </span>
                          {selected ? (
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-amber-600">
                              <CheckIcon className="h-5 w-5" aria-hidden="true" />
                            </span>
                          ) : null}
                        </>
                      )}
                    </Listbox.Option>
                  ))}
                </Listbox.Options>
              </div>
            </Listbox>
          </div>
        </div>
      </motion.div>
    )
  }

  // If we have a selected player, show the player name with edit button
  if (selectedPlayer && isSubmitted) {
    return (
      <motion.div
        key="player-name-display"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center"
      >
        <div className="flex items-center justify-center space-x-3">
          <h2 className="text-xl font-semibold text-gray-900">
            {selectedPlayer}
          </h2>
          <button
            onClick={onEditClick}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
            title="Edit player selection"
          >
            <PencilIcon className="h-5 w-5" />
          </button>
        </div>
      </motion.div>
    )
  }

  // Initial player selection form
  return (
    <motion.div
      key="player-selection-initial"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.5 }}
      className="w-full max-w-md mx-auto"
    >
      <div className="space-y-4">
        <div>
          <Listbox value={localSelectedPlayer} onChange={handlePlayerSelect}>
            <div className="relative">
              <Listbox.Button className="relative w-full cursor-default rounded-lg bg-white py-2 pl-3 pr-10 text-left shadow-md focus:outline-none focus-visible:border-indigo-500 focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75 focus-visible:ring-offset-2 focus-visible:ring-offset-orange-300 sm:text-sm">
                <span className={`block truncate ${localSelectedPlayer ? 'text-gray-900' : 'text-gray-500'}`}>
                  {localSelectedPlayer || 'Choose a player...'}
                </span>
                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                  <ChevronUpDownIcon
                    className="h-5 w-5 text-gray-400"
                    aria-hidden="true"
                  />
                </span>
              </Listbox.Button>
              <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                <div className="px-3 py-2">
                  <input
                    type="text"
                    placeholder="Type to filter players..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                {filteredPlayers.map((player, playerIdx) => (
                  <Listbox.Option
                    key={playerIdx}
                    className={({ active }) =>
                      `relative cursor-default select-none py-2 pl-10 pr-4 ${
                        active ? 'bg-amber-100 text-amber-900' : 'text-gray-900'
                      }`
                    }
                    value={player}
                  >
                    {({ selected }) => (
                      <>
                        <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                          {player}
                        </span>
                        {selected ? (
                          <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-amber-600">
                            <CheckIcon className="h-5 w-5" aria-hidden="true" />
                          </span>
                        ) : null}
                      </>
                    )}
                  </Listbox.Option>
                ))}
              </Listbox.Options>
            </div>
          </Listbox>
        </div>
      </div>
    </motion.div>
  )
}
