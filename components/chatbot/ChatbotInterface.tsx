"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChatbotResponse } from "@/lib/services/chatbotService";
import { useNavigationStore } from "@/lib/stores/navigation";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { homepageQuestions, questionTypes, QuestionType } from "@/config/config";
import NumberCard from "./NumberCard";
import Calendar from "./Calendar";
import Table from "./Table";
import dynamic from "next/dynamic";
import ExampleQuestionsModal from "../modals/ExampleQuestionsModal";

// Dynamically import Chart component to reduce initial bundle size
const Chart = dynamic(() => import("./Chart"), {
	loading: () => <div className="text-white/60 text-sm">Loading chart...</div>,
	ssr: false,
});
import { log } from "@/lib/utils/logger";
import { LRUCache } from "@/lib/utils/lruCache";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { LoadingState, ErrorState } from "@/components/ui/StateComponents";
import { useToast } from "@/lib/hooks/useToast";
import ProgressIndicator from "@/components/ui/ProgressIndicator";

interface SavedConversation {
	question: string;
	response: ChatbotResponse;
	timestamp: number;
	playerContext?: string;
}

// LRU cache for chatbot responses (max 50 entries, 10 minute TTL)
interface CachedResponse {
	response: ChatbotResponse;
	timestamp: number;
}

