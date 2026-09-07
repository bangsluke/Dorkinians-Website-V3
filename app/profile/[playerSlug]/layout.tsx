"use client";

import SidebarNavigation from "@/components/layout/SidebarNavigation";
import Header from "@/components/layout/Header";
import FooterNavigation from "@/components/layout/FooterNavigation";
import { useAppRouter } from "@/lib/hooks/useAppRouter";

export default function PlayerProfileLayout({ children }: { children: React.ReactNode }) {
	const router = useAppRouter();

	const handleSettingsClick = () => {
		router.push("/settings");
	};

	return (
		<div className='min-h-screen'>
			<SidebarNavigation
				onSettingsClick={handleSettingsClick}
				isSettingsPage={false}
				onFilterClick={() => {}}
				showFilterIcon={false}
				onMenuClick={() => {}}
				showMenuIcon={false}
			/>

			<Header
				onSettingsClick={handleSettingsClick}
				isSettingsPage={false}
				onFilterClick={() => {}}
				showFilterIcon={false}
				onMenuClick={() => {}}
				showMenuIcon={false}
			/>

			<main className='main-content-container'>
				<div className='frosted-container'>
					<div
						className='h-full overflow-y-auto'
						style={{
							WebkitOverflowScrolling: "touch",
							touchAction: "pan-y",
						}}
					>
						{children}
					</div>
				</div>
			</main>

			<FooterNavigation />
		</div>
	);
}
