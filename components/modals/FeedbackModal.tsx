"use client";

import { motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { FocusTrap } from "@headlessui/react";
import { XMarkIcon, BugAntIcon, LightBulbIcon } from "@heroicons/react/24/outline";
import { appConfig } from "@/config/config";
import Input, { Textarea } from "@/components/ui/Input";

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
	const previousActiveElementRef = useRef<HTMLElement | null>(null);
	const nameInputRef = useRef<HTMLInputElement>(null);

	// Track the element that had focus before modal opened
	useEffect(() => {
		if (isOpen) {
			previousActiveElementRef.current = document.activeElement as HTMLElement;
		}
	}, [isOpen]);

	// Handle ESC key
	useEffect(() => {
		if (!isOpen) return;

		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === "Escape" && !isSubmitting) {
				onClose();
			}
		};

		document.addEventListener("keydown", handleEscape);
		return () => {
			document.removeEventListener("keydown", handleEscape);
		};
	}, [isOpen, onClose, isSubmitting]);

	// Return focus to previous element when modal closes
	useEffect(() => {
		if (!isOpen && previousActiveElementRef.current) {
			setTimeout(() => {
				previousActiveElementRef.current?.focus();
			}, 0);
		}
	}, [isOpen]);

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
		<>
			{/* Backdrop */}
			<motion.div
				className='fixed inset-0 z-50'
				style={{ backgroundColor: 'rgba(15, 15, 15, 0.5)' }}
				initial={{ opacity: 0 }}
				animate={{ opacity: 1 }}
				exit={{ opacity: 0 }}
				onClick={handleClose}
				aria-hidden="true"
			/>

			{/* Modal with Focus Trap */}
			<FocusTrap initialFocus={nameInputRef}>
				<motion.div
					role="dialog"
					aria-modal="true"
					aria-label={feedbackType === "bug" ? "Report a Bug" : "Request a Feature"}
					initial={{ opacity: 0, scale: 0.95 }}
					animate={{ opacity: 1, scale: 1 }}
					exit={{ opacity: 0, scale: 0.95 }}
					className='fixed inset-0 z-50 flex flex-col'
					style={{ backgroundColor: 'rgb(14, 17, 15)' }}
					onClick={(e) => e.stopPropagation()}>
				{/* Header */}
				<div className='flex-shrink-0 flex justify-between items-center p-4 border-b border-[var(--color-border)]'>
					<div className='flex items-center space-x-3 flex-1 justify-center'>
						<div className='p-2 rounded-full bg-dorkinians-yellow/20'>
							{feedbackType === "bug" ? (
								<BugAntIcon className='w-5 h-5 text-dorkinians-yellow' />
							) : (
								<LightBulbIcon className='w-5 h-5 text-dorkinians-yellow' />
							)}
						</div>
						<h2 className='text-xl font-bold text-[var(--color-text-primary)]'>{feedbackType === "bug" ? "Report a Bug" : "Request a Feature"}</h2>
					</div>
					<button
						onClick={handleClose}
						disabled={isSubmitting}
						className='text-[var(--color-text-primary)] hover:text-gray-200 ml-4 flex-shrink-0 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-field-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent'
						aria-label='Close feedback modal'>
						<XMarkIcon className='w-6 h-6' />
					</button>
				</div>

				{/* Scrollable content */}
				<div className='flex-1 overflow-y-auto min-h-0 px-6 pt-4' style={{ WebkitOverflowScrolling: 'touch' }}>
					{/* Type Toggle */}
					<div className='mb-6'>
						<div className='flex bg-[var(--color-surface)] rounded-lg p-1'>
							<button
								type='button'
								onClick={() => setFeedbackType("bug")}
								className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md transition-all ${
									feedbackType === "bug" ? "bg-dorkinians-yellow text-black shadow-sm" : "text-[var(--color-text-primary)] hover:text-dorkinians-yellow"
								}`}>
								<BugAntIcon className='w-4 h-4' />
								<span className='text-sm font-medium'>Bug Report</span>
							</button>
							<button
								type='button'
								onClick={() => setFeedbackType("feature")}
								className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-md transition-all ${
									feedbackType === "feature" ? "bg-dorkinians-yellow text-black shadow-sm" : "text-[var(--color-text-primary)] hover:text-dorkinians-yellow"
								}`}>
								<LightBulbIcon className='w-4 h-4' />
								<span className='text-sm font-medium'>Feature Request</span>
							</button>
						</div>
					</div>

					{/* Form */}
					<form onSubmit={handleSubmit} className='space-y-4'>
						{/* Name Field */}
						<div>
							<Input
								ref={nameInputRef}
								type='text'
								id='name'
								label='Your Name'
								value={name}
								onChange={(e) => setName(e.target.value)}
								required
								disabled={isSubmitting}
								placeholder='Enter your name'
								size="md"
							/>
							<p className='text-xs text-gray-400 mt-1'>This helps me follow up if I have questions</p>
						</div>

						{/* Message Field */}
						<div>
							<Textarea
								id='message'
								label={feedbackType === "bug" ? "Bug Description" : "Feature Description"}
								value={message}
								onChange={(e) => setMessage(e.target.value)}
								required
								disabled={isSubmitting}
								rows={4}
								placeholder={
									feedbackType === "bug"
										? "Describe the bug you encountered, including steps to reproduce it..."
										: "Describe the feature you'd like to see added..."
								}
								size="md"
							/>
						</div>

						{/* Send Button */}
						<div className='flex justify-center pt-2'>
							<button
								type='submit'
								disabled={isSubmitting || !name.trim() || !message.trim()}
								className='px-5 py-2 bg-dorkinians-yellow text-black text-sm font-semibold rounded-lg hover:bg-dorkinians-yellow/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'>
								Send
							</button>
						</div>

						{/* Submit Status */}
						{submitStatus === "success" && (
							<div className='p-3 bg-green-500/20 border border-green-500/50 rounded-md'>
								<p className='text-sm text-green-400'>Thank you! Your {feedbackType === "bug" ? "bug report" : "feature request"} has been sent.</p>
							</div>
						)}

						{submitStatus === "error" && (
							<div className='p-3 bg-red-500/20 border border-red-500/50 rounded-md'>
								<p className='text-sm text-red-400'>Sorry, there was an error sending your message. Please try again.</p>
							</div>
						)}
					</form>
				</div>

				{/* Close Button at Bottom */}
				<div className='flex-shrink-0 flex justify-center p-4 border-t border-[var(--color-border)]'>
					<button
						type='button'
						onClick={handleClose}
						disabled={isSubmitting}
						className='px-5 py-2 bg-dorkinians-yellow text-black text-sm font-semibold rounded-lg hover:bg-dorkinians-yellow/90 transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-field-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent'>
						Close
					</button>
				</div>
			</motion.div>
			</FocusTrap>
		</>
	);
}
