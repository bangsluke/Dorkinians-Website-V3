"use client";

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { XMarkIcon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { appConfig } from "@/config/config";
import Input from "@/components/ui/Input";
import ModalWrapper from "./ModalWrapper";
import { useNavigationStore } from "@/lib/stores/navigation";

interface DataPrivacyModalProps {
	isOpen: boolean;
	onClose: () => void;
}

export default function DataPrivacyModal({ isOpen, onClose }: DataPrivacyModalProps) {
	const { selectedPlayer } = useNavigationStore();
	
	// Get selectedPlayer from store or localStorage as fallback
	const getSelectedPlayer = (): string | null => {
		if (selectedPlayer) return selectedPlayer;
		if (typeof window !== "undefined") {
			const stored = localStorage.getItem("dorkinians-selected-player");
			return stored || null;
		}
		return null;
	};
	
	const currentSelectedPlayer = getSelectedPlayer();
	const initialName = currentSelectedPlayer || "";
	const [name, setName] = useState(initialName);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");
	const nameInputRef = useRef<HTMLInputElement>(null);

	// Pre-populate name with selectedPlayer when modal opens
	useEffect(() => {
		if (isOpen) {
			const playerName = getSelectedPlayer();
			if (playerName) {
				setName(playerName);
				// Select the text after a delay to ensure the input is focused
				setTimeout(() => {
					if (nameInputRef.current) {
						nameInputRef.current.focus();
						nameInputRef.current.select();
					}
				}, 200);
			} else {
				setName("");
			}
		}
	}, [isOpen, selectedPlayer]);

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

	if (typeof window === 'undefined') {
		return null;
	}

	const modalContent = (
		<ModalWrapper
			isOpen={isOpen}
			onClose={handleClose}
			backdropClassName="fixed inset-0 bg-black/50 z-[9999]"
			modalClassName="fixed inset-0 h-screen w-screen z-[10000] shadow-xl"
			ariaLabel="Data Removal Request"
			initialFocusRef={nameInputRef}>
			<div 
				className='flex flex-col h-full'
				style={{ backgroundColor: 'rgb(14, 17, 15)' }}>
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
						className='min-w-[44px] min-h-[44px] p-2 rounded-full hover:bg-[var(--color-surface-elevated)] transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-field-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent'
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
								onFocus={(e) => {
									const playerName = getSelectedPlayer();
									if (playerName && e.target.value === playerName) {
										e.target.select();
									}
								}}
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
			</div>
		</ModalWrapper>
	);

	return createPortal(modalContent, document.body);
}
