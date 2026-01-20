"use client";

import { useState, useCallback } from "react";
import { ToastItem } from "@/components/ui/ToastContainer";

let toastIdCounter = 0;

export function useToast() {
	const [toasts, setToasts] = useState<ToastItem[]>([]);

	const showToast = useCallback((message: string, type: ToastItem['type'], duration?: number) => {
		const id = `toast-${++toastIdCounter}`;
		const newToast: ToastItem = {
			id,
			message,
			type,
			duration,
		};

		setToasts((prev) => [...prev, newToast]);
		return id;
	}, []);

	const dismissToast = useCallback((id: string) => {
		setToasts((prev) => prev.filter((toast) => toast.id !== id));
	}, []);

	const showSuccess = useCallback((message: string, duration?: number) => {
		return showToast(message, 'success', duration);
	}, [showToast]);

	const showError = useCallback((message: string, duration = 5000) => {
		return showToast(message, 'error', duration);
	}, [showToast]);

	const showInfo = useCallback((message: string, duration?: number) => {
		return showToast(message, 'info', duration);
	}, [showToast]);

	const showWarning = useCallback((message: string, duration?: number) => {
		return showToast(message, 'warning', duration);
	}, [showToast]);

	return {
		toasts,
		showToast,
		dismissToast,
		showSuccess,
		showError,
		showInfo,
		showWarning,
	};
}
