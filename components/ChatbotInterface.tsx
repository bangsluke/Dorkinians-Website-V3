"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ChatbotResponse } from "@/lib/services/chatbotService";
import { AnimatePresence } from "framer-motion";
import { useNavigationStore } from "@/lib/stores/navigation";
import { MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import { homepageQuestions } from "@/config/config";

interface SavedConversation {
	question: string;
	response: ChatbotResponse;
	timestamp: number;
	playerContext?: string;
}

export default function ChatbotInterface() {
	const { selectedPlayer } = useNavigationStore();
	const [question, setQuestion] = useState("");
	const [isLoading, setIsLoading] = useState(false);
	const [response, setResponse] = useState<ChatbotResponse | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [conversationHistory, setConversationHistory] = useState<SavedConversation[]>([]);
	const [showExampleQuestions, setShowExampleQuestions] = useState(false);

	// Load conversation history from localStorage on component mount
	useEffect(() => {
		// console.log(`🤖 Frontend: ChatbotInterface mounted, selectedPlayer: ${selectedPlayer}`);
		if (typeof window !== "undefined") {
			const saved = localStorage.getItem("chatbotConversations");
			if (saved) {
				try {
					const parsed = JSON.parse(saved);
					// Keep only the last 3 conversations
					const lastThree = parsed.slice(-3);
					setConversationHistory(lastThree);
					setShowExampleQuestions(false);
				} catch (err) {
					console.error("Failed to parse saved conversations:", err);
					setShowExampleQuestions(true);
				}
			} else {
				setShowExampleQuestions(true);
			}
		}
	}, [selectedPlayer]);

	// Save conversation history to localStorage whenever it changes (keep only last 3)
	useEffect(() => {
		if (typeof window !== "undefined") {
			const lastThree = conversationHistory.slice(-3);
			localStorage.setItem("chatbotConversations", JSON.stringify(lastThree));
		}
	}, [conversationHistory]);

	// Handle the chatbot question submission
	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault(); // Prevent the default form submission behavior
		if (!question.trim() || isLoading) return; // If the question is empty or the chatbot is loading, return

		// Client-side logging for debugging
		console.log(`🤖 Frontend: Sending question: ${question.trim()}. Player context: ${selectedPlayer || "None"}`);

		setIsLoading(true);
		setError(null);
		setResponse(null);

		// Try to send the question to the chatbot
		try {
			// Send the question to the chatbot via the API endpoint with the player context sent as a parameter
			const res = await fetch("/api/chatbot", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ 
					question: question.trim(),
					userContext: selectedPlayer || undefined
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
			});

			// Log Cypher queries prominently if available
			if (data.debug?.processingDetails?.cypherQueries?.length > 0) {
				// console.log(`🤖 [CLIENT] 🎯 CYPHER QUERIES EXECUTED:`, data.debug.processingDetails.cypherQueries);
				
				// Find and log copyable queries
				const readyToExecuteQuery = data.debug.processingDetails.cypherQueries.find((q: string) => q.startsWith('READY_TO_EXECUTE:'));
				// const parameterizedQuery = data.debug.processingDetails.cypherQueries.find((q: string) => q.startsWith('PLAYER_DATA:'));

				// Log parameterized query
				// if (parameterizedQuery) {
				// 	const cleanQuery = parameterizedQuery.replace('PLAYER_DATA: ', '');
				// 	console.log(`🤖 [CLIENT] 📋 PARAMETERIZED CYPHER QUERY (with variables):`);
				// 	console.log(cleanQuery);
				// }
				
				// Log ready to execute query to the client so that they can paste it into Neo4j Aura for debugging
				if (readyToExecuteQuery) {
					const cleanQuery = readyToExecuteQuery.replace('READY_TO_EXECUTE: ', '');
					console.log(`🤖 [CLIENT] 📋 COPYABLE CYPHER QUERY (ready to paste into Neo4j Aura):`);
					console.log(cleanQuery);
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
			console.log(`🤖 [CLIENT] 📊 Response structure:`, {
				answer: data.answer,
				hasVisualization: !!data.visualization,
				hasDebug: !!data.debug,
				hasProcessingDetails: !!data.debug?.processingDetails,
				responseType: typeof data,
			});

			setResponse(data);

			// Save to conversation history with player context
			const newConversation: SavedConversation = {
				question: question.trim(),
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
		} catch (err) {
			// If an error occurs, set the error state and log the error
			console.error(`🤖 Frontend: Error occurred:`, err);
			setError(err instanceof Error ? err.message : "An error occurred");
		} finally {
			setIsLoading(false); // Finally, set the loading state to false
		}
	};

	const renderVisualization = (visualization: ChatbotResponse["visualization"]) => {
		if (!visualization) return null;

		switch (visualization.type) {
			case "table":
				return (
					<div className='mt-4 p-4 dark-dropdown rounded-lg'>
						<h4 className='font-semibold text-white mb-2'>Player Information</h4>
						<div className='overflow-x-auto'>
							<table className='min-w-full text-sm'>
								<thead>
									<tr className='border-b border-yellow-400/20'>
										{visualization.config?.columns?.map((col: string) => (
											<th key={col} className='text-left py-2 px-3 font-medium text-yellow-300'>
												{col === "name" ? "Player Name" : col}
											</th>
										))}
									</tr>
								</thead>
								<tbody>
									{visualization.data?.slice(0, 5).map((row: any, index: number) => (
										<tr key={index} className='border-b border-yellow-400/10'>
											{visualization.config?.columns?.map((col: string) => (
												<td key={col} className='py-2 px-3 text-white'>
													{row[col] || "-"}
												</td>
											))}
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				);

			case "chart":
				return (
					<div className='mt-4 p-4 dark-dropdown rounded-lg'>
						<h4 className='font-semibold text-white mb-2'>Chart Visualization</h4>
						<p className='text-yellow-300'>Chart data available: {JSON.stringify(visualization.data)}</p>
					</div>
				);

			default:
				return null;
		}
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
						placeholder='Ask me about player stats, team performance, or club information...'
						className='dark-chat-input w-full text-sm md:text-base text-white placeholder-white'
						disabled={isLoading}
					/>
					<button
						type='submit'
						disabled={!question.trim() || isLoading}
						className='CTA px-3 md:px-4 py-2 md:py-2 text-sm md:text-base w-full md:w-auto hidden md:block'>
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
			</form>

			{/* Response Display */}
			<AnimatePresence mode='wait'>
				{isLoading && (
					<motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className='text-center py-8'>
						<div className='inline-flex items-center space-x-2'>
							<div className='animate-spin rounded-full h-6 w-6 border-b-2 border-yellow-400'></div>
							<span className='text-yellow-300'>Thinking...</span>
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
						exit={{ opacity: 0, y: -10 }}
						className='dark-dropdown rounded-lg p-4 md:p-6 shadow-sm'>
						{/* Answer */}
						<div className='mb-3 md:mb-4'>
							<h3 className='font-semibold text-white mb-2 text-sm md:text-base'>Answer:</h3>
							<p className='text-yellow-100 text-sm md:text-base'>{response.answer}</p>
						</div>

						{/* Visualization */}
						{response.visualization && renderVisualization(response.visualization)}

					</motion.div>
				)}
			</AnimatePresence>

			{/* Questions Section - Show example questions when no past questions, or past questions when available */}
			<div className='mt-6 md:mt-8'>
				{/* Show example questions when no past conversations exist */}
				{conversationHistory.length === 0 && (
					<div>
						<h3 className='font-semibold text-white mb-3 md:mb-4 text-sm md:text-base'>Try these questions:</h3>
						<div className='space-y-2 md:space-y-3'>
							{homepageQuestions.map((q, index) => (
								<motion.div
									key={q.id}
									initial={{ opacity: 0, x: -20 }}
									animate={{ opacity: 1, x: 0 }}
									transition={{ delay: index * 0.1 }}
									className='dark-dropdown rounded-lg p-3 md:p-4 cursor-pointer hover:bg-yellow-400/5 transition-colors'
									onClick={() => {
										setQuestion(q.question);
										// Focus the input after setting the question
										setTimeout(() => {
											const input = document.querySelector('input[type="text"]') as HTMLInputElement;
											if (input) {
												input.focus();
												input.setSelectionRange(0, input.value.length);
											}
										}, 0);
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
						<div className='flex items-center justify-between mb-3 md:mb-4'>
							<h3 className='font-semibold text-white text-sm md:text-base'>Previous Conversations</h3>
							<button
								onClick={() => setShowExampleQuestions(!showExampleQuestions)}
								className='text-xs text-yellow-300 hover:text-yellow-200 transition-colors underline'>
								{showExampleQuestions ? "Hide" : "Show"} example questions
							</button>
						</div>

						{/* Show past conversations or example questions based on toggle */}
						{!showExampleQuestions ? (
							<div className='space-y-2 md:space-y-3 overflow-y-auto max-h-48 md:max-h-60 pr-2'>
								{conversationHistory
									.slice(-3)
									.reverse()
									.map((conv, index) => (
										<motion.div
											key={conv.timestamp}
											initial={{ opacity: 0, x: -20 }}
											animate={{ opacity: 1, x: 0 }}
											transition={{ delay: index * 0.1 }}
											className='dark-dropdown rounded-lg p-3 md:p-4 cursor-pointer hover:bg-yellow-400/5 transition-colors'
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
							<div className='space-y-2 md:space-y-3'>
								{homepageQuestions.map((q, index) => (
									<motion.div
										key={q.id}
										initial={{ opacity: 0, x: -20 }}
										animate={{ opacity: 1, x: 0 }}
										transition={{ delay: index * 0.1 }}
										className='dark-dropdown rounded-lg p-3 md:p-4 cursor-pointer hover:bg-yellow-400/5 transition-colors'
										onClick={() => {
											setQuestion(q.question);
											// Focus the input after setting the question
											setTimeout(() => {
												const input = document.querySelector('input[type="text"]') as HTMLInputElement;
												if (input) {
													input.focus();
													input.setSelectionRange(0, input.value.length);
												}
											}, 0);
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
