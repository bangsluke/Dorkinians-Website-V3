"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { ChatbotResponse } from "@/lib/services/chatbotService";
import { AnimatePresence } from "framer-motion";
import { useNavigationStore } from "@/lib/stores/navigation";

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

	// Load conversation history from localStorage on component mount
	useEffect(() => {
		console.log(`🤖 Frontend: ChatbotInterface mounted, selectedPlayer: ${selectedPlayer}`);
		if (typeof window !== 'undefined') {
			const saved = localStorage.getItem("chatbotConversations");
			if (saved) {
				try {
					const parsed = JSON.parse(saved);
					setConversationHistory(parsed);
				} catch (err) {
					console.error("Failed to parse saved conversations:", err);
				}
			}
		}
	}, [selectedPlayer]);

	// Save conversation history to localStorage whenever it changes
	useEffect(() => {
		if (typeof window !== 'undefined') {
			localStorage.setItem("chatbotConversations", JSON.stringify(conversationHistory));
		}
	}, [conversationHistory]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!question.trim() || isLoading) return;

		// Client-side logging for debugging
		console.log(`🤖 Frontend: Sending question: ${question.trim()}`);
		console.log(`🤖 Frontend: Player context: ${selectedPlayer || 'None'}`);

		setIsLoading(true);
		setError(null);
		setResponse(null);

		try {
			// Include player context in the question if available
			const questionWithContext = selectedPlayer ? `About ${selectedPlayer}: ${question.trim()}` : question.trim();

			const res = await fetch("/api/chatbot", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ question: questionWithContext }),
			});

			if (!res.ok) {
				throw new Error(`HTTP error! status: ${res.status}`);
			}

			const data: ChatbotResponse = await res.json();
			console.log(`🤖 Frontend: Received response:`, data);
			setResponse(data);

			// Save to conversation history with player context
			const newConversation: SavedConversation = {
				question: question.trim(),
				response: data,
				timestamp: Date.now(),
				playerContext: selectedPlayer || undefined,
			};
			setConversationHistory((prev) => [...prev, newConversation]);
		} catch (err) {
			console.error(`🤖 Frontend: Error occurred:`, err);
			setError(err instanceof Error ? err.message : "An error occurred");
		} finally {
			setIsLoading(false);
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
			<form onSubmit={handleSubmit} className='space-y-4'>
				<div className='flex space-x-2'>
					<input
						type='text'
						value={question}
						onChange={(e) => setQuestion(e.target.value)}
						placeholder='Ask me about player stats, team performance, or club information...'
						className='dark-chat-input flex-1'
						disabled={isLoading}
					/>
					<button
						type='submit'
						disabled={!question.trim() || isLoading}
						className='dark-chat-button disabled:opacity-50 disabled:cursor-not-allowed'>
						{isLoading ? (
							<svg className='animate-spin h-5 w-5' xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24'>
								<circle className='opacity-25' cx='12' cy='12' r='10' stroke='currentColor' strokeWidth='4'></circle>
								<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 19l9 2-9-18-9 18 9-2zm0 0v-8' />
							</svg>
						) : (
							"Ask"
						)}
					</button>
				</div>

				<p className='text-sm text-yellow-300 mt-2 text-center'>
					Try: &ldquo;How many players are in the club?&rdquo; or &ldquo;Who are the players?&rdquo;
				</p>
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
						className='dark-dropdown rounded-lg p-6 shadow-sm'>
						{/* Answer */}
						<div className='mb-4'>
							<h3 className='font-semibold text-white mb-2'>Answer:</h3>
							<p className='text-yellow-100'>{response.answer}</p>
						</div>

						{/* Confidence */}
						<div className='mb-4'>
							<div className='flex items-center space-x-2'>
								<span className='text-sm text-yellow-300'>Confidence:</span>
								<div className='flex-1 bg-yellow-400/20 rounded-full h-2'>
									<div className='bg-green-400 h-2 rounded-full transition-all duration-300' style={{ width: `${response.confidence * 100}%` }}></div>
								</div>
								<span className='text-sm text-yellow-300'>{Math.round(response.confidence * 100)}%</span>
							</div>
						</div>

						{/* Visualization */}
						{response.visualization && renderVisualization(response.visualization)}
					</motion.div>
				)}
			</AnimatePresence>

			{/* Conversation History */}
			{conversationHistory.length > 0 && (
				<div className='mt-8'>
					<h3 className='font-semibold text-white mb-4'>Previous Conversations</h3>
					<div className='space-y-3 overflow-y-auto max-h-60 pr-2'>
						{conversationHistory
							.slice(-5)
							.reverse()
							.map((conv, index) => (
								<motion.div
									key={conv.timestamp}
									initial={{ opacity: 0, x: -20 }}
									animate={{ opacity: 1, x: 0 }}
									transition={{ delay: index * 0.1 }}
									className='dark-dropdown rounded-lg p-4 cursor-pointer hover:bg-yellow-400/5 transition-colors'
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
										<p className='font-medium text-white text-sm'>Q: {conv.question}</p>
										<span className='text-xs text-yellow-300'>{new Date(conv.timestamp).toLocaleTimeString()}</span>
									</div>
									<p className='text-sm text-yellow-100'>{conv.response.answer}</p>
								</motion.div>
							))}
					</div>
				</div>
			)}
		</div>
	);
}
