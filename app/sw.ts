import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from "serwist";
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

function isFullTimeHost(hostname: string): boolean {
	return hostname === "fulltime.thefa.com" || hostname.endsWith(".thefa.com");
}

/**
 * Serwist's defaultCache matches all *.js and all cross-origin GETs.
 * If those routes handle Full-Time, the SW fetch is judged against the
 * parent page CSP (no thefa.com) and the league widgets stay on "Data loading....".
 * Skip Full-Time hosts so the embed iframe loads them under its own CSP.
 */
function withoutFullTimeHosts(routes: RuntimeCaching[]): RuntimeCaching[] {
	return routes.map((route) => {
		const originalMatcher = route.matcher;
		return {
			...route,
			matcher: (options) => {
				if (isFullTimeHost(options.url.hostname)) {
					return false;
				}
				if (typeof originalMatcher === "function") {
					return originalMatcher(options);
				}
				if (originalMatcher instanceof RegExp) {
					return originalMatcher.test(options.url.href) || originalMatcher.test(options.url.pathname);
				}
				return options.url.href.includes(originalMatcher) || options.url.pathname === originalMatcher;
			},
		};
	});
}

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
		...withoutFullTimeHosts(defaultCache),
	],
});

serwist.addEventListeners();
