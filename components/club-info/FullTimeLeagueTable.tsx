interface FullTimeLeagueTableProps {
	teamKey: string;
	title: string;
	code: string;
}

export default function FullTimeLeagueTable({ teamKey, title, code }: FullTimeLeagueTableProps) {
	const src = `/embeds/fulltime-table.html?code=${encodeURIComponent(code)}`;

	return (
		<iframe
			title={`${title} league table`}
			src={src}
			className='h-[420px] w-full rounded-lg border-0 bg-white'
			data-testid={`fulltime-league-table-${teamKey}`}
		/>
	);
}
