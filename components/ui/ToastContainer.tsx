"use client";

import Toast, { ToastType } from "./Toast";
import { useToastStore } from "@/lib/stores/toast";

export interface ToastItem {
	id: string;
	message: string;
	type: ToastType;
	duration?: number;
}

interface ToastContainerProps {
	/** Supply toasts explicitly (tests, stories). Defaults to the global store. */
	toasts?: ToastItem[];
	onDismiss?: (id: string) => void;
}

export default function ToastContainer({ toasts, onDismiss }: ToastContainerProps = {}) {
	const storeToasts = useToastStore((state) => state.toasts);
	const storeDismiss = useToastStore((state) => state.dismiss);

	const items = toasts ?? storeToasts;
	const dismiss = onDismiss ?? storeDismiss;

	return (
		<div
			data-testid="toast-container"
			aria-label="Notifications"
			className="fixed top-4 right-2 sm:right-4 z-50 pointer-events-none"
		>
			<div className="flex flex-col gap-2 pointer-events-auto">
				{items.map((toast) => (
					<Toast
						key={toast.id}
						id={toast.id}
						message={toast.message}
						type={toast.type}
						duration={toast.duration}
						onDismiss={() => dismiss(toast.id)}
					/>
				))}
			</div>
		</div>
	);
}
