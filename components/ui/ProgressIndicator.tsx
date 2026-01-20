"use client";

import { motion } from "framer-motion";

interface ProgressIndicatorProps {
	/** Whether the progress indicator should be visible */
	isVisible: boolean;
	/** Optional progress percentage (0-100). If not provided, shows indeterminate progress */
	progress?: number;
	/** Optional message to display */
	message?: string;
	/** Size variant */
	size?: "sm" | "md" | "lg";
	/** Custom className */
	className?: string;
}

export default function ProgressIndicator({
	isVisible,
	progress,
	message,
	size = "md",
	className = "",
}: ProgressIndicatorProps) {
	if (!isVisible) return null;

	const sizeClasses = {
		sm: "h-1",
		md: "h-2",
		lg: "h-3",
	};

	const isIndeterminate = progress === undefined;

	return (
		<div className={`flex flex-col gap-2 ${className}`}>
			{message && (
				<p className="text-sm text-[var(--color-text-primary)]/80">{message}</p>
			)}
			<div className={`w-full bg-[var(--color-surface)] rounded-full overflow-hidden ${sizeClasses[size]}`}>
				{isIndeterminate ? (
					<motion.div
						className={`bg-dorkinians-yellow ${sizeClasses[size]} rounded-full`}
						initial={{ x: "-100%" }}
						animate={{ x: "100%" }}
						transition={{
							repeat: Infinity,
							duration: 1.5,
							ease: "easeInOut",
						}}
						style={{ width: "40%" }}
					/>
				) : (
					<motion.div
						className={`bg-dorkinians-yellow ${sizeClasses[size]} rounded-full`}
						initial={{ width: 0 }}
						animate={{ width: `${Math.min(100, Math.max(0, progress || 0))}%` }}
						transition={{ duration: 0.3, ease: "easeOut" }}
					/>
				)}
			</div>
		</div>
	);
}
