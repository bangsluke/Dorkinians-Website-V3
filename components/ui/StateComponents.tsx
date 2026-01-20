"use client";

import { useEffect } from "react";
import { ExclamationTriangleIcon, ArrowPathIcon, InboxIcon } from "@heroicons/react/24/outline";
import Button from "./Button";

export interface LoadingStateProps {
	message?: string;
	variant?: 'spinner' | 'skeleton';
	children?: React.ReactNode; // For custom skeleton content
}

export function LoadingState({ message = "Loading...", variant = 'spinner', children }: LoadingStateProps) {
	if (variant === 'skeleton' && children) {
		return <>{children}</>;
	}

	return (
		<div className="flex flex-col items-center justify-center py-12 px-4">
			{variant === 'spinner' && (
				<div className="inline-flex items-center space-x-2">
					<div className="animate-spin rounded-full h-6 w-6 border-b-2 border-dorkinians-yellow"></div>
					<span className="text-white/80 text-sm md:text-base">{message}</span>
				</div>
			)}
		</div>
	);
}

export interface ErrorStateProps {
	message?: string;
	error?: Error | string;
	onRetry?: () => void;
	retryLabel?: string;
	showToast?: boolean; // Whether to show toast notification
	toastMessage?: string; // Custom toast message
	onShowToast?: (message: string) => void; // Optional callback to show toast
	suggestions?: string[]; // Suggested similar questions or actions
	onSuggestionClick?: (suggestion: string) => void; // Callback when suggestion is clicked
}

export function ErrorState({ 
	message = "Something went wrong", 
	error, 
	onRetry, 
	retryLabel = "Try Again",
	showToast = true,
	toastMessage,
	onShowToast,
	suggestions = [],
	onSuggestionClick
}: ErrorStateProps) {
	// Show toast notification when error occurs
	useEffect(() => {
		if (showToast && onShowToast) {
			const errorText = toastMessage || message || "An error occurred";
			onShowToast(errorText);
		}
	}, [showToast, toastMessage, message, onShowToast]);

	const errorMessage = error instanceof Error ? error.message : error || message;

	return (
		<div className="flex flex-col items-center justify-center py-12 px-4 text-center">
			<div className="mb-4">
				<ExclamationTriangleIcon className="w-12 h-12 md:w-16 md:h-16 text-red-400 mx-auto" />
			</div>
			<h3 className="text-white font-semibold text-lg md:text-xl mb-2">{message}</h3>
			{errorMessage && errorMessage !== message && (
				<p className="text-white/70 text-sm md:text-base mb-6 max-w-md">{errorMessage}</p>
			)}
			
			{/* Similar Questions Suggestions */}
			{suggestions.length > 0 && onSuggestionClick && (
				<div className="mb-6 w-full max-w-md">
					<p className="text-white/80 text-sm mb-3">Try asking one of these instead:</p>
					<div className="space-y-2">
						{suggestions.map((suggestion, index) => (
							<button
								key={index}
								onClick={() => onSuggestionClick(suggestion)}
								className="w-full text-left px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-white text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dorkinians-yellow focus-visible:ring-offset-2 focus-visible:ring-offset-transparent">
								{suggestion}
							</button>
						))}
					</div>
				</div>
			)}
			
			{onRetry && (
				<Button
					variant="primary"
					onClick={onRetry}
					iconLeft={<ArrowPathIcon className="w-5 h-5" />}
				>
					{retryLabel}
				</Button>
			)}
		</div>
	);
}

export interface EmptyStateProps {
	title?: string;
	message?: string;
	icon?: React.ReactNode;
	action?: {
		label: string;
		onClick: () => void;
	};
}

export function EmptyState({ 
	title = "No data available", 
	message,
	icon,
	action
}: EmptyStateProps) {
	return (
		<div className="flex flex-col items-center justify-center py-12 px-4 text-center">
			<div className="mb-4">
				{icon || <InboxIcon className="w-12 h-12 md:w-16 md:h-16 text-white/40 mx-auto" />}
			</div>
			<h3 className="text-white font-semibold text-lg md:text-xl mb-2">{title}</h3>
			{message && (
				<p className="text-white/70 text-sm md:text-base mb-6 max-w-md">{message}</p>
			)}
			{action && (
				<Button
					variant="primary"
					onClick={action.onClick}
				>
					{action.label}
				</Button>
			)}
		</div>
	);
}
