"use client";

import { ReactNode, forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

export interface ButtonProps {
	variant?: "primary" | "secondary" | "tertiary" | "ghost" | "icon";
	size?: "sm" | "md" | "lg";
	disabled?: boolean;
	loading?: boolean;
	fullWidth?: boolean;
	icon?: ReactNode;
	iconLeft?: ReactNode;
	iconRight?: ReactNode;
	as?: "button" | "a";
	href?: string;
	children?: ReactNode;
	className?: string;
	onClick?: () => void;
	type?: "button" | "submit" | "reset";
	"aria-label"?: string;
	title?: string;
}

const Button = forwardRef<HTMLButtonElement | HTMLAnchorElement, ButtonProps>(
	(
		{
			variant = "primary",
			size = "md",
			disabled = false,
			loading = false,
			fullWidth = false,
			icon,
			iconLeft,
			iconRight,
			as = "button",
			href,
			children,
			className,
			onClick,
			type = "button",
			"aria-label": ariaLabel,
			title,
			...props
		},
		ref
	) => {
		// Base classes
		const baseClasses = "inline-flex items-center justify-center font-medium transition-all duration-200 ease-out cursor-pointer border-none outline-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-field-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-transparent";

		// Variant classes
		const variantClasses = {
			primary: cn(
				"bg-gradient-to-br from-dorkinians-green to-dorkinians-green-dark text-white rounded-2xl",
				"hover:from-dorkinians-green-dark hover:to-dorkinians-green-darker hover:translate-y-[-1px] hover:shadow-[0_4px_12px_rgba(28,136,65,0.3)]",
				"active:translate-y-0 active:shadow-none",
				"disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
			),
			secondary: cn(
				"bg-gradient-to-br from-dorkinians-yellow to-dorkinians-yellow-dark text-[#0f0f0f] rounded-2xl",
				"hover:from-dorkinians-yellow-dark hover:to-dorkinians-yellow-darker",
				"disabled:opacity-50 disabled:cursor-not-allowed"
			),
			tertiary: cn(
				"bg-white/10 text-white/80 rounded-2xl",
				"hover:bg-white/20",
				"disabled:opacity-50 disabled:cursor-not-allowed"
			),
			ghost: cn(
				"bg-transparent rounded-md",
				"disabled:opacity-50 disabled:cursor-not-allowed"
			),
			icon: cn(
				"bg-transparent rounded-full p-2",
				"hover:bg-white/20",
				"active:scale-90",
				"disabled:opacity-50 disabled:cursor-not-allowed"
			),
		};

		// Size classes - adjust padding for primary/secondary variants
		const sizeClasses = {
			sm: variant === "icon" ? "p-1.5" : variant === "ghost" ? "px-2 py-1 text-xs" : variant === "primary" || variant === "secondary" ? "px-4 py-2 text-sm" : "px-3 py-1.5 text-sm",
			md: variant === "icon" ? "p-2" : variant === "ghost" ? "px-3 py-1.5 text-sm" : variant === "primary" || variant === "secondary" ? "px-6 py-3 text-base" : "px-4 py-2 text-base",
			lg: variant === "icon" ? "p-2.5" : variant === "ghost" ? "px-4 py-2 text-base" : variant === "primary" || variant === "secondary" ? "px-8 py-4 text-lg" : "px-6 py-3 text-base",
		};

		// Font weight classes
		const fontWeightClasses = {
			primary: "font-semibold",
			secondary: "font-semibold",
			tertiary: "font-medium",
			ghost: "font-normal",
			icon: "font-normal",
		};

		const classes = cn(
			baseClasses,
			variantClasses[variant],
			sizeClasses[size],
			fontWeightClasses[variant],
			fullWidth && "w-full",
			className
		);

		// Loading spinner
		const loadingSpinner = (
			<svg
				className="animate-spin h-4 w-4"
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24">
				<circle
					className="opacity-25"
					cx="12"
					cy="12"
					r="10"
					stroke="currentColor"
					strokeWidth="4"></circle>
				<path
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={2}
					d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
					fill="currentColor"
				/>
			</svg>
		);

		// Content
		const content = (
			<>
				{loading ? (
					loadingSpinner
				) : (
					<>
						{iconLeft && <span className="mr-2">{iconLeft}</span>}
						{icon && !iconLeft && !iconRight && icon}
						{children && <span>{children}</span>}
						{iconRight && <span className="ml-2">{iconRight}</span>}
					</>
				)}
			</>
		);

		// Render as anchor if href is provided or as="a"
		if (as === "a" || href) {
			return (
				<a
					ref={ref as React.Ref<HTMLAnchorElement>}
					href={href}
					className={classes}
					onClick={disabled || loading ? (e) => e.preventDefault() : onClick}
					aria-label={ariaLabel}
					aria-disabled={disabled || loading}
					title={title}
					{...props}>
					{content}
				</a>
			);
		}

		return (
			<button
				ref={ref as React.Ref<HTMLButtonElement>}
				type={type}
				disabled={disabled || loading}
				className={classes}
				onClick={onClick}
				aria-label={ariaLabel}
				title={title}
				{...props}>
				{content}
			</button>
		);
	}
);

Button.displayName = "Button";

export default Button;
