"use client";

import { useEffect, useRef, useState } from "react";

interface FullTimeLeagueTableProps {
	teamKey: string;
	title: string;
	code: string;
}

function measureDocument(doc: Document): number {
	const bodyHeight = doc.body?.scrollHeight ?? 0;
	const rootHeight = doc.documentElement?.scrollHeight ?? 0;
	return Math.ceil(Math.max(bodyHeight, rootHeight));
}

export default function FullTimeLeagueTable({ teamKey, title, code }: FullTimeLeagueTableProps) {
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const [height, setHeight] = useState(96);
	const src = `/embeds/fulltime-table.html?code=${encodeURIComponent(code)}`;

	useEffect(() => {
		const iframe = iframeRef.current;
		if (!iframe) return;

		let observer: ResizeObserver | null = null;
		let timer = 0;

		const applyHeight = () => {
			const doc = iframe.contentDocument;
			if (!doc?.body) return;
			const next = measureDocument(doc);
			if (next > 0) setHeight(next);
			if (!observer && typeof ResizeObserver !== "undefined") {
				observer = new ResizeObserver(() => {
					const measured = measureDocument(doc);
					if (measured > 0) setHeight(measured);
				});
				observer.observe(doc.body);
			}
		};

		const onLoad = () => {
			applyHeight();
			let attempts = 0;
			window.clearInterval(timer);
			timer = window.setInterval(() => {
				applyHeight();
				attempts += 1;
				const hasTable = Boolean(iframe.contentDocument?.querySelector("table"));
				if (hasTable || attempts > 24) window.clearInterval(timer);
			}, 250);
		};

		iframe.addEventListener("load", onLoad);
		return () => {
			iframe.removeEventListener("load", onLoad);
			window.clearInterval(timer);
			observer?.disconnect();
		};
	}, [src]);

	return (
		<iframe
			ref={iframeRef}
			title={`${title} league table`}
			src={src}
			style={{ height }}
			className='w-full rounded-lg border-0 bg-white'
			data-testid={`fulltime-league-table-${teamKey}`}
		/>
	);
}
