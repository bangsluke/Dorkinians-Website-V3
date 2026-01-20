"use client";

import { AnimatePresence } from "framer-motion";
import Toast, { ToastType } from "./Toast";

export interface ToastItem {
	id: string;
	message: string;
	type: ToastType;
	duration?: number;
}

interface ToastContainerProps {
	toasts: ToastItem[];
	onDismiss: (id: string) => void;
}

export default function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
	return (
		<div className="fixed top-4 right-2 sm:right-4 z-50 pointer-events-none">
			<div className="flex flex-col gap-2 pointer-events-auto">
				<AnimatePresence mode="popLayout">
					{toasts.map((toast) => (
						<Toast
							key={toast.id}
							id={toast.id}
							message={toast.message}
							type={toast.type}
							duration={toast.duration}
							onDismiss={() => onDismiss(toast.id)}
						/>
					))}
				</AnimatePresence>
			</div>
		</div>
	);
}
