"use client";

import { motion } from "framer-motion";
import { useState, useEffect, useRef } from "react";
import { FocusTrap } from "@headlessui/react";
import { XMarkIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { appConfig } from "@/config/config";
import Input from "@/components/ui/Input";

interface DataPrivacyModalProps {
	isOpen: boolean;
	onClose: () => void;
}

export default function DataPrivacyModal({ isOpen, onClose }: DataPrivacyModalProps) {
	const [name, setName] = useState("");
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
					aria-label="Data Removal Request"
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
							<ShieldCheckIcon className='w-5 h-5 text-dorkinians-yellow' />
						</div>
						<h2 className='text-xl font-bold text-[var(--color-text-primary)]'>Data Removal Request</h2>
					</div>
					<button
						onClick={handleClose}
						disabled={isSubmitting}
						className='text-[var(--color-text-primary)] hover:text-gray-200 ml-4 flex-shrink-0 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-field-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent'
						aria-label='Close data privacy modal'>
						<XMarkIcon className='w-6 h-6' />
					</button>
				</div>

				{/* Scrollable content */}
				<div className='flex-1 overflow-y-auto min-h-0 px-6 pt-4' style={{ WebkitOverflowScrolling: 'touch' }}>
					{/* Information */}
					<div className='mb-6 p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md'>
						<p className='text-sm text-[var(--color-text-primary)]'>
							If you would like your data to be removed from the Dorkinians FC website, please provide your name below and we will process your
							request.
						</p>
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
								placeholder='Enter your name to be removed'
								size="md"
							/>
							<p className='text-xs text-gray-400 mt-1'>This will be included in the removal request email</p>
						</div>

						{/* Send Button */}
						<div className='flex justify-center pt-2'>
							<button
								type='submit'
								disabled={isSubmitting || !name.trim()}
								className='px-5 py-2 bg-dorkinians-yellow text-black text-sm font-semibold rounded-lg hover:bg-dorkinians-yellow/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-field-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent'>
								Send
							</button>
						</div>

						{/* Submit Status */}
						{submitStatus === "success" && (
							<div className='p-3 bg-green-500/20 border border-green-500/50 rounded-md'>
								<p className='text-sm text-green-400'>Thank you! Your data removal request has been sent.</p>
							</div>
						)}

						{submitStatus === "error" && (
							<div className='p-3 bg-red-500/20 border border-red-500/50 rounded-md'>
								<p className='text-sm text-red-400'>Sorry, there was an error sending your request. Please try again.</p>
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
