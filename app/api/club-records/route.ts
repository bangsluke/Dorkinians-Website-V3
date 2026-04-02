import { NextRequest, NextResponse } from "next/server";
import type { Record as NeoRecord } from "neo4j-driver";
import { neo4jService } from "@/lib/neo4j";
import { getCorsHeadersWithSecurity } from "@/lib/utils/securityHeaders";
import { dataApiRateLimiter } from "@/lib/middleware/rateLimiter";
import { logError } from "@/lib/utils/logger";

const corsHeaders = getCorsHeadersWithSecurity();

export async function OPTIONS() {
	return new NextResponse(null, { status: 200, headers: corsHeaders });
}

function str(v: unknown): string | null {
	if (v == null) return null;
	return String(v);
}

function num(v: unknown): number | null {
	if (v == null) return null;
	if (typeof v === "number" && !Number.isNaN(v)) return v;
	if (typeof v === "object" && v !== null && "toNumber" in v && typeof (v as { toNumber: () => number }).toNumber === "function") {
		return (v as { toNumber: () => number }).toNumber();
	}
	const n = Number(v);
	return Number.isNaN(n) ? null : n;
}

export async function GET(_request: NextRequest) {
	const rateLimitResponse = await dataApiRateLimiter(_request);
	if (rateLimitResponse) {
		return rateLimitResponse;
	}

	try {
		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: corsHeaders });
		}

		const graphLabel = neo4jService.getGraphLabel();
		const query = `
			MATCH (cr:ClubRecord {graphLabel: $graphLabel})
			RETURN cr
			ORDER BY cr.category ASC, cr.recordName ASC
		`;
		const result = await neo4jService.runQuery(query, { graphLabel });

		const records = result.records.map((record: NeoRecord) => {
			const node = record.get("cr") as {
				properties: Record<string, unknown>;
			};
			const p = node.properties;
			return {
				id: str(p.id) ?? "",
				category: str(p.category) ?? "",
				recordName: str(p.recordName) ?? "",
				recordValue: num(p.recordValue) ?? 0,
				recordValueDisplay: str(p.recordValueDisplay),
				holderName: str(p.holderName),
				holderTeam: str(p.holderTeam),
				season: str(p.season),
				additionalContext: str(p.additionalContext),
				currentChallenger: str(p.currentChallenger),
				challengerValue: num(p.challengerValue),
			};
		});

		return NextResponse.json({ records }, { headers: corsHeaders });
	} catch (error) {
		logError("club-records GET", error);
		return NextResponse.json({ error: "Failed to load club records", records: [] }, { status: 500, headers: corsHeaders });
	}
}
