"use client";

import { useState, useEffect } from "react";

interface UnansweredQuestion {
	id: string;
	questionHash: string;
	originalQuestion: string;
	correctedQuestion?: string;
	analysis: {
		type: string;
		entities: string[];
		metrics: string[];
		complexity: string;
		requiresClarification: boolean;
	};
	confidence: number;
	timestamp: string;
	userContext?: string;
	handled: boolean;
	count?: number;
}

export default function UnansweredQuestionsView() {
	const [questions, setQuestions] = useState<UnansweredQuestion[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [filters, setFilters] = useState({
		handled: undefined as boolean | undefined,
		confidenceMin: undefined as number | undefined,
		confidenceMax: undefined as number | undefined,
		dateFrom: undefined as string | undefined,
		dateTo: undefined as string | undefined,
	});
	const [selectedQuestion, setSelectedQuestion] = useState<UnansweredQuestion | null>(null);

	const fetchQuestions = async () => {
		setLoading(true);
		setError(null);

		try {
			const params = new URLSearchParams();
			if (filters.handled !== undefined) {
				params.append("handled", filters.handled.toString());
			}
			if (filters.confidenceMin !== undefined) {
				params.append("confidenceMin", filters.confidenceMin.toString());
			}
			if (filters.confidenceMax !== undefined) {
				params.append("confidenceMax", filters.confidenceMax.toString());
			}
			if (filters.dateFrom) {
				params.append("dateFrom", filters.dateFrom);
			}
			if (filters.dateTo) {
				params.append("dateTo", filters.dateTo);
			}
			params.append("limit", "100");

			const response = await fetch(`/api/admin/unanswered-questions?${params.toString()}`);
			const data = await response.json();

			if (data.success) {
				setQuestions(data.data);
			} else {
				setError(data.error || "Failed to fetch questions");
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Unknown error");
		} finally {
			setLoading(false);
		}
	};

	const markAsHandled = async (questionHash: string) => {
		try {
			const response = await fetch("/api/admin/unanswered-questions", {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ questionHash, handled: true }),
			});

			const data = await response.json();

			if (data.success) {
				fetchQuestions();
			} else {
				setError(data.error || "Failed to mark question as handled");
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Unknown error");
		}
	};

	useEffect(() => {
		fetchQuestions();
	}, []);

	const formatDate = (dateString: string) => {
		return new Date(dateString).toLocaleString();
	};

	const getConfidenceColor = (confidence: number) => {
		if (confidence < 0.3) return "text-red-600";
		if (confidence < 0.5) return "text-orange-600";
		if (confidence < 0.7) return "text-yellow-600";
		return "text-green-600";
	};

	return (
		<div className='p-6 bg-white rounded-lg shadow-lg'>
			<h2 className='text-2xl font-bold mb-4'>Unanswered Questions</h2>

			{/* Filters */}
			<div className='mb-4 p-4 bg-gray-50 rounded-lg'>
				<div className='grid grid-cols-1 md:grid-cols-3 gap-4'>
					<div>
						<label className='block text-sm font-medium mb-1'>Status</label>
						<select
							value={filters.handled === undefined ? "" : filters.handled.toString()}
							onChange={(e) =>
								setFilters({
									...filters,
									handled: e.target.value === "" ? undefined : e.target.value === "true",
								})
							}
							className='w-full px-3 py-2 border rounded-md'>
							<option value=''>All</option>
							<option value='false'>Unhandled</option>
							<option value='true'>Handled</option>
						</select>
					</div>
					<div>
						<label className='block text-sm font-medium mb-1'>Min Confidence</label>
						<input
							type='number'
							min='0'
							max='1'
							step='0.1'
							value={filters.confidenceMin ?? ""}
							onChange={(e) =>
								setFilters({
									...filters,
									confidenceMin: e.target.value ? parseFloat(e.target.value) : undefined,
								})
							}
							className='w-full px-3 py-2 border rounded-md'
						/>
					</div>
					<div>
						<label className='block text-sm font-medium mb-1'>Max Confidence</label>
						<input
							type='number'
							min='0'
							max='1'
							step='0.1'
							value={filters.confidenceMax ?? ""}
							onChange={(e) =>
								setFilters({
									...filters,
									confidenceMax: e.target.value ? parseFloat(e.target.value) : undefined,
								})
							}
							className='w-full px-3 py-2 border rounded-md'
						/>
					</div>
				</div>
				<button
					onClick={fetchQuestions}
					className='mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700'>
					Apply Filters
				</button>
			</div>

			{/* Error Display */}
			{error && (
				<div className='mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-600'>
					{error}
				</div>
			)}

			{/* Loading State */}
			{loading && <div className='text-center py-4'>Loading...</div>}

			{/* Questions List */}
			{!loading && (
				<div className='space-y-4'>
					{questions.length === 0 ? (
						<div className='text-center py-8 text-gray-500'>No unanswered questions found.</div>
					) : (
						questions.map((question) => (
							<div
								key={question.id}
								className={`p-4 border rounded-lg ${
									question.handled ? "bg-gray-50 opacity-75" : "bg-white"
								}`}>
								<div className='flex justify-between items-start mb-2'>
									<div className='flex-1'>
										<p className='font-semibold text-lg'>{question.originalQuestion}</p>
										{question.correctedQuestion && (
											<p className='text-sm text-gray-600 mt-1'>
												Corrected: {question.correctedQuestion}
											</p>
										)}
									</div>
									<div className='flex gap-2'>
										{!question.handled && (
											<button
												onClick={() => markAsHandled(question.questionHash)}
												className='px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700'>
												Mark Handled
											</button>
										)}
										<button
											onClick={() => setSelectedQuestion(question)}
											className='px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700'>
											Details
										</button>
									</div>
								</div>
								<div className='grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-600'>
									<div>
										<span className='font-medium'>Confidence: </span>
										<span className={getConfidenceColor(question.confidence)}>
											{(question.confidence * 100).toFixed(0)}%
										</span>
									</div>
									<div>
										<span className='font-medium'>Type: </span>
										{question.analysis.type}
									</div>
									<div>
										<span className='font-medium'>Complexity: </span>
										{question.analysis.complexity}
									</div>
									<div>
										<span className='font-medium'>Asked: </span>
										{question.count || 1} time{question.count !== 1 ? "s" : ""}
									</div>
								</div>
								<div className='mt-2 text-xs text-gray-500'>
									{formatDate(question.timestamp)}
									{question.userContext && ` • Context: ${question.userContext}`}
								</div>
							</div>
						))
					)}
				</div>
			)}

			{/* Details Modal */}
			{selectedQuestion && (
				<div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
					<div className='bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto'>
						<div className='flex justify-between items-center mb-4'>
							<h3 className='text-xl font-bold'>Question Details</h3>
							<button
								onClick={() => setSelectedQuestion(null)}
								className='text-gray-500 hover:text-gray-700'>
								✕
							</button>
						</div>
						<div className='space-y-4'>
							<div>
								<strong>Original Question:</strong>
								<p className='mt-1'>{selectedQuestion.originalQuestion}</p>
							</div>
							{selectedQuestion.correctedQuestion && (
								<div>
									<strong>Corrected Question:</strong>
									<p className='mt-1'>{selectedQuestion.correctedQuestion}</p>
								</div>
							)}
							<div>
								<strong>Analysis:</strong>
								<pre className='mt-1 p-2 bg-gray-50 rounded text-xs overflow-auto'>
									{JSON.stringify(selectedQuestion.analysis, null, 2)}
								</pre>
							</div>
							<div>
								<strong>Confidence:</strong> {(selectedQuestion.confidence * 100).toFixed(0)}%
							</div>
							<div>
								<strong>Timestamp:</strong> {formatDate(selectedQuestion.timestamp)}
							</div>
							{selectedQuestion.userContext && (
								<div>
									<strong>User Context:</strong> {selectedQuestion.userContext}
								</div>
							)}
							<div>
								<strong>Status:</strong> {selectedQuestion.handled ? "Handled" : "Unhandled"}
							</div>
							{selectedQuestion.count && (
								<div>
									<strong>Times Asked:</strong> {selectedQuestion.count}
								</div>
							)}
						</div>
					</div>
				</div>
			)}
		</div>
	);
}

