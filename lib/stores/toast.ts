import { create } from "zustand";
import type { ToastItem } from "@/components/ui/ToastContainer";

let toastIdCounter = 0;

type ToastState = {
	toasts: ToastItem[];
	show: (message: string, type: ToastItem["type"], duration?: number) => string;
	dismiss: (id: string) => void;
	clear: () => void;
};

/**
 * Global toast queue. Toasts are rendered by the single ToastContainer mounted in the
 * root layout, so any component can raise one regardless of where it sits in the tree.
 */
export const useToastStore = create<ToastState>((set) => ({
	toasts: [],
	show: (message, type, duration) => {
		const id = `toast-${++toastIdCounter}`;
		set((state) => ({ toasts: [...state.toasts, { id, message, type, duration }] }));
		return id;
	},
	dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
	clear: () => set({ toasts: [] }),
}));
