"use client";

import { motion, AnimatePresence } from "framer-motion";
import { XMarkIcon } from "@heroicons/react/24/outline";
import { useEffect } from "react";

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastProps {
	message: string;
	type: ToastType;
	duration?: number; // milliseconds, 0 = no auto-dismiss
	onDismiss?: () => void;
	id?: string; // For managing multiple toasts
}

const toastStyles = {
	success: {
		bg: 'bg-green-500',
		icon: '✅',
	},
	error: {
		bg: 'bg-red-500',
		icon: '❌',
	},
	info: {
		bg: 'bg-blue-500',
		icon: 'ℹ️',
	},
	warning: {
		bg: 'bg-yellow-500',
		icon: '⚠️',
	},
};

export default function Toast({ message, type, duration = 5000, onDismiss, id }: ToastProps) {
	const style = toastStyles[type];

	useEffect(() => {
		if (duration > 0 && onDismiss) {
			const timer = setTimeout(() => {
				onDismiss();
			}, duration);
			return () => clearTimeout(timer);
		}
	}, [duration, onDismiss]);

	return (
		<motion.div
			key={id}
			initial={{ opacity: 0, y: -20, x: 20 }}
			animate={{ opacity: 1, y: 0, x: 0 }}
			exit={{ opacity: 0, y: -20, x: 20 }}
			transition={{ 
				duration: 0.2, // Matches --duration-normal
				ease: [0, 0, 0.2, 1] // Matches --ease-out
			}}
			className={`fixed top-4 right-2 sm:right-4 z-50 p-3 sm:p-4 rounded-lg shadow-lg transition-all max-w-[calc(100vw-1rem)] sm:max-w-md ${style.bg} text-white`}
		>
			<div className="flex items-center gap-2">
				<span className="flex-shrink-0">{style.icon}</span>
				<span className="font-medium text-sm sm:text-base break-words flex-1">{message}</span>
				{onDismiss && (
					<button
						onClick={onDismiss}
						className="flex-shrink-0 p-1 hover:bg-white/20 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
						aria-label="Dismiss notification"
					>
						<XMarkIcon className="w-4 h-4" />
					</button>
				)}
			</div>
		</motion.div>
	);
}
