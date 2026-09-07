"use client";

interface FullscreenModalContentProps {
	children: React.ReactNode;
	backgroundColor?: string;
	className?: string;
}

export default function FullscreenModalContent({
	children,
	backgroundColor = "#0f0f0f",
	className = "",
}: FullscreenModalContentProps) {
	return (
		<div className={`h-full flex flex-col ${className}`.trim()} style={{ backgroundColor }}>
			<div className="flex flex-col h-full w-full md:max-w-6xl md:mx-auto md:px-6 lg:px-10 xl:px-12">
				{children}
			</div>
		</div>
	);
}
