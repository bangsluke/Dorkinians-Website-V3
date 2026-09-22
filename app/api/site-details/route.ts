import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/neo4j";
import { getCorsHeadersWithSecurity } from "@/lib/utils/securityHeaders";

const corsHeaders = getCorsHeadersWithSecurity();

function toPlainString(value: unknown): string | null {
	if (value == null) return null;
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") return String(value);
	if (typeof value === "object" && value !== null && "toString" in value) {
		try {
			return String((value as { toString: () => string }).toString());
		} catch {
			return null;
		}
	}
	return null;
}

function toPlainBoolean(value: unknown): boolean | null {
	if (value == null) return null;
	if (typeof value === "boolean") return value;
	if (typeof value === "string") {
		const lowered = value.toLowerCase();
		if (lowered === "true") return true;
		if (lowered === "false") return false;
	}
	return null;
}

export async function OPTIONS() {
	return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function GET(request: NextRequest) {
	try {
		// Connect to Neo4j
		const connected = await neo4jService.connect();
		if (!connected) {
			const errorHeaders = {
				...corsHeaders,
				"Cache-Control": "no-cache, no-store, must-revalidate",
			};
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: errorHeaders });
		}

		const graphLabel = neo4jService.getGraphLabel();

		// Fetch SiteDetail node
		const siteDetailQuery = `
			MATCH (sd:SiteDetail {graphLabel: $graphLabel})
			RETURN sd
			LIMIT 1
		`;

		const siteDetailResult = await neo4jService.runQuery(siteDetailQuery, { graphLabel });

		if (siteDetailResult.records.length === 0) {
			const errorHeaders = {
				...corsHeaders,
				"Cache-Control": "no-cache, no-store, must-revalidate",
			};
			return NextResponse.json({ error: "SiteDetail node not found" }, { status: 404, headers: errorHeaders });
		}

		const siteDetailNode = siteDetailResult.records[0].get("sd");
		const properties = siteDetailNode.properties;

		// Best-effort: last seed attempt meta (success or blocked cutover)
		let seedMeta: {
			lastSeedJobId: string | null;
			lastSeedTriggerSource: string | null;
			lastSeedOutcome: string | null;
			lastSeedFinishedAt: string | null;
			lastSeedFailureSummary: string | null;
			lastSeedFailureReason: string | null;
			blueGreenCutoverCompleted: boolean | null;
			verificationOverallPassed: boolean | null;
			lastCutoverAt: string | null;
		} = {
			lastSeedJobId: null,
			lastSeedTriggerSource: null,
			lastSeedOutcome: null,
			lastSeedFinishedAt: null,
			lastSeedFailureSummary: null,
			lastSeedFailureReason: null,
			blueGreenCutoverCompleted: null,
			verificationOverallPassed: null,
			lastCutoverAt: null,
		};

		try {
			const metaResult = await neo4jService.runQuery(
				`
				MATCH (m:DorkiniansSeedingMeta { id: 'singleton' })
				RETURN m
				LIMIT 1
				`,
				{}
			);
			if (metaResult.records.length > 0) {
				const metaProps = metaResult.records[0].get("m")?.properties || {};
				seedMeta = {
					lastSeedJobId: toPlainString(metaProps.lastSeedJobId),
					lastSeedTriggerSource: toPlainString(metaProps.lastSeedTriggerSource),
					lastSeedOutcome: toPlainString(metaProps.lastSeedOutcome),
					lastSeedFinishedAt: toPlainString(metaProps.lastSeedFinishedAt),
					lastSeedFailureSummary: toPlainString(metaProps.lastSeedFailureSummary),
					lastSeedFailureReason: toPlainString(metaProps.lastSeedFailureReason),
					blueGreenCutoverCompleted: toPlainBoolean(metaProps.blueGreenCutoverCompleted),
					verificationOverallPassed: toPlainBoolean(metaProps.verificationOverallPassed),
					lastCutoverAt: toPlainString(metaProps.lastCutoverAt),
				};
			}
		} catch (metaError) {
			console.warn("site-details: DorkiniansSeedingMeta read failed (non-fatal)", metaError);
		}

		// Extract relevant properties
		const siteDetails = {
			lastSeededStats: properties.lastSeededStats || null,
			versionReleaseDetails: properties.versionReleaseDetails || null,
			updatesToCome: properties.updatesToCome || null,
			statLimitations: properties.statLimitations || null,
			pageDetailsLastRefreshed: properties.pageDetailsLastRefreshed || null,
			versionNumber: properties.versionNumber || null,
			currentSeason: properties.currentSeason || null,
			...seedMeta,
		};

		// Add Cache-Control header for BFCache compatibility
		const responseHeaders = {
			...corsHeaders,
			"Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
		};

		return NextResponse.json(siteDetails, { headers: responseHeaders });
	} catch (error) {
		console.error("Error fetching site details:", error);
		const errorHeaders = {
			...corsHeaders,
			"Cache-Control": "no-cache, no-store, must-revalidate",
		};
		return NextResponse.json({ error: "Failed to fetch site details" }, { status: 500, headers: errorHeaders });
	}
}
