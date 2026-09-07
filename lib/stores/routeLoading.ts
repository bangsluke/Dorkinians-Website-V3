import { create } from "zustand";

type RouteLoadingState = {
	isLoading: boolean;
	start: () => void;
	complete: () => void;
};

export const useRouteLoadingStore = create<RouteLoadingState>((set) => ({
	isLoading: false,
	start: () => set({ isLoading: true }),
	complete: () => set({ isLoading: false }),
}));
