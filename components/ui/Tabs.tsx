"use client";

import { useState, useEffect, ReactNode } from "react";

interface TabsProps {
	tabs: { id: string; label: string; content: ReactNode }[];
	defaultTab?: string;
	storageKey: string;
}

export default function Tabs({ tabs, defaultTab, storageKey }: TabsProps) {
	// Initialize with localStorage value or default
	const [activeTab, setActiveTab] = useState<string>(() => {
		if (typeof window !== "undefined") {
			const saved = localStorage.getItem(storageKey);
			if (saved && tabs.some((tab) => tab.id === saved)) {
				return saved;
			}
		}
		return defaultTab || tabs[0]?.id || "";
	});

	// Save to localStorage when tab changes
	useEffect(() => {
		if (typeof window !== "undefined") {
			localStorage.setItem(storageKey, activeTab);
		}
	}, [activeTab, storageKey]);

	const activeTabContent = tabs.find((tab) => tab.id === activeTab)?.content;

	return (
		<div className='h-full flex flex-col min-h-0'>
			{/* Tab Headers */}
			<div className='flex-shrink-0 border-b border-white/20 mb-4'>
				<div className='flex'>
					{tabs.map((tab) => (
						<button
							key={tab.id}
							onClick={() => setActiveTab(tab.id)}
							className={`flex-1 text-center px-4 py-2 text-sm md:text-base font-medium transition-colors ${
								activeTab === tab.id
									? "text-dorkinians-yellow-text border-b-2 border-dorkinians-yellow-text"
									: "text-white/70 hover:text-white hover:bg-white/5"
							}`}>
							{tab.label}
						</button>
					))}
				</div>
			</div>

			{/* Tab Content */}
			<div 
				className='flex-1 overflow-y-auto min-h-0'
				style={{ WebkitOverflowScrolling: 'touch' }}>
				{activeTabContent}
			</div>
		</div>
	);
}

