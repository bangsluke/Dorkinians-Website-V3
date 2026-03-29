import type { MetadataRoute } from "next";
import { isDevelopBranchDeploy } from "@/lib/utils/isDevelopBranchDeploy";

export default function manifest(): MetadataRoute.Manifest {
	const develop = isDevelopBranchDeploy();

	return {
		name: develop ? "Dorkinians FC Stats (Develop)" : "Dorkinians FC Stats",
		short_name: develop ? "Dorkinians Dev" : "Dorkinians Stats",
		description: "Dorkinians FC Statistics Website",
		start_url: "/",
		display: "standalone",
		background_color: "#0f0f0f",
		theme_color: "#F9ED32",
		orientation: "portrait-primary",
		scope: "/",
		lang: "en-GB",
		categories: ["sports", "utilities", "stats", "football"],
		icons: [
			{ src: "/icons/icon-72x72.png", sizes: "72x72", type: "image/png", purpose: "any" },
			{ src: "/icons/icon-96x96.png", sizes: "96x96", type: "image/png", purpose: "any" },
			{ src: "/icons/icon-128x128.png", sizes: "128x128", type: "image/png", purpose: "any" },
			{ src: "/icons/icon-144x144.png", sizes: "144x144", type: "image/png", purpose: "any" },
			{ src: "/icons/icon-152x152.png", sizes: "152x152", type: "image/png", purpose: "any" },
			{
				src: "/icons/icon-192x192.png",
				sizes: "192x192",
				type: "image/png",
				purpose: "any maskable",
			},
			{ src: "/icons/icon-384x384.png", sizes: "384x384", type: "image/png", purpose: "any" },
			{
				src: "/icons/icon-512x512.png",
				sizes: "512x512",
				type: "image/png",
				purpose: "any maskable",
			},
		],
		shortcuts: [
			{
				name: "View Stats",
				short_name: "Stats",
				description: "View team statistics",
				url: "/",
				icons: [{ src: "/icons/icon-192x192.png", sizes: "192x192" }],
			},
		],
	};
}
