import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import {
	CacheFirst,
	ExpirationPlugin,
	Serwist,
	StaleWhileRevalidate,
} from "serwist";

declare global {
	interface WorkerGlobalScope extends SerwistGlobalConfig {
		__SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
	}
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
	precacheEntries: self.__SW_MANIFEST,
	// Keep waiting SW until the app prompts (pwaUpdateService → SKIP_WAITING)
	skipWaiting: false,
	clientsClaim: true,
	navigationPreload: true,
	runtimeCaching: [
		{
			matcher: ({ url }) =>
				url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com",
			handler: new CacheFirst({
				cacheName: "google-fonts",
				plugins: [
					new ExpirationPlugin({
						maxEntries: 4,
						maxAgeSeconds: 60 * 60 * 24 * 365,
					}),
				],
			}),
		},
		{
			matcher: /\.(?:eot|otf|ttc|ttf|woff|woff2|font\.css)$/i,
			handler: new StaleWhileRevalidate({
				cacheName: "static-font-assets",
				plugins: [
					new ExpirationPlugin({
						maxEntries: 4,
						maxAgeSeconds: 60 * 60 * 24 * 365,
					}),
				],
			}),
		},
		{
			matcher: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
			handler: new CacheFirst({
				cacheName: "static-image-assets",
				plugins: [
					new ExpirationPlugin({
						maxEntries: 64,
						maxAgeSeconds: 60 * 60 * 24 * 30,
					}),
				],
			}),
		},
		...defaultCache,
	],
});

serwist.addEventListeners();
