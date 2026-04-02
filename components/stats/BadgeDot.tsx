"use client";

export function tierSurfaceClass(tier: string): string {
	switch (tier) {
		case "diamond":
			return "bg-gradient-to-br from-cyan-200 to-sky-500";
		case "gold":
			return "bg-gradient-to-br from-amber-300 to-yellow-600";
		case "silver":
			return "bg-gradient-to-br from-slate-300 to-slate-500";
		case "bronze":
			return "bg-gradient-to-br from-amber-700 to-amber-900";
		default:
			return "bg-white/30";
	}
}

export default function BadgeDot({
	tier,
	title,
	size = "md",
	className = "",
	innerLabel,
	"aria-label": ariaLabelProp,
}: {
	tier: string;
	title: string;
	size?: "sm" | "md";
	className?: string;
	innerLabel?: string;
	"aria-label"?: string;
}) {
	const dim = size === "sm" ? "h-6 w-6 min-h-[24px] min-w-[24px]" : "h-9 w-9 min-h-[36px] min-w-[36px]";
	const textSize = size === "sm" ? "text-[8px]" : "text-[9px]";
	const a11y = ariaLabelProp ?? title;
	return (
		<span
			title={title || undefined}
			role='img'
			aria-label={a11y}
			className={`inline-flex items-center justify-center rounded-full ring-2 ring-white/40 shadow-sm ${dim} ${tierSurfaceClass(tier)} ${className}`}>
			{innerLabel ? (
				<span className={`${textSize} font-bold leading-none text-black/90 tabular-nums px-0.5 text-center max-w-full truncate`}>
					{innerLabel}
				</span>
			) : null}
		</span>
	);
}
