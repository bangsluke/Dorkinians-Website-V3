export default function SettingsLayout({ children }: { children: React.ReactNode }) {
	return (
		<div className='min-h-screen'>
			{/* Main Content */}
			<main className='pt-20 h-screen'>
				<div className='h-full'>{children}</div>
			</main>
		</div>
	);
}