const chatbotCache = new LRUCache<string, CachedResponse>(50);
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export default function ChatbotInterface() {
	const { selectedPlayer, setMainPage, setStatsSubPage } = useNavigationStore();
	const { showError } = useToast();
	const isDevelopment = process.env.NODE_ENV === "development";
	const [question, setQuestion] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [loadingMessage, setLoadingMessage] = useState("Thinking...");
	const [response, setResponse] = useState<ChatbotResponse | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [conversationHistory, setConversationHistory] = useState<SavedConversation[]>([]);
	const [showExampleQuestions, setShowExampleQuestions] = useState(false);
	const [showExampleQuestionsModal, setShowExampleQuestionsModal] = useState(false);
	const [showProgressIndicator, setShowProgressIndicator] = useState(false);
	const [loadingStartTime, setLoadingStartTime] = useState<number | null>(null);
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
					log("error", "Failed to parse saved conversations:", err);
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

	// Progressive loading message based on elapsed time and show progress indicator after 3 seconds
	useEffect(() => {
		if (!isLoading) {
			setLoadingMessage("Thinking...");
			setShowProgressIndicator(false);
			setLoadingStartTime(null);
			return;
		}

		const startTime = Date.now();
		setLoadingStartTime(startTime);
		setLoadingMessage("Thinking...");
		setShowProgressIndicator(false);

		const interval = setInterval(() => {
			const elapsed = (Date.now() - startTime) / 1000;

			// Show progress indicator after 3 seconds
			if (elapsed >= 3 && !showProgressIndicator) {
				setShowProgressIndicator(true);
			}

			if (elapsed >= 40) {
				setLoadingMessage("This is taking longer than expected. Please wait or try rephrasing your question.");
			} else if (elapsed >= 20) {
				setLoadingMessage("Processing your question... This may take a few more seconds.");
			} else if (elapsed >= 10) {
				setLoadingMessage("Processing your question... This may take a few seconds.");
			} else if (elapsed >= 5) {
				setLoadingMessage("Processing your question... This may take a few seconds.");
			}
		}, 100);

		return () => clearInterval(interval);
	}, [isLoading, showProgressIndicator]);

	// Submit question to chatbot (extracted logic)
	const submitQuestion = async (questionToSubmit: string) => {
		if (!questionToSubmit.trim() || isLoading) return; // If the question is empty or the chatbot is loading, return

		// Client-side logging for debugging
		log("info", `🤖 Frontend: Sending question: ${questionToSubmit.trim()}. Player context: ${selectedPlayer || "None"}`);

		// Check cache first
		const cacheKey = `${questionToSubmit.trim().toLowerCase()}_${selectedPlayer || "none"}`;
		const cached = chatbotCache.get(cacheKey);
		
		if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
			log("info", "🤖 [Cache Hit] Using cached response");
			setResponse(cached.response);
			setIsLoading(false);
			setError(null);
			
			// Add to conversation history
			const newConversation: SavedConversation = {
				question: questionToSubmit.trim(),
				response: cached.response,
				timestamp: Date.now(),
				playerContext: selectedPlayer || undefined,
			};
			setConversationHistory((prev) => [...prev, newConversation]);
			return;
		}

		setIsLoading(true);
		setError(null);
		setResponse(null);

		// Try to send the question to the chatbot
		try {
			// Prepare conversation history for context
			const historyForContext = conversationHistory
				.slice(-3)
				.filter((conv) => conv && conv.response && conv.question) // Filter out invalid entries
				.map((conv) => {
					const entities = conv.response?.debug?.processingDetails?.questionAnalysis?.entities;
					const metrics = conv.response?.debug?.processingDetails?.questionAnalysis?.metrics;
					return {
						question: conv.question || "",
						entities: Array.isArray(entities) ? entities : [],
						metrics: Array.isArray(metrics) ? metrics : [],
						timestamp: new Date(conv.timestamp || Date.now()).toISOString(),
					};
				});

			// Send the question to the chatbot via the API endpoint with the player context sent as a parameter
			const requestBody = {
				question: questionToSubmit.trim(),
				userContext: selectedPlayer || undefined,
				sessionId: sessionId,
				conversationHistory: historyForContext,
			};
			const res = await fetch("/api/chatbot", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(requestBody),
			});

			if (!res.ok) {
				throw new Error(`HTTP error! status: ${res.status}`); // If the response is not ok, throw an error
			}

			const data: ChatbotResponse & { debug?: any } = await res.json(); // Parse the response as a ChatbotResponse object

			// Log full debug info to the client
			log("info", `🤖 [CLIENT] 🔍 DEBUG INFO:`, {
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
						log("info", `🤖 [CLIENT] 📋 CYPHER QUERY (ready to execute):`);
						log("info", cleanQuery);
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
						log("info", `🤖 [CLIENT] 📋 CYPHER QUERY (parameterized):`);
						log("info", cleanQuery);
					});
				}
			}

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

			log("info", `🤖 [CLIENT] 📊 Response structure:`, {
				answer: data.answer,
				answerValue: data.answerValue,
				hasVisualization: !!data.visualization,
				hasDebug: !!data.debug,
				hasProcessingDetails: !!data.debug?.processingDetails,
				responseType: typeof data,
				Expected_Output_Type: expectedOutputType,
				statName: statName,
			});

			setResponse(data);

			// Cache the response
			chatbotCache.set(cacheKey, {
				response: data,
				timestamp: Date.now(),
			});
			log("info", "🤖 [Cache] Response cached");

			// Save to conversation history with player context
			// Use the merged question from the response if available (for clarification merges), otherwise use the original input
			const questionToStore = data.debug?.question || questionToSubmit.trim();
			const newConversation: SavedConversation = {
				question: questionToStore,
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
			const errorMessage = err instanceof Error ? err.message : String(err);
			log("error", `🤖 Frontend: Error occurred:`, errorMessage);
			setError(errorMessage);
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
		
		// iOS detection
		const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
			(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
		
		// Scroll the container if found
		if (scrollableContainer) {
			if (isIOS) {
				// Manual smooth scroll for iOS
				const start = scrollableContainer.scrollTop;
				const distance = -start;
				const duration = 300;
				let startTime: number | null = null;
				
				const animateScroll = (currentTime: number) => {
					if (startTime === null) startTime = currentTime;
					const timeElapsed = currentTime - startTime;
					const progress = Math.min(timeElapsed / duration, 1);
					const ease = progress < 0.5 
						? 2 * progress * progress 
						: 1 - Math.pow(-2 * progress + 2, 2) / 2;
					
					scrollableContainer!.scrollTop = start + distance * ease;
					
					if (timeElapsed < duration) {
						requestAnimationFrame(animateScroll);
					}
				};
				requestAnimationFrame(animateScroll);
			} else {
				scrollableContainer.scrollTo({ top: 0, behavior: 'smooth' });
			}
		}
		
		// Also handle window/document scroll as fallback
		if (isIOS) {
			// Manual scroll for window
			const start = window.pageYOffset || document.documentElement.scrollTop;
			const distance = -start;
			const duration = 300;
			let startTime: number | null = null;
			
			const animateScroll = (currentTime: number) => {
				if (startTime === null) startTime = currentTime;
				const timeElapsed = currentTime - startTime;
				const progress = Math.min(timeElapsed / duration, 1);
				const ease = progress < 0.5 
					? 2 * progress * progress 
					: 1 - Math.pow(-2 * progress + 2, 2) / 2;
				
				window.scrollTo(0, start + distance * ease);
				
				if (timeElapsed < duration) {
					requestAnimationFrame(animateScroll);
				}
			};
			requestAnimationFrame(animateScroll);
		} else {
			window.scrollTo({ top: 0, behavior: 'smooth' });
			document.documentElement.scrollTo({ top: 0, behavior: 'smooth' });
		}
	};

	// Handle the chatbot question submission
	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault(); // Prevent the default form submission behavior
		
		// Prevent empty submissions
		if (!question.trim() || isLoading) {
			return;
		}
		
		await submitQuestion(question);
	};


	return (
		<div className='w-full max-w-2xl'>
			{/* Question Input */}
			<form onSubmit={handleSubmit} className='space-y-3 md:space-y-4'>
				<div className='space-y-2'>
					<label htmlFor="chatbot-input" className='block text-sm font-medium text-dorkinians-yellow'>
						Ask a Question
					</label>
					<div className='flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2'>
						<Input
							id="chatbot-input"
							data-testid="chatbot-input"
							type='text'
							value={question}
							onChange={(e) => setQuestion(e.target.value)}
							placeholder='Ask me about player, club or team stats...'
							className='w-full border-2 border-dorkinians-yellow focus:border-dorkinians-yellow-dark'
							size="md"
							disabled={isLoading}
							required
							onKeyDown={(e) => {
								// Prevent Enter key submission when input is empty
								if (e.key === 'Enter' && !question.trim()) {
									e.preventDefault();
								}
							}}
						/>
						<Button
							data-testid="chatbot-submit"
							type='submit'
							variant="secondary"
							size="md"
							disabled={!question.trim() || isLoading}
							iconLeft={!isLoading ? <MagnifyingGlassIcon className='h-5 w-5' /> : undefined}
							className='w-full md:w-auto'>
							{isLoading ? "Searching..." : "Search"}
						</Button>
					</div>
				</div>
			</form>

			{/* Response Display */}
			<div className='mt-3 md:mt-4'>
				<AnimatePresence mode='wait'>
				{isLoading && (
					<div className='space-y-3'>
						<LoadingState message={loadingMessage} variant="spinner" />
						<ProgressIndicator 
							isVisible={showProgressIndicator}
							message={showProgressIndicator ? undefined : undefined}
							size="md"
							className="mt-2"
						/>
					</div>
				)}

				{error && (
					<ErrorState 
						message="Failed to get response" 
						error={error}
						onShowToast={showError}
						showToast={true}
						suggestions={response?.suggestions}
						onSuggestionClick={(suggestion) => {
							setError(null);
							setQuestion(suggestion);
							submitQuestion(suggestion);
						}}
					/>
				)}

				{response && (
					<motion.div
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
						exit={{ opacity: 0, y: -10 }}>
						{/* Question */}
						<div className='mb-3 md:mb-4'>
							<h3 className='font-semibold text-white mb-2 text-base'>Question:</h3>
							<p className='text-white text-base'>{response.debug?.question}</p>
						</div>

						{/* Answer */}
						<div className='mb-3 md:mb-4' data-testid="chatbot-answer">
							<h3 className='font-semibold text-white mb-2 text-base'>Answer:</h3>
							<p className='text-yellow-100 text-base'>{response.answer}</p>
						</div>

						{/* Navigation button for full stats question */}
						{response.answer.includes("Player Stats page") && (
							<div className='mb-3 md:mb-4 flex justify-center'>
								<Button
									variant="secondary"
									size="md"
									onClick={() => {
										setMainPage("stats");
										setStatsSubPage("player-stats");
									}}
									className='w-full md:w-auto'>
									View Player Stats
								</Button>
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
							response.visualization.type === "Chart" ? <Chart visualization={response.visualization} /> :
							null
						)}

						{/* Suggestions when response indicates failure - appears after visualization */}
						{response.suggestions && response.suggestions.length > 0 && (() => {
							// Check if the answer indicates failure
							const answer = response.answer || "";
							const answerLower = answer.toLowerCase();
							const noDataPatterns = [
								"i couldn't find relevant information",
								"no data found",
								"couldn't find any",
								"no information",
								"no data",
								"doesn't exist",
								"couldn't find any matches",
								"player not found",
								"team not found",
								"database error",
								"database connection error"
							];
							const isFailedAnswer = noDataPatterns.some(pattern => answerLower.includes(pattern));
							
							// Only show suggestions if the answer indicates failure
							if (!isFailedAnswer) {
								return null;
							}
							
							// Filter out the current question from suggestions (case-insensitive)
							const currentQuestion = response.debug?.question || "";
							const filteredSuggestions = response.suggestions.filter(
								suggestion => suggestion.toLowerCase().trim() !== currentQuestion.toLowerCase().trim()
							);
							
							return filteredSuggestions.length > 0 && (
								<div className='mb-3 md:mb-4 mt-3 md:mt-4'>
									<p className='text-white/80 text-sm mb-3'>Try asking one of these instead:</p>
									<div className='space-y-2'>
										{filteredSuggestions.map((suggestion, index) => (
											<button
												key={index}
												onClick={() => {
													setResponse(null);
													setQuestion(suggestion);
													submitQuestion(suggestion);
												}}
												className='w-full text-left px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dorkinians-yellow focus-visible:ring-offset-2 focus-visible:ring-offset-transparent'>
												{suggestion}
											</button>
										))}
									</div>
								</div>
							);
						})()}
					</motion.div>
				)}
			</AnimatePresence>
			</div>

			{/* Questions Section - Show example questions when no past questions, or past questions when available */}
			<div className='mt-4 md:mt-8 pt-4 md:pt-6 border-t border-white/20'>
				{/* Show example questions when no past conversations exist */}
				{conversationHistory.length === 0 && (
					<div>
						<h3 className='font-semibold text-white pb-4 pb-4mb-3 md:mb-4 text-base'>Try these questions:</h3>
						<div className='space-y-2 md:space-y-3 pb-4'>
							{homepageQuestions.map((q, index) => (
								<motion.div
									key={q.id}
									data-testid={`chatbot-example-question-${index}`}
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
						<div className='flex justify-center mt-2 mb-4'>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setShowExampleQuestionsModal(true)}
								data-testid="chatbot-show-more-example-questions"
								className="underline text-yellow-300 hover:text-yellow-200">
								Show more example questions
							</Button>
						</div>
					</div>
				)}

				{/* Show past conversations when they exist */}
				{conversationHistory.length > 0 && (
					<div>
						<div className='flex flex-col md:flex-row md:items-center md:justify-between mb-3 md:mb-4'>
							<h3 className='font-semibold text-white text-base whitespace-nowrap mb-2 md:mb-0'>Previous Conversations</h3>
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setShowExampleQuestions(!showExampleQuestions)}
								className="underline text-yellow-300 hover:text-yellow-200">
								{showExampleQuestions ? "Hide" : "Show"} example questions
							</Button>
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
										data-testid={`chatbot-example-question-${index}`}
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
						{showExampleQuestions && (
							<div className='flex justify-center mt-2 mb-4'>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setShowExampleQuestionsModal(true)}
									className="underline text-yellow-300 hover:text-yellow-200">
									Show more example questions
								</Button>
							</div>
						)}
					</div>
				)}
			</div>

			{/* Example Questions Modal */}
			<ExampleQuestionsModal
				isOpen={showExampleQuestionsModal}
				onClose={() => setShowExampleQuestionsModal(false)}
				onSelectQuestion={(question) => {
					scrollToTop();
					setQuestion(question);
					setShowExampleQuestionsModal(false);
					// Focus the input after setting the question
					setTimeout(() => {
						const input = document.querySelector('input[type="text"]') as HTMLInputElement;
						if (input) {
							input.focus();
							input.setSelectionRange(0, input.value.length);
						}
					}, 0);
				}}
			/>
		</div>
	);
}
