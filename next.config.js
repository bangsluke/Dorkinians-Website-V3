/** @type {import('next').NextConfig} */
const fs = require("fs");
const path = require("path");
const webpack = require("webpack");

// Bundle analyzer configuration (only when ANALYZE=true and package is available)
let withBundleAnalyzer = (config) => config;
if (process.env.ANALYZE === "true") {
	try {
		withBundleAnalyzer = require("@next/bundle-analyzer")({
			enabled: true,
		});
	} catch (error) {
		// Bundle analyzer not available, skip it
		console.warn("Bundle analyzer not available, skipping analysis");
	}
}

// Read version from package.json
const packageJsonPath = path.join(__dirname, "package.json");
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const appVersion = packageJson.version;

const withPWA = require("next-pwa")({
	dest: "public",
	register: true,
	skipWaiting: false,
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
	typescript: {
		// Skip type checking during build (types are checked in CI/local dev)
		ignoreBuildErrors: true,
	},
	eslint: {
		// Skip ESLint during build (linting is done in CI/local dev)
		ignoreDuringBuilds: true,
	},
	images: {
		remotePatterns: [
			{
				protocol: 'https',
				hostname: 'docs.google.com',
			},
		],
		formats: ['image/avif', 'image/webp'],
		// Disable image optimization on Netlify to avoid 400 errors with static assets
		// Netlify sets NETLIFY=true automatically, or we can use NEXT_PUBLIC_UNOPTIMIZED env var
		unoptimized: !!process.env.NETLIFY || process.env.NEXT_PUBLIC_UNOPTIMIZED === 'true',
	},
	// TypeScript configuration will be handled via tsconfig files
	// Enable API routes for development and production
	// experimental: {
	// 	appDir: true
	// }
	env: {
		NEXT_PUBLIC_APP_VERSION: appVersion,
		NEXT_PUBLIC_CONSOLE_LOG_LEVEL: process.env.CONSOLE_LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'error' : 'info'),
	},
	// Remove console logs in production (except console.error which we sanitize at runtime)
	compiler: {
		removeConsole: process.env.NODE_ENV === 'production' ? {
			exclude: ['error'],
		} : false,
	},
	// SWC minification is already default in Next.js 14
	swcMinify: true,
	webpack: (config, { isServer }) => {
		// Ignore optional dependencies that don't work in Next.js
		config.plugins.push(
			new webpack.IgnorePlugin({
				resourceRegExp: /^webworker-threads$/,
			})
		);
		
		// Ensure path aliases are resolved correctly
		config.resolve.alias = {
			...config.resolve.alias,
			"@": path.resolve(__dirname),
		};
		
		return config;
	},
};

module.exports = withBundleAnalyzer(withPWA(nextConfig));
