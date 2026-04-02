import { NextRequest, NextResponse } from "next/server";
import { neo4jService } from "@/lib/neo4j";
import {
	buildStreakAppearanceSlotsCollectQuery,
	buildStreakMatchesCollectQuery,
} from "../player-data/route";
import { computeLiveStreakPayload, type LiveStreakPayload } from "@/lib/stats/playerStreaksComputation";
import { getCorsHeadersWithSecurity } from "@/lib/utils/securityHeaders";
import { dataApiRateLimiter } from "@/lib/middleware/rateLimiter";
import { sanitizeError } from "@/lib/utils/errorSanitizer";
import { logError } from "@/lib/utils/logger";
import { csrfProtection } from "@/lib/middleware/csrf";
import { validatePlayerStatsFilters } from "@/lib/api/validatePlayerStatsFilters";

const corsHeaders = getCorsHeadersWithSecurity();

const MAX_PLAYER_NAME_LENGTH = 200;

export async function OPTIONS() {
	return new NextResponse(null, { status: 200, headers: corsHeaders });
}

/**
 * POST { playerName, filters? } - live streak metrics for the same fixture scope as filtered player stats.
 * When `filters` is omitted or null, uses full career (no WHERE on fixtures).
 */
export async function POST(request: NextRequest) {
	const rateLimitResponse = await dataApiRateLimiter(request);
	if (rateLimitResponse) return rateLimitResponse;

	const csrfResponse = csrfProtection(request);
	if (csrfResponse) return csrfResponse;

	try {
		const body = await request.json();
		const playerName = body?.playerName;
		const filters = body?.filters ?? null;

		if (!playerName || typeof playerName !== "string" || playerName.trim() === "") {
			return NextResponse.json({ error: "Valid player name is required" }, { status: 400, headers: corsHeaders });
		}
		if (playerName.length > MAX_PLAYER_NAME_LENGTH) {
			return NextResponse.json(
				{ error: `Player name too long. Maximum ${MAX_PLAYER_NAME_LENGTH} characters allowed.` },
				{ status: 400, headers: corsHeaders }
			);
		}

		if (filters != null && typeof filters !== "object") {
			return NextResponse.json({ error: "filters must be an object when provided" }, { status: 400, headers: corsHeaders });
		}

		const validationError = filters ? validatePlayerStatsFilters(filters) : null;
		if (validationError) {
			return NextResponse.json({ error: validationError }, { status: 400, headers: corsHeaders });
		}

		const connected = await neo4jService.connect();
		if (!connected) {
			return NextResponse.json({ error: "Database connection failed" }, { status: 500, headers: corsHeaders });
		}

		const { query: mq, params: mp } = buildStreakMatchesCollectQuery(playerName, filters);
		const { query: aq, params: ap } = buildStreakAppearanceSlotsCollectQuery(playerName, filters);

		let matchRes;
		let appearRes;
		try {
			[matchRes, appearRes] = await Promise.all([neo4jService.runQuery(mq, mp), neo4jService.runQuery(aq, ap)]);
		} catch (queryError: unknown) {
			logError("player-streaks Cypher error", queryError);
			return NextResponse.json({ error: "Query execution failed. Please try again later." }, { status: 500, headers: corsHeaders });
		}

		if (matchRes.records.length === 0) {
			return NextResponse.json({ error: "Player not found" }, { status: 404, headers: corsHeaders });
		}

		const rawMatches = matchRes.records[0].get("rawMatches");
		let appearanceSlots: unknown[] | null = null;
		if (appearRes.records[0]) {
			appearanceSlots = (appearRes.records[0].get("appearanceSlots") as unknown[]) ?? [];
		}

		const streaks: LiveStreakPayload = computeLiveStreakPayload(rawMatches as unknown[], appearanceSlots);

		return NextResponse.json({ streaks }, { headers: corsHeaders });
	} catch (error: unknown) {
		logError("player-streaks route error", error);
		const sanitized = sanitizeError(error, process.env.NODE_ENV === "production");
		return NextResponse.json({ error: sanitized.message }, { status: 500, headers: corsHeaders });
	}
}
