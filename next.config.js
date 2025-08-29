/** @type {import('next').NextConfig} */
const withPWA = require("next-pwa")({
	dest: "public",
	register: true,
	skipWaiting: true,
	disable: process.env.NODE_ENV === "development",
	runtimeCaching: [
		{
			urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
			handler: "CacheFirst",
			options: {
				cacheName: "google-fonts",
				expiration: {
					maxEntries: 4,
					maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
				},
			},
		},
		{
			urlPattern: /\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,
			handler: "StaleWhileRevalidate",
			options: {
				cacheName: "static-font-assets",
				expiration: {
					maxEntries: 4,
					maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
				},
			},
		},
		{
			urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
			handler: "CacheFirst",
			options: {
				cacheName: "static-image-assets",
				expiration: {
					maxEntries: 64,
					maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
				},
			},
		},
	],
});

const nextConfig = {
	// output: 'export', // Disabled to enable API routes
	images: {
		unoptimized: true,
		domains: ["docs.google.com"],
	},
	// Enable API routes for development and production
	// experimental: {
	// 	appDir: true
	// }
};

module.exports = withPWA(nextConfig);
