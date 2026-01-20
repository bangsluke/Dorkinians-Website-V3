"use client";

import { FocusTrap } from "@headlessui/react";
import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface ModalWrapperProps {
	isOpen: boolean;
	onClose: () => void;
	children: React.ReactNode;
	backdropClassName?: string;
	modalClassName?: string;
	ariaLabel?: string;
	ariaLabelledBy?: string;
	initialFocusRef?: React.RefObject<HTMLElement>;
}

export default function ModalWrapper({
	isOpen,
	onClose,
	children,
	backdropClassName = "fixed inset-0 bg-black/50 z-50",
	modalClassName = "",
	ariaLabel,
	ariaLabelledBy,
	initialFocusRef,
}: ModalWrapperProps) {
	const previousActiveElementRef = useRef<HTMLElement | null>(null);

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
			// Use setTimeout to ensure modal is fully closed before focusing
			setTimeout(() => {
				previousActiveElementRef.current?.focus();
			}, 0);
		}
	}, [isOpen]);

	if (!isOpen) return null;

	return (
		<AnimatePresence>
			{isOpen && (
				<>
					{/* Backdrop */}
					<motion.div
						className={backdropClassName}
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={onClose}
						aria-hidden="true"
					/>

					{/* Modal with Focus Trap */}
					<FocusTrap initialFocus={initialFocusRef}>
						<motion.div
							role="dialog"
							aria-modal="true"
							aria-label={ariaLabel}
							aria-labelledby={ariaLabelledBy}
							className={modalClassName}
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							onClick={(e) => e.stopPropagation()}>
							{children}
						</motion.div>
					</FocusTrap>
				</>
			)}
		</AnimatePresence>
	);
}
