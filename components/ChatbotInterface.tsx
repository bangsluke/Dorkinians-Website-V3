"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ChatbotResponse } from "@/lib/services/chatbotService";
import { AnimatePresence } from "framer-motion";
import { useNavigationStore } from "@/lib/stores/navigation";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { homepageQuestions, questionTypes, QuestionType } from "@/config/config";
import NumberCard from "./chatbot-response/NumberCard";
import Calendar from "./chatbot-response/Calendar";
import Table from "./chatbot-response/Table";
import Record from "./chatbot-response/Record";

interface SavedConversation {
	question: string;
	response: ChatbotResponse;
	timestamp: number;
	playerContext?: string;
}

export default function ChatbotInterface() {
	const { selectedPlayer, setMainPage, setStatsSubPage } = useNavigationStore();
	const isDevelopment = process.env.NODE_ENV === "development";
	const [question, setQuestion] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [loadingMessage, setLoadingMessage] = useState("Thinking...");
	const [response, setResponse] = useState<ChatbotResponse | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [conversationHistory, setConversationHistory] = useState<SavedConversation[]>([]);
	const [showExampleQuestions, setShowExampleQuestions] = useState(false);
	const previousPlayerRef = useRef<string | null>(null);
	const [sessionId] = useState(() => {
		if (typeof window !== "undefined") {
			let id = sessionStorage.getItem("chatbotSessionId");
			if (!id) {
				id = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
				sessionStorage.setItem("chatbotSessionId", id);
			}
			return id;
		}
		return undefined;
	});

	// Load conversation history from localStorage on component mount or when player changes
	useEffect(() => {
		// console.log(`🤖 Frontend: ChatbotInterface mounted, selectedPlayer: ${selectedPlayer}`);
		if (typeof window !== "undefined") {
			const saved = localStorage.getItem("chatbotConversations");
			if (saved) {
				try {
					const parsed = JSON.parse(saved);
					// Filter conversations by current player's context
					const filteredConversations = parsed.filter(
						(conv: SavedConversation) => conv.playerContext === selectedPlayer
					);
					// Keep only the last 3 conversations for this player
					const lastThree = filteredConversations.slice(-3);
					setConversationHistory(lastThree);
					
					// Only restore conversation if player hasn't changed (initial load or same player)
					// If player changed, the second useEffect will handle clearing
					if (previousPlayerRef.current === null || previousPlayerRef.current === selectedPlayer) {
						// Restore the last question and answer if available for this player
						if (lastThree.length > 0) {
							const lastConversation = lastThree[lastThree.length - 1];
							setQuestion(lastConversation.question);
							setResponse(lastConversation.response);
							setShowExampleQuestions(false);
						} else {
							setShowExampleQuestions(true);
						}
					}
				} catch (err) {
					console.error("Failed to parse saved conversations:", err);
					setShowExampleQuestions(true);
				}
			} else {
				setShowExampleQuestions(true);
			}
		}
	}, [selectedPlayer]);

	// Clear answer when player changes
	useEffect(() => {
		// Only clear if player actually changed (not on initial mount)
		if (previousPlayerRef.current !== null && previousPlayerRef.current !== selectedPlayer) {
			// Clear response and question when player changes
			setResponse(null);
			setQuestion("");
		}
		// Update ref to current player
		previousPlayerRef.current = selectedPlayer;
	}, [selectedPlayer]);

	// Save conversation history to localStorage whenever it changes (keep only last 3)
	useEffect(() => {
		if (typeof window !== "undefined") {
			const lastThree = conversationHistory.slice(-3);
			localStorage.setItem("chatbotConversations", JSON.stringify(lastThree));
		}
	}, [conversationHistory]);

	// Progressive loading message based on elapsed time
	useEffect(() => {
		if (!isLoading) {
			setLoadingMessage("Thinking...");
			return;
		}

		const startTime = Date.now();
		setLoadingMessage("Thinking...");

		const interval = setInterval(() => {
			const elapsed = (Date.now() - startTime) / 1000;

			if (elapsed >= 40) {
				setLoadingMessage("I'm probably stuck and not going to answer.");
			} else if (elapsed >= 20) {
				setLoadingMessage("Real challenging question this...");
			} else if (elapsed >= 10) {
				setLoadingMessage("Tricky question this one...");
			} else if (elapsed >= 5) {
				setLoadingMessage("Thinking really hard...");
			}
		}, 100);

		return () => clearInterval(interval);
	}, [isLoading]);

	// Submit question to chatbot (extracted logic)
	const submitQuestion = async (questionToSubmit: string) => {
		if (!questionToSubmit.trim() || isLoading) return; // If the question is empty or the chatbot is loading, return

		// Client-side logging for debugging
		console.log(`🤖 Frontend: Sending question: ${questionToSubmit.trim()}. Player context: ${selectedPlayer || "None"}`);

		setIsLoading(true);
		setError(null);
		setResponse(null);

		// Try to send the question to the chatbot
		try {
			// Prepare conversation history for context
			const historyForContext = conversationHistory.slice(-3).map((conv) => ({
				question: conv.question,
				entities: conv.response.debug?.processingDetails?.questionAnalysis?.entities || [],
				metrics: conv.response.debug?.processingDetails?.questionAnalysis?.metrics || [],
				timestamp: new Date(conv.timestamp).toISOString(),
			}));

			// Send the question to the chatbot via the API endpoint with the player context sent as a parameter
			const res = await fetch("/api/chatbot", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					question: questionToSubmit.trim(),
					userContext: selectedPlayer || undefined,
					sessionId: sessionId,
					conversationHistory: historyForContext,
				}),
			});

			if (!res.ok) {
				throw new Error(`HTTP error! status: ${res.status}`); // If the response is not ok, throw an error
			}

			const data: ChatbotResponse & { debug?: any } = await res.json(); // Parse the response as a ChatbotResponse object
			// console.log(`🤖 Frontend: Received response:`, data);

			// Log full debug info to the client
			console.log(`🤖 [CLIENT] 🔍 DEBUG INFO:`, {
				"1. question": data.debug.question,
				"2. queryBreakdown": data.debug.processingDetails.queryBreakdown,
				"3. processingSteps": data.debug.processingDetails.processingSteps,
				"4. cypherQueries": data.debug.processingDetails.cypherQueries,
			});

			// Log Cypher queries prominently if available (development mode only)
			if (isDevelopment && data.debug?.processingDetails?.cypherQueries?.length > 0) {
				const queries = data.debug.processingDetails.cypherQueries;
				
				// Extract and log ready-to-execute queries first (highest priority)
				const readyToExecuteQueries = queries.filter((q: string) => 
					q.startsWith("READY_TO_EXECUTE:") || q.startsWith("TOTW_READY_TO_EXECUTE:")
				);
				
				if (readyToExecuteQueries.length > 0) {
					readyToExecuteQueries.forEach((query: string) => {
						const cleanQuery = query.replace(/^(READY_TO_EXECUTE|TOTW_READY_TO_EXECUTE):\s*/, "");
						console.log(`🤖 [CLIENT] 📋 CYPHER QUERY (ready to execute):`);
						console.log(cleanQuery);
					});
				}
				
				// Extract and log parameterized queries (with $variable placeholders)
				const parameterizedQueries = queries.filter((q: string) => 
					!q.startsWith("PARAMS:") && 
					!q.startsWith("READY_TO_EXECUTE:") && 
					!q.startsWith("TOTW_READY_TO_EXECUTE:") &&
					(q.includes("$") || q.match(/MATCH|RETURN|WHERE|WITH|OPTIONAL/i))
				);
				
				if (parameterizedQueries.length > 0) {
					parameterizedQueries.forEach((query: string) => {
						// Extract query text by removing common prefixes
						const cleanQuery = query.replace(/^(PLAYER_DATA|TOTW_DATA|STREAK_DATA|COMPARISON_DATA|TEMPORAL_DATA|TEAM_SPECIFIC_DATA|RANKING_DATA|GENERAL_PLAYERS):\s*/, "");
						console.log(`🤖 [CLIENT] 📋 CYPHER QUERY (parameterized):`);
						console.log(cleanQuery);
					});
				}
			}

			// Enhanced client-side logging for debugging
			// if (data.debug) {
			// 	console.log(`🤖 [CLIENT] 🔍 DEBUG INFO:`, {
			// 		question: data.debug.question,
			// 		userContext: data.debug.userContext,
			// 		timestamp: data.debug.timestamp,
			// 		serverLogs: data.debug.serverLogs,
			// 	});

			// 	// Log detailed processing information if available
			// 	if (data.debug.processingDetails) {
			// 		console.log(`🤖 [CLIENT] 🔍 QUESTION ANALYSIS:`, data.debug.processingDetails.questionAnalysis);

			// 		// Enhanced Cypher query logging
			// 		if (data.debug.processingDetails.cypherQueries && data.debug.processingDetails.cypherQueries.length > 0) {
			// 			console.log(`🤖 [CLIENT] 🔍 CYPHER QUERIES (${data.debug.processingDetails.cypherQueries.length} executed):`);
			// 			data.debug.processingDetails.cypherQueries.forEach((query: string, index: number) => {
			// 				console.log(`🤖 [CLIENT] 📝 Query ${index + 1}:`, query);
			// 			});
			// 		} else {
			// 			console.log(`🤖 [CLIENT] 🔍 CYPHER QUERIES: No queries executed`);
			// 		}

			// 		// console.log(`🤖 [CLIENT] 🔍 PROCESSING STEPS:`, data.debug.processingDetails.processingSteps);
			// 		console.log(`🤖 [CLIENT] 🔍 QUERY BREAKDOWN:`, data.debug.processingDetails.queryBreakdown);
			// 	}
			// }

			// Log the response structure for debugging
			const questionAnalysis = data.debug?.processingDetails?.questionAnalysis;
			const expectedOutputType = data.visualization?.type || 
				(questionAnalysis?.type && questionAnalysis.type in questionTypes 
					? questionTypes[questionAnalysis.type as QuestionType]?.visualizationType 
					: undefined);
			const statName = questionAnalysis?.metrics?.[0] || 
				(Array.isArray(data.visualization?.data) && data.visualization.data.length > 0 
					? (data.visualization.data[0] as any)?.metric 
					: undefined);

			console.log(`🤖 [CLIENT] 📊 Response structure:`, {
				answer: data.answer,
				hasVisualization: !!data.visualization,
				hasDebug: !!data.debug,
				hasProcessingDetails: !!data.debug?.processingDetails,
				responseType: typeof data,
				Expected_Output_Type: expectedOutputType,
				statName: statName,
			});

			setResponse(data);

			// Save to conversation history with player context
			const newConversation: SavedConversation = {
				question: questionToSubmit.trim(),
				response: data,
				timestamp: Date.now(),
				playerContext: selectedPlayer || undefined,
			};
			setConversationHistory((prev) => {
				const updated = [...prev, newConversation];
				// Keep only the last 3 conversations
				return updated.slice(-3);
			});
			setShowExampleQuestions(false);
			setQuestion(""); // Clear the question input
		} catch (err) {
			// If an error occurs, set the error state and log the error
			console.error(`🤖 Frontend: Error occurred:`, err);
			setError(err instanceof Error ? err.message : "An error occurred");
		} finally {
			setIsLoading(false); // Finally, set the loading state to false
		}
	};

	// Scroll to top helper function
	const scrollToTop = () => {
		// Find the main scrollable container - try multiple selectors for reliability
		const selectors = [
			'.main-content-container .frosted-container > div[class*="overflow-y-auto"]',
			'.main-content-container [class*="overflow-y-auto"]',
			'.frosted-container [class*="overflow-y-auto"]',
			'[class*="overflow-y-auto"]'
		];
		
		let scrollableContainer: Element | null = null;
		for (const selector of selectors) {
			scrollableContainer = document.querySelector(selector);
			if (scrollableContainer) break;
		}
		
		// Scroll the container if found
		if (scrollableContainer) {
			scrollableContainer.scrollTo({ top: 0, behavior: 'smooth' });
		}
		// Also scroll window and document element as fallbacks
		window.scrollTo({ top: 0, behavior: 'smooth' });
		document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
	};

	// Handle the chatbot question submission
	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault(); // Prevent the default form submission behavior
		await submitQuestion(question);
	};


	return (
		<div className='w-full max-w-2xl'>
			{/* Question Input */}
			<form onSubmit={handleSubmit} className='space-y-3 md:space-y-4'>
				<div className='flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2'>
					<input
						type='text'
						value={question}
						onChange={(e) => setQuestion(e.target.value)}
						placeholder='Ask me about player, club or team stats...'
						className='dark-chat-input w-full text-sm md:text-base text-white placeholder-white'
						disabled={isLoading}
					/>
					{/* Desktop button - hidden on mobile */}
					<button
						type='submit'
						disabled={!question.trim() || isLoading}
						className='CTA px-3 md:px-4 py-2 md:py-2 text-base w-full md:w-auto hidden md:block'>
						{isLoading ? (
							<svg className='animate-spin h-4 w-4 md:h-5 md:w-5' xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'>
								<circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4'></circle>
								<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 19l9 2-9-18-9 18 9-2zm0 0v-8' />
							</svg>
						) : (
							<MagnifyingGlassIcon className='h-5 w-5 text-black' />
						)}
					</button>
				</div>
				{/* Mobile button - shown below input on mobile screens */}
				<button type='submit' disabled={!question.trim() || isLoading} className='CTA px-4 py-2 text-sm w-full md:hidden'>
					{isLoading ? (
						<div className='flex items-center justify-center space-x-2'>
							<svg className='animate-spin h-4 w-4' xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'>
								<circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4'></circle>
								<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 19l9 2-9-18-9 18 9-2zm0 0v-8' />
							</svg>
							<span className='text-black font-medium'>Searching...</span>
						</div>
					) : (
						<div className='flex items-center justify-center space-x-2'>
							<MagnifyingGlassIcon className='h-5 w-5 text-black' />
							<span className='text-black font-medium'>Search</span>
						</div>
					)}
				</button>
			</form>

			{/* Response Display */}
			<div className='mt-3 md:mt-4'>
				<AnimatePresence mode='wait'>
				{isLoading && (
					<motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className='text-center py-8'>
						<div className='inline-flex items-center space-x-2'>
							<div className='animate-spin rounded-full h-6 w-6 border-b-2 border-yellow-400'></div>
							<span className='text-yellow-300'>{loadingMessage}</span>
						</div>
					</motion.div>
				)}

				{error && (
					<motion.div
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -10 }}
						className='bg-red-900/20 border border-red-400/30 rounded-lg p-4 mb-4'>
						<p className='text-red-300 text-sm'>❌ {error}</p>
					</motion.div>
				)}

				{response && (
					<motion.div
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -10 }}>
						{/* Answer */}
						<div className='mb-3 md:mb-4'>
							<h3 className='font-semibold text-white mb-2 text-base'>Answer:</h3>
							<p className='text-yellow-100 text-base'>{response.answer}</p>
						</div>

						{/* Navigation button for full stats question */}
						{response.answer.includes("Player Stats page") && (
							<div className='mb-3 md:mb-4 flex justify-center'>
								<button
									onClick={() => {
										setMainPage("stats");
										setStatsSubPage("player-stats");
									}}
									className='CTA px-4 py-2 text-sm md:text-base w-full md:w-auto'>
									<span className='text-black font-medium'>View Player Stats</span>
								</button>
							</div>
						)}

						{/* Visualization */}
						{response.visualization && (
							response.visualization.type === "NumberCard" ? (
								<NumberCard 
									visualization={response.visualization} 
									metricKey={response.debug?.processingDetails?.questionAnalysis?.metrics?.[0]}
								/>
							) :
							response.visualization.type === "Calendar" ? <Calendar visualization={response.visualization} /> :
							response.visualization.type === "Table" ? <Table visualization={response.visualization} /> :
							response.visualization.type === "Record" ? <Record visualization={response.visualization} /> :
							null
						)}
					</motion.div>
				)}
			</AnimatePresence>
			</div>

			{/* Questions Section - Show example questions when no past questions, or past questions when available */}
			<div className='mt-6 md:mt-8 pt-6 border-t border-white/20'>
				{/* Show example questions when no past conversations exist */}
				{conversationHistory.length === 0 && (
					<div>
						<h3 className='font-semibold text-white pb-4 pb-4mb-3 md:mb-4 text-base'>Try these questions:</h3>
						<div className='space-y-2 md:space-y-3 pb-4'>
							{homepageQuestions.map((q, index) => (
								<motion.div
									key={q.id}
									initial={{ opacity: 0, x: -20 }}
									animate={{ opacity: 1, x: 0 }}
									transition={{ delay: index * 0.1 }}
									className={`rounded-lg p-3 md:p-4 cursor-pointer hover:bg-yellow-400/5 transition-colors bg-gradient-to-b from-white/[0.22] to-white/[0.05]`}
									onClick={() => {
										scrollToTop();
										submitQuestion(q.question);
									}}>
									<div className='mb-2'>
										<p className='font-medium text-white text-xs md:text-sm'>{q.question}</p>
									</div>
									<p className='text-xs md:text-sm text-yellow-100'>{q.description}</p>
								</motion.div>
							))}
						</div>
					</div>
				)}

				{/* Show past conversations when they exist */}
				{conversationHistory.length > 0 && (
					<div>
						<div className='flex flex-col md:flex-row md:items-center md:justify-between mb-3 md:mb-4'>
							<h3 className='font-semibold text-white text-base whitespace-nowrap mb-2 md:mb-0'>Previous Conversations</h3>
							<button
								onClick={() => setShowExampleQuestions(!showExampleQuestions)}
								className='text-xs text-yellow-300 hover:text-yellow-200 transition-colors underline'>
								{showExampleQuestions ? "Hide" : "Show"} example questions
							</button>
						</div>

						{/* Show past conversations or example questions based on toggle */}
						{!showExampleQuestions ? (
							<div 
								className='space-y-2 md:space-y-3 overflow-y-auto max-h-48 md:max-h-60 pr-2 flex flex-col items-center'
								style={{ WebkitOverflowScrolling: 'touch' }}>
								{conversationHistory
									.slice(-3)
									.reverse()
									.map((conv, index) => (
										<motion.div
											key={conv.timestamp}
											initial={{ opacity: 0, x: -20 }}
											animate={{ opacity: 1, x: 0 }}
											transition={{ delay: index * 0.1 }}
											className='rounded-lg p-3 md:p-4 cursor-pointer hover:bg-yellow-400/5 transition-colors w-full'
											onClick={() => {
												setQuestion(conv.question);
												// Focus the input after setting the question
												setTimeout(() => {
													const input = document.querySelector('input[type="text"]') as HTMLInputElement;
													if (input) {
														input.focus();
														input.setSelectionRange(0, input.value.length);
													}
												}, 0);
											}}>
											<div className='flex items-start justify-between mb-2'>
												<p className='font-medium text-white text-xs md:text-sm'>Q: {conv.question}</p>
												<span className='text-xs text-yellow-300'>{new Date(conv.timestamp).toLocaleTimeString()}</span>
											</div>
											<p className='text-xs md:text-sm text-yellow-100'>{conv.response.answer}</p>
										</motion.div>
									))}
							</div>
						) : (
 							<div className='space-y-2 md:space-y-3 pb-4'>
								{homepageQuestions.map((q, index) => (
									<motion.div
										key={q.id}
										initial={{ opacity: 0, x: -20 }}
										animate={{ opacity: 1, x: 0 }}
										transition={{ delay: index * 0.1 }}
										className={`rounded-lg p-3 md:p-4 cursor-pointer hover:bg-yellow-400/5 transition-colors bg-gradient-to-b from-white/[0.22] to-white/[0.05]`}
										onClick={() => {
											scrollToTop();
											submitQuestion(q.question);
										}}>
										<div className='mb-2'>
											<p className='font-medium text-white text-xs md:text-sm'>{q.question}</p>
										</div>
										<p className='text-xs md:text-sm text-yellow-100'>{q.description}</p>
									</motion.div>
								))}
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
