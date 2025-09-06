"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { XMarkIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { appConfig } from "@/config/config";

interface DataPrivacyModalProps {
	isOpen: boolean;
	onClose: () => void;
}

export default function DataPrivacyModal({ isOpen, onClose }: DataPrivacyModalProps) {
	const [name, setName] = useState("");
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		
		if (!name.trim()) {
			return;
		}

		setIsSubmitting(true);
		setSubmitStatus("idle");

		try {
			const response = await fetch("/api/data-removal", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					name: name.trim(),
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
					setSubmitStatus("idle");
				}, 2000);
			} else {
				setSubmitStatus("error");
			}
		} catch (error) {
			console.error("Error submitting removal request:", error);
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
							<ShieldCheckIcon className="w-5 h-5 text-dorkinians-yellow" />
						</div>
						<h2 className="text-xl font-bold text-gray-900">Data Removal Request</h2>
					</div>
					<button
						onClick={handleClose}
						disabled={isSubmitting}
						className="p-1 rounded-full hover:bg-gray-100 transition-colors disabled:opacity-50"
					>
						<XMarkIcon className="w-5 h-5 text-gray-500" />
					</button>
				</div>

				{/* Information */}
				<div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
					<p className="text-sm text-blue-800">
						If you would like your data to be removed from the Dorkinians FC website, 
						please provide your name below and we will process your request.
					</p>
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
							placeholder="Enter your name to be removed"
						/>
						<p className="text-xs text-gray-500 mt-1">
							This will be included in the removal request email
						</p>
					</div>

					{/* Submit Status */}
					{submitStatus === "success" && (
						<div className="p-3 bg-green-50 border border-green-200 rounded-md">
							<p className="text-sm text-green-800">
								Thank you! Your data removal request has been sent.
							</p>
						</div>
					)}

					{submitStatus === "error" && (
						<div className="p-3 bg-red-50 border border-red-200 rounded-md">
							<p className="text-sm text-red-800">
								Sorry, there was an error sending your request. Please try again.
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
							disabled={isSubmitting || !name.trim()}
							className="flex-1 px-4 py-2 text-sm font-medium text-white bg-dorkinians-blue rounded-md hover:bg-dorkinians-blue/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{isSubmitting ? (
								<div className="flex items-center justify-center space-x-2">
									<div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
									<span>Sending...</span>
								</div>
							) : (
								"Send Removal Request"
							)}
						</button>
					</div>
				</form>
			</motion.div>
		</div>
	);
}
