"use client";

import { usefulLinks, generateLeagueLinks } from "@/config/config";
import { motion } from "framer-motion";

export default function UsefulLinks() {
	// Generate dynamic league links and combine with static links
	const leagueLinks = generateLeagueLinks();
	const allLinks = [...usefulLinks, ...leagueLinks];

	// Group links by category
	const groupedLinks = allLinks.reduce(
		(acc, link) => {
			if (!acc[link.category]) {
				acc[link.category] = [];
			}
			acc[link.category].push(link);
			return acc;
		},
		{} as Record<string, typeof allLinks>,
	);

	const categoryLabels = {
		official: "Official Club Links",
		league: "League Websites",
		social: "Social Media",
		other: "Other Resources",
	};

	// Define category order
	const categoryOrder = ["official", "league", "social", "other"];

	return (
		<div className='p-4 md:p-6 h-full flex flex-col'>
			<h2 className='text-xl md:text-2xl font-bold text-dorkinians-yellow mb-4 md:mb-6 text-center'>Useful Links</h2>

			<div className='flex-1 overflow-y-auto pr-2 pb-4 space-y-6 md:space-y-8'>
				{categoryOrder.map((category, categoryIndex) => {
					const links = groupedLinks[category];
					if (!links || links.length === 0) return null;

					return (
						<motion.div
							key={category}
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ delay: categoryIndex * 0.1 }}
							className='space-y-4'>
							<h3 className='text-base md:text-lg font-semibold text-yellow-300 border-b border-yellow-400/30 pb-2'>
								{categoryLabels[category as keyof typeof categoryLabels]}
							</h3>

							<div className='grid gap-2 md:gap-3 md:grid-cols-2 lg:grid-cols-1'>
								{links.map((link, linkIndex) => (
									<motion.a
										key={link.id}
										href={link.url}
										target='_blank'
										rel='noopener noreferrer'
										initial={{ opacity: 0, x: -20 }}
										animate={{ opacity: 1, x: 0 }}
										transition={{ delay: categoryIndex * 0.1 + linkIndex * 0.05 }}
										className='block p-3 md:p-4 rounded-lg hover:bg-yellow-400/10 transition-colors group'
										style={{
											background: "linear-gradient(180deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.05))",
										}}
										whileHover={{ scale: 1.02 }}
										whileTap={{ scale: 0.98 }}>
										<div className='flex items-start justify-between'>
											<div className='flex-1'>
												<h4 className='text-sm md:text-base font-medium text-white group-hover:text-yellow-300 transition-colors'>{link.title}</h4>
												<p className='text-xs md:text-sm text-yellow-100 mt-1'>{link.description}</p>
											</div>
											<svg
												className='w-3 h-3 md:w-4 md:h-4 text-yellow-400 ml-2 flex-shrink-0 group-hover:translate-x-1 transition-transform'
												fill='none'
												stroke='currentColor'
												viewBox='0 0 24 24'>
												<path
													strokeLinecap='round'
													strokeLinejoin='round'
													strokeWidth={2}
													d='M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14'
												/>
											</svg>
										</div>
									</motion.a>
								))}
							</div>
						</motion.div>
					);
				})}
			</div>
		</div>
	);
}
