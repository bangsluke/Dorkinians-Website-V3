"use client";

import SidebarNavigation from "@/components/SidebarNavigation";
import Header from "@/components/Header";
import FooterNavigation from "@/components/FooterNavigation";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
	const handleSettingsClick = () => {
		// This is already on the settings page, so do nothing or navigate back
		if (typeof window !== "undefined") {
			const previousMainPage = localStorage.getItem("dorkinians-previous-main-page");
			if (previousMainPage && previousMainPage !== "settings") {
				localStorage.setItem("dorkinians-current-main-page", previousMainPage);
			} else {
				localStorage.setItem("dorkinians-current-main-page", "home");
			}
			window.location.href = "/";
		}
	};

	const handleFilterClick = () => {
		// Not applicable on settings page
	};

	const handleMenuClick = () => {
		// Not applicable on settings page
	};

	return (
		<div className='min-h-screen'>
			{/* Desktop Sidebar Navigation */}
			<SidebarNavigation 
				onSettingsClick={handleSettingsClick} 
				onFilterClick={handleFilterClick} 
				showFilterIcon={false}
				onMenuClick={handleMenuClick}
				showMenuIcon={false}
			/>

			{/* Mobile Header */}
			<Header 
				onSettingsClick={handleSettingsClick} 
				isSettingsPage={true}
				onFilterClick={handleFilterClick} 
				showFilterIcon={false}
				onMenuClick={handleMenuClick}
				showMenuIcon={false}
			/>

			{/* Main Content */}
			<main className='main-content-container settings-page'>
				<div className='frosted-container settings-frosted-container'>
					<div 
						className='h-full overflow-y-auto'
						style={{ 
							WebkitOverflowScrolling: 'touch',
							touchAction: 'pan-y'
						}}>
						{children}
					</div>
				</div>
			</main>

			{/* Mobile Footer Navigation - Hidden on settings page */}
		</div>
	);
}
