"use client";

import { XMarkIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastProps {
	message: string;
	type: ToastType;
	duration?: number; // milliseconds, 0 = no auto-dismiss
	onDismiss?: () => void;
	id?: string; // For managing multiple toasts
}

const toastStyles = {
	success: {
		bg: "bg-[var(--color-surface)] backdrop-blur-sm border border-[var(--color-border)]",
		text: "text-[var(--color-text-primary)]",
		icon: "✅",
	},
	error: {
		bg: "bg-red-500",
		text: "text-white",
		icon: "❌",
	},
	info: {
		bg: "bg-blue-500",
		text: "text-white",
		icon: "ℹ️",
	},
	warning: {
		bg: "bg-yellow-500",
		text: "text-white",
		icon: "⚠️",
	},
};

export default function Toast({ message, type, duration = 5000, onDismiss, id }: ToastProps) {
	const style = toastStyles[type];
	const [entered, setEntered] = useState(false);

	useEffect(() => {
		const idRaf = requestAnimationFrame(() => setEntered(true));
		return () => cancelAnimationFrame(idRaf);
	}, []);

	useEffect(() => {
		if (duration > 0 && onDismiss) {
			const timer = setTimeout(() => {
				onDismiss();
			}, duration);
			return () => clearTimeout(timer);
		}
	}, [duration, onDismiss]);

	return (
		<div
			key={id}
			className={`w-full max-w-[calc(100vw-1rem)] sm:max-w-md p-3 sm:p-4 rounded-md shadow-lg transition-all duration-200 ease-[cubic-bezier(0,0,0.2,1)] ${style.bg} ${style.text} ${
				entered ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-6 pointer-events-none"
			}`}
		>
			<div className="flex items-center gap-2">
				<span className="flex-shrink-0">{style.icon}</span>
				<span className="font-medium text-sm sm:text-base break-words flex-1">{message}</span>
				{onDismiss && (
					<button
						onClick={onDismiss}
						className={`flex-shrink-0 p-1 rounded transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${
							type === "success"
								? "hover:bg-[var(--color-surface-elevated)] focus-visible:ring-[var(--color-field-focus)]"
								: "hover:bg-white/20 focus-visible:ring-white"
						}`}
						aria-label="Dismiss notification"
					>
						<XMarkIcon className="w-4 h-4" />
					</button>
				)}
			</div>
		</div>
	);
}
