"use client";

import { useCallback } from "react";
import type { ToastItem } from "@/components/ui/ToastContainer";
import { useToastStore } from "@/lib/stores/toast";

/**
 * Raise toasts from anywhere. Backed by a global store, so callers do not need to be
 * inside the subtree that renders ToastContainer.
 */
export function useToast() {
	const toasts = useToastStore((state) => state.toasts);
	const show = useToastStore((state) => state.show);
	const dismissToast = useToastStore((state) => state.dismiss);

	const showToast = useCallback(
		(message: string, type: ToastItem["type"], duration?: number) => show(message, type, duration),
		[show],
	);

	const showSuccess = useCallback((message: string, duration?: number) => show(message, "success", duration), [show]);
	const showError = useCallback((message: string, duration = 5000) => show(message, "error", duration), [show]);
	const showInfo = useCallback((message: string, duration?: number) => show(message, "info", duration), [show]);
	const showWarning = useCallback((message: string, duration?: number) => show(message, "warning", duration), [show]);

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
