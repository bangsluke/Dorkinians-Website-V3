"use client";

import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { FocusTrap } from "@headlessui/react";
import { useEffect, useRef } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { allExampleQuestions } from "@/config/config";

interface ExampleQuestionsModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSelectQuestion: (question: string) => void;
}

export default function ExampleQuestionsModal({ isOpen, onClose, onSelectQuestion }: ExampleQuestionsModalProps) {
	const previousActiveElementRef = useRef<HTMLElement | null>(null);
	const firstQuestionRef = useRef<HTMLDivElement>(null);

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
			if (e.key === "Escape") {
				onClose();
			}
		};

		document.addEventListener("keydown", handleEscape);
		return () => {
			document.removeEventListener("keydown", handleEscape);
		};
	}, [isOpen, onClose]);

	// Return focus to previous element when modal closes
	useEffect(() => {
		if (!isOpen && previousActiveElementRef.current) {
			setTimeout(() => {
				previousActiveElementRef.current?.focus();
			}, 0);
		}
	}, [isOpen]);

	const handleClose = () => {
		onClose();
	};

	const handleQuestionClick = (question: string) => {
		onSelectQuestion(question);
	};

	if (!isOpen) return null;

	if (typeof window === 'undefined') {
		return null;
	}

	const modalContent = (
		<AnimatePresence>
			{isOpen && (
				<>
					{/* Backdrop */}
					<motion.div
						className='fixed inset-0 bg-black/50 z-[9999]'
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={handleClose}
						aria-hidden="true"
					/>

					{/* Full-screen modal with Focus Trap */}
					<FocusTrap initialFocus={firstQuestionRef}>
						<motion.div
							role="dialog"
							aria-modal="true"
							aria-label="Example Questions"
							className='fixed inset-0 h-screen w-screen z-[10000] shadow-xl'
							style={{ backgroundColor: '#0f0f0f' }}
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							transition={{ type: "spring", stiffness: 300, damping: 30 }}
							onClick={(e) => e.stopPropagation()}>
						<div className='h-full flex flex-col'>
							{/* Header */}
							<div className='flex items-center justify-between p-4 border-b border-[var(--color-border)]'>
								<div className='flex items-center space-x-3 flex-1 justify-center'>
									<div className='p-2 rounded-full bg-dorkinians-yellow/20'>
										<svg className='w-5 h-5 text-dorkinians-yellow' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
											<path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' />
										</svg>
									</div>
									<h2 className='text-lg font-semibold text-[var(--color-text-primary)]'>Example Questions</h2>
								</div>
								<button
									onClick={handleClose}
									className='p-2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface)] rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-field-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent'
									aria-label='Close example questions modal'>
									<XMarkIcon className='w-5 h-5' />
								</button>
							</div>

							{/* Scrollable content */}
							<div 
								className='flex-1 overflow-y-auto p-4 space-y-2 md:space-y-3'
								style={{ WebkitOverflowScrolling: 'touch' }}>
								{allExampleQuestions.map((question, index) => (
									<motion.div
										key={index}
										ref={index === 0 ? firstQuestionRef : undefined}
										initial={{ opacity: 0, x: -20 }}
										animate={{ opacity: 1, x: 0 }}
										transition={{ delay: index * 0.02 }}
										className='rounded-lg p-3 md:p-4 cursor-pointer hover:bg-yellow-400/5 transition-colors bg-gradient-to-b from-white/[0.22] to-white/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-field-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent'
										onClick={() => handleQuestionClick(question)}
										tabIndex={0}
										role="button"
										aria-label={`Select question: ${question}`}>
										<div className='flex items-start gap-3'>
											<span className='flex-shrink-0 w-6 h-6 rounded-full bg-dorkinians-yellow text-black text-xs font-semibold flex items-center justify-center'>
												{index + 1}
											</span>
											<p className='font-medium text-[var(--color-text-primary)] text-xs md:text-sm'>{question}</p>
										</div>
									</motion.div>
								))}
							</div>

							{/* Close Button at Bottom */}
							<div className='flex-shrink-0 flex justify-center p-4 border-t border-[var(--color-border)]'>
								<button
									type='button'
									onClick={handleClose}
									className='px-5 py-2 bg-dorkinians-yellow text-black text-sm font-semibold rounded-lg hover:bg-dorkinians-yellow/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-field-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent'>
									Close
								</button>
							</div>
						</div>
					</motion.div>
					</FocusTrap>
				</>
			)}
		</AnimatePresence>
	);

	return createPortal(modalContent, document.body);
}
