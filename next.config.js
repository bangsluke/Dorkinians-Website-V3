/** @type {import('next').NextConfig} */
const fs = require("fs");
const path = require("path");
const webpack = require("webpack");

// Merge .env* from this directory with override so repo values win over a stale SEED_API_KEY
// (or other vars) already present in process.env from Windows user env / parent shell / CI.
// Next's default merge keeps existing process.env entries, which caused builds to ignore .env fixes.
(function loadEnvFromPackageDir() {
	try {
		const dotenv = require("dotenv");
		const root = __dirname;
		const load = (filename) => {
			const full = path.join(root, filename);
			if (fs.existsSync(full)) {
				dotenv.config({ path: full, override: true, quiet: true });
			}
		};
		load(".env");
		load(".env.local");
		if (process.env.NODE_ENV === "production") {
			load(".env.production");
			load(".env.production.local");
		} else {
			load(".env.development");
			load(".env.development.local");
		}
	} catch {
		// dotenv is optional if dependency tree changes
	}
})();

// Absolute path to this app (used by lib/config/loadPackageEnv.ts in build workers)
process.env.DORKINIANS_WEBSITE_ROOT = path.resolve(__dirname);

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
	// Pin project root: otherwise Next infers the nearest parent lockfile (e.g. C:\Users\bangs\package-lock.json)
	// and can load the wrong .env / fail env validation while building from this repo.
	turbopack: {
		root: path.resolve(__dirname),
	},
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
