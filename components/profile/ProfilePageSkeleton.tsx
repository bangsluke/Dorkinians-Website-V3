"use client";

import Skeleton from "react-loading-skeleton";
import { featureFlags } from "@/config/config";
import { isSeasonWrappedPromoMonth } from "@/lib/wrapped/seasonWrappedPromo";

export default function ProfilePageSkeleton() {
	const showSeasonWrappedPromoBlock = featureFlags.seasonWrapped && isSeasonWrappedPromoMonth(new Date());

	return (
		<>
			{showSeasonWrappedPromoBlock ? (
				<div
					className='rounded-xl border-2 border-[#E8C547]/60 bg-gradient-to-br from-[#E8C547]/25 via-[#E8C547]/15 to-[#b8941f]/12 p-4 md:p-5 shadow-md ring-1 ring-inset ring-[#E8C547]/25'
					data-testid='player-profile-season-wrapped-loading'>
					<h3 className='text-dorkinians-yellow font-semibold text-base md:text-lg'>Season Wrapped</h3>
					<p className='mt-2 text-white/75 text-sm'>Loading season options…</p>
				</div>
			) : null}
			<div className='rounded-lg bg-white/10 backdrop-blur-sm p-4 mt-4 space-y-3'>
				<Skeleton height={20} width='30%' />
				<div className='grid grid-cols-2 md:grid-cols-4 gap-2'>
					{Array.from({ length: 8 }).map((_, i) => (
						<Skeleton key={i} height={64} className='rounded-md' />
					))}
				</div>
			</div>
			<div className='rounded-lg bg-white/10 backdrop-blur-sm p-4 mt-4'>
				<Skeleton height={18} width='38%' className='mb-1' />
				<Skeleton height={13} width='55%' className='mb-3' />
				<div className='rounded-xl border border-white/10 bg-black/15 p-3 mb-3'>
					<div className='flex items-center justify-between mb-2'>
						<Skeleton height={16} width={110} />
						<Skeleton height={16} width={44} />
					</div>
					<Skeleton height={6} className='rounded-full w-full' />
				</div>
				<div className='rounded-xl border border-white/10 bg-black/15 p-3 mb-3'>
					<Skeleton height={14} width={130} className='mb-2' />
					<div className='space-y-2'>
						<div className='flex items-center justify-between gap-2'>
							<div className='flex items-center gap-2'>
								<Skeleton circle height={40} width={40} />
								<Skeleton height={10} width={120} />
							</div>
							<Skeleton height={10} width={50} />
						</div>
					</div>
				</div>
				<div className='rounded-xl border border-white/10 bg-black/15 p-3'>
					<Skeleton height={16} width='42%' className='mb-3' />
					<div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3'>
						{Array.from({ length: 8 }).map((_, i) => (
							<div key={i} className='flex flex-col items-center text-center gap-1.5 p-2 rounded-lg'>
								<Skeleton circle height={36} width={36} />
								<Skeleton height={10} width='75%' />
								<Skeleton height={10} width='45%' />
							</div>
						))}
					</div>
				</div>
			</div>
		</>
	);
}
