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

/**
 * Every type shares the same translucent surface; the left accent carries the semantics.
 * Keeps toasts visually consistent with the rest of the dark UI rather than shouting
 * with a solid saturated background.
 */
const TOAST_SURFACE = "bg-[var(--color-surface)] backdrop-blur-sm border border-[var(--color-border)]";

const toastStyles = {
	success: {
		accent: "border-l-2 border-l-[var(--color-success)]",
		icon: "✅",
	},
	error: {
		accent: "border-l-2 border-l-[var(--color-error)]",
		icon: "❌",
	},
	info: {
		accent: "border-l-2 border-l-[var(--color-info)]",
		icon: "ℹ️",
	},
	warning: {
		accent: "border-l-2 border-l-[var(--color-warning)]",
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
			className={`w-full max-w-[calc(100vw-1rem)] sm:max-w-md p-3 sm:p-4 rounded-md shadow-lg transition-all duration-200 ease-[cubic-bezier(0,0,0.2,1)] text-[var(--color-text-primary)] ${TOAST_SURFACE} ${style.accent} ${
				entered ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-6 pointer-events-none"
			}`}
			role={type === "error" ? "alert" : "status"}
		>
			<div className="flex items-center gap-2">
				<span className="flex-shrink-0">{style.icon}</span>
				<span className="font-medium text-sm sm:text-base break-words flex-1">{message}</span>
				{onDismiss && (
					<button
						onClick={onDismiss}
						className="flex-shrink-0 p-1 rounded transition-colors hover:bg-[var(--color-surface-elevated)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent focus-visible:ring-[var(--color-field-focus)]"
						aria-label="Dismiss notification"
					>
						<XMarkIcon className="w-4 h-4" />
					</button>
				)}
			</div>
		</div>
	);
}
