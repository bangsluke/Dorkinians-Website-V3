"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { XMarkIcon, BugAntIcon, LightBulbIcon } from "@heroicons/react/24/outline";
import { appConfig } from "@/config/config";

interface FeedbackModalProps {
	isOpen: boolean;
	onClose: () => void;
}

type FeedbackType = "bug" | "feature";

export default function FeedbackModal({ isOpen, onClose }: FeedbackModalProps) {
	const [feedbackType, setFeedbackType] = useState<FeedbackType>("bug");
	const [name, setName] = useState("");
	const [message, setMessage] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		
		if (!name.trim() || !message.trim()) {
			return;
		}

		setIsSubmitting(true);
		setSubmitStatus("idle");

		try {
			const response = await fetch("/api/feedback", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					type: feedbackType,
					name: name.trim(),
					message: message.trim(),
					version: appConfig.version,
					timestamp: new Date().toISOString(),
				}),
			});

			if (response.ok) {
				setSubmitStatus("success");
				setTimeout(() => {
					onClose();
					// Reset form
					setName("");
					setMessage("");
					setFeedbackType("bug");
					setSubmitStatus("idle");
				}, 2000);
			} else {
				setSubmitStatus("error");
			}
		} catch (error) {
			console.error("Error submitting feedback:", error);
			setSubmitStatus("error");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleClose = () => {
		if (!isSubmitting) {
			onClose();
			// Reset form
			setName("");
			setMessage("");
			setFeedbackType("bug");
			setSubmitStatus("idle");
		}
	};

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
			<motion.div
				initial={{ opacity: 0, scale: 0.95 }}
				animate={{ opacity: 1, scale: 1 }}
				exit={{ opacity: 0, scale: 0.95 }}
				className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
			>
				{/* Header */}
				<div className="flex items-center justify-between mb-6">
					<div className="flex items-center space-x-3">
						<div className="p-2 rounded-full bg-dorkinians-yellow/20">
							{feedbackType === "bug" ? (
								<BugAntIcon className="w-5 h-5 text-dorkinians-yellow" />
							) : (
								<LightBulbIcon className="w-5 h-5 text-dorkinians-yellow" />
							)}
						</div>
						<h2 className="text-xl font-bold text-gray-900">
							{feedbackType === "bug" ? "Report a Bug" : "Request a Feature"}
						</h2>
					</div>
					<button
						onClick={handleClose}
						disabled={isSubmitting}
						className="p-1 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50"
					>
						<XMarkIcon className="w-5 h-5 text-gray-500" />
					</button>
				</div>

				{/* Type Toggle */}
				<div className="mb-6">
					<div className="flex bg-gray-100 rounded-lg p-1">
						<button
							type="button"
							onClick={() => setFeedbackType("bug")}
							className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md transition-all ${
								feedbackType === "bug"
									? "bg-white text-dorkinians-blue shadow-sm"
									: "text-gray-600 hover:text-gray-900"
							}`}
						>
							<BugAntIcon className="w-4 h-4" />
							<span className="text-sm font-medium">Bug Report</span>
						</button>
						<button
							type="button"
							onClick={() => setFeedbackType("feature")}
							className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md transition-all ${
								feedbackType === "feature"
									? "bg-white text-dorkinians-blue shadow-sm"
									: "text-gray-600 hover:text-gray-900"
							}`}
						>
							<LightBulbIcon className="w-4 h-4" />
							<span className="text-sm font-medium">Feature Request</span>
						</button>
					</div>
				</div>

				{/* Form */}
				<form onSubmit={handleSubmit} className="space-y-4">
					{/* Name Field */}
					<div>
						<label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
							Your Name *
						</label>
						<input
							type="text"
							id="name"
							value={name}
							onChange={(e) => setName(e.target.value)}
							required
							disabled={isSubmitting}
							className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-dorkinians-blue focus:border-transparent disabled:opacity-50 disabled:bg-gray-100"
							placeholder="Enter your name"
						/>
						<p className="text-xs text-gray-500 mt-1">
							This helps me follow up if I have questions
						</p>
					</div>

					{/* Message Field */}
					<div>
						<label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
							{feedbackType === "bug" ? "Bug Description" : "Feature Description"} *
						</label>
						<textarea
							id="message"
							value={message}
							onChange={(e) => setMessage(e.target.value)}
							required
							disabled={isSubmitting}
							rows={4}
							className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-dorkinians-blue focus:border-transparent disabled:opacity-50 disabled:bg-gray-100 resize-none"
							placeholder={
								feedbackType === "bug"
									? "Describe the bug you encountered, including steps to reproduce it..."
									: "Describe the feature you'd like to see added..."
							}
						/>
					</div>

					{/* Submit Status */}
					{submitStatus === "success" && (
						<div className="p-3 bg-green-50 border border-green-200 rounded-md">
							<p className="text-sm text-green-800">
								Thank you! Your {feedbackType === "bug" ? "bug report" : "feature request"} has been sent.
							</p>
						</div>
					)}

					{submitStatus === "error" && (
						<div className="p-3 bg-red-50 border border-red-200 rounded-md">
							<p className="text-sm text-red-800">
								Sorry, there was an error sending your message. Please try again.
							</p>
						</div>
					)}

					{/* Submit Button */}
					<div className="flex space-x-3 pt-4">
						<button
							type="button"
							onClick={handleClose}
							disabled={isSubmitting}
							className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={isSubmitting || !name.trim() || !message.trim()}
							className="flex-1 px-4 py-2 text-sm font-medium text-white bg-dorkinians-blue rounded-md hover:bg-dorkinians-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{isSubmitting ? (
								<div className="flex items-center justify-center space-x-2">
									<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
									<span>Sending...</span>
								</div>
							) : (
								`Send ${feedbackType === "bug" ? "Bug Report" : "Feature Request"}`
							)}
						</button>
					</div>
				</form>
			</motion.div>
		</div>
	);
}
