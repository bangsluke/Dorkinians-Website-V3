"use client";

import { forwardRef, InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
	label?: string;
	error?: string;
	iconLeft?: React.ReactNode;
	iconRight?: React.ReactNode;
	size?: "sm" | "md" | "lg";
	fullWidth?: boolean;
}

export interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "size"> {
	label?: string;
	error?: string;
	size?: "sm" | "md" | "lg";
	fullWidth?: boolean;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
	(
		{
			label,
			error,
			iconLeft,
			iconRight,
			size = "md",
			fullWidth = true,
			className,
			id,
			required,
			disabled,
			...props
		},
		ref
	) => {
		const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
		const errorId = error ? `${inputId}-error` : undefined;

		const sizeClasses = {
			sm: "px-3 py-2 text-sm",
			md: "px-4 py-3 text-base",
			lg: "px-4 py-3 text-lg",
		};

		const baseClasses = cn(
			"w-full rounded-2xl transition-all duration-200 ease-out",
			"bg-[var(--color-field-bg)]",
			"text-[var(--color-text-primary)]",
			"border border-[var(--color-field-border)]",
			"placeholder-[var(--color-text-tertiary)]",
			"focus:outline-none",
			"focus:border-[var(--color-field-focus)]",
			"focus:ring-2 focus:ring-[var(--color-field-focus-ring)]",
			"disabled:opacity-50 disabled:cursor-not-allowed",
			sizeClasses[size],
			iconLeft && "pl-10",
			iconRight && "pr-10",
			fullWidth && "w-full",
			error && "border-[var(--color-error)]",
			error && "focus:border-[var(--color-error)]",
			error && "focus:ring-[var(--color-error-bg)]",
			className
		);

		return (
			<div className={cn("input-wrapper", fullWidth && "w-full")}>
				{label && (
					<label htmlFor={inputId} className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
						{label}
						{required && <span className="text-[var(--color-error)] ml-1" aria-label="required">*</span>}
					</label>
				)}
				<div className="relative">
					{iconLeft && (
						<div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--color-text-secondary)]">
							{iconLeft}
						</div>
					)}
					<input
						ref={ref}
						id={inputId}
						className={baseClasses}
						disabled={disabled}
						required={required}
						aria-invalid={error ? "true" : undefined}
						aria-describedby={errorId}
						{...props}
					/>
					{iconRight && (
						<div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[var(--color-text-secondary)]">
							{iconRight}
						</div>
					)}
				</div>
				{error && (
					<div id={errorId} className="mt-1 text-sm text-[var(--color-error)]" role="alert">
						{error}
					</div>
				)}
			</div>
		);
	}
);

Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
	(
		{
			label,
			error,
			size = "md",
			fullWidth = true,
			className,
			id,
			required,
			disabled,
			...props
		},
		ref
	) => {
		const textareaId = id || `textarea-${Math.random().toString(36).substr(2, 9)}`;
		const errorId = error ? `${textareaId}-error` : undefined;

		const sizeClasses = {
			sm: "px-3 py-2 text-sm",
			md: "px-4 py-3 text-base",
			lg: "px-4 py-3 text-lg",
		};

		const baseClasses = cn(
			"w-full rounded-2xl transition-all duration-200 ease-out resize-none",
			"bg-[var(--color-field-bg)]",
			"text-[var(--color-text-primary)]",
			"border border-[var(--color-field-border)]",
			"placeholder-[var(--color-text-tertiary)]",
			"focus:outline-none",
			"focus:border-[var(--color-field-focus)]",
			"focus:ring-2 focus:ring-[var(--color-field-focus-ring)]",
			"disabled:opacity-50 disabled:cursor-not-allowed",
			sizeClasses[size],
			fullWidth && "w-full",
			error && "border-[var(--color-error)]",
			error && "focus:border-[var(--color-error)]",
			error && "focus:ring-[var(--color-error-bg)]",
			className
		);

		return (
			<div className={cn("textarea-wrapper", fullWidth && "w-full")}>
				{label && (
					<label htmlFor={textareaId} className="block text-sm font-medium text-[var(--color-text-primary)] mb-1">
						{label}
						{required && <span className="text-[var(--color-error)] ml-1" aria-label="required">*</span>}
					</label>
				)}
				<textarea
					ref={ref}
					id={textareaId}
					className={baseClasses}
					disabled={disabled}
					required={required}
					aria-invalid={error ? "true" : undefined}
					aria-describedby={errorId}
					{...props}
				/>
				{error && (
					<div id={errorId} className="mt-1 text-sm text-[var(--color-error)]" role="alert">
						{error}
					</div>
				)}
			</div>
		);
	}
);

Textarea.displayName = "Textarea";

export default Input;
