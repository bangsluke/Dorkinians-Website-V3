import { NextResponse } from "next/server";
import { getConfiguredCurrentSeason } from "@/lib/services/leagueTableService";
import { getLiveFullTimeLeagueEmbedCodes } from "@/lib/services/leagueSourcesService";
import { calculateCurrentSeason } from "@/lib/utils/leagueSeasonList";
import { PUBLIC_CACHE_MEDIUM, withNoStore, withPublicCache } from "@/lib/utils/publicCacheHeaders";

const corsHeaders = {
	"Access-Control-Allow-Origin": "*",
	"Access-Control-Allow-Methods": "GET, OPTIONS",
	"Access-Control-Allow-Headers": "Content-Type",
};

const publicHeaders = withPublicCache(corsHeaders, PUBLIC_CACHE_MEDIUM);

export async function OPTIONS(): Promise<NextResponse> {
	return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(): Promise<NextResponse> {
	try {
		const configuredCurrentSeason = await getConfiguredCurrentSeason();
		const currentSeason = configuredCurrentSeason || calculateCurrentSeason();
		const codes = await getLiveFullTimeLeagueEmbedCodes(currentSeason);
		return NextResponse.json({ season: currentSeason, codes }, { headers: publicHeaders });
	} catch (error) {
		console.error("Error fetching league embed codes:", error);
		return NextResponse.json(
			{ error: "Failed to fetch league embed codes" },
			{ status: 500, headers: withNoStore(corsHeaders) },
		);
	}
}
