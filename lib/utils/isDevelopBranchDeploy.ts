/**
 * True when this build is for the Netlify `develop` branch (branch deploy or develop-as-production).
 * Uses Netlify's BRANCH at build time and optional NEXT_PUBLIC_SITE_VARIANT from netlify.toml.
 */
export function isDevelopBranchDeploy(): boolean {
	return (
		process.env.BRANCH === "develop" || process.env.NEXT_PUBLIC_SITE_VARIANT === "develop"
	);
}
