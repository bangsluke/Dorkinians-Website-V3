/** @type {import('next').NextConfig} */
const withPWA = require("next-pwa")({
	dest: "public",
	register: true,
	skipWaiting: true,
	disable: process.env.NODE_ENV === "development",
});

const nextConfig = {
	// output: 'export', // Disabled to enable API routes
	trailingSlash: true,
	images: {
		unoptimized: true,
		domains: ["docs.google.com"],
	},
	// Enable API routes for development and production
	experimental: {
		appDir: true
	}
};

module.exports = withPWA(nextConfig);
