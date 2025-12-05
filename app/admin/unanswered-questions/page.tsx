"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface UnansweredQuestion {
	timestamp: string;
	question: string;
	playerName: string;
}

export default function UnansweredQuestionsPage() {
	const [questions, setQuestions] = useState<UnansweredQuestion[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const fetchQuestions = async () => {
		setLoading(true);
		setError(null);

		try {
			const response = await fetch("/api/admin/unanswered-questions");
			const data = await response.json();

			if (data.success) {
				setQuestions(data.data || []);
			} else {
				throw new Error(data.error || "Failed to fetch unanswered questions");
			}
		} catch (err) {
			console.error("Error fetching unanswered questions:", err);
			setError(err instanceof Error ? err.message : "Network error");
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		fetchQuestions();
	}, []);

	const formatDate = (dateString: string) => {
		try {
			return new Date(dateString).toLocaleString();
		} catch {
			return dateString;
		}
	};

	return (
		<div className='min-h-screen bg-gray-100 py-4 sm:py-8'>
			<div className='container mx-auto max-w-6xl px-2 sm:px-4'>
				<div className='bg-white rounded-lg shadow-lg p-4 sm:p-6'>
					<div className='flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4'>
						<div>
							<h1 className='text-2xl sm:text-3xl font-bold text-gray-900 mb-2'>All Unanswered Questions</h1>
							<p className='text-sm sm:text-base text-gray-600'>
								Total: <strong>{questions.length}</strong> unanswered question{questions.length !== 1 ? "s" : ""}
							</p>
						</div>
						<Link
							href='/admin'
							className='w-full sm:w-auto px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors text-center sm:text-left'>
							← Back to Admin
						</Link>
					</div>

					<div className='mb-4 flex gap-2'>
						<button
							onClick={fetchQuestions}
							disabled={loading}
							className={`px-4 py-2 rounded-lg text-sm font-semibold text-white transition-colors ${
								loading ? "bg-gray-400 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700"
							}`}>
							{loading ? "🔄 Loading..." : "🔄 Refresh"}
						</button>
					</div>

					{error && (
						<div className='mb-4 p-3 bg-red-50 border border-red-200 rounded-lg'>
							<p className='text-red-600 text-sm'>
								❌ <strong>Error:</strong> {error}
							</p>
						</div>
					)}

					{loading ? (
						<div className='text-center py-8 text-gray-500'>Loading questions...</div>
					) : questions.length === 0 ? (
						<div className='text-center py-8 text-gray-500'>No unanswered questions found.</div>
					) : (
						<div className='space-y-3 max-h-[calc(100vh-200px)] sm:max-h-[calc(100vh-300px)] overflow-y-auto'>
							{questions.map((item, index) => (
								<div
									key={index}
									className='p-3 sm:p-4 bg-white border border-blue-200 rounded-lg hover:shadow-md transition-shadow'>
									<div className='flex justify-between items-start gap-4'>
										<div className='flex-1'>
											<p className='text-gray-800 font-medium text-sm sm:text-base'>{item.question}</p>
											<div className='flex flex-col sm:flex-row sm:gap-2 mt-2'>
												<p className='text-xs text-gray-500'>
													{formatDate(item.timestamp)}
												</p>
												<p className='text-xs text-gray-500'>
													Player: <span className='font-medium'>{item.playerName}</span>
												</p>
											</div>
										</div>
									</div>
								</div>
							))}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

