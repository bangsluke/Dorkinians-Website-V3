import { NextRequest, NextResponse } from "next/server";
import { computeWrappedData, computeWrappedSeasonMetadata } from "@/lib/wrapped/computeWrappedData";
import { wrappedSlugToPlayerName } from "@/lib/wrapped/slug";
import { getSitePublicOrigin } from "@/lib/wrapped/siteOrigin";
import { getCorsHeadersWithSecurity } from "@/lib/utils/securityHeaders";

const corsHeaders = getCorsHeadersWithSecurity();

export async function OPTIONS() {
	return new NextResponse(null, { status: 200, headers: corsHeaders });
}

export async function GET(request: NextRequest, ctx: { params: Promise<{ playerSlug: string }> }) {
	try {
		const { playerSlug } = await ctx.params;
		const name = wrappedSlugToPlayerName(decodeURIComponent(playerSlug));
		if (!name) {
			return NextResponse.json({ error: "Invalid player slug" }, { status: 400, headers: corsHeaders });
		}

		const { searchParams } = new URL(request.url);
		const season = searchParams.get("season")?.trim() || undefined;
		const metaOnly = searchParams.get("meta") === "1";

		if (metaOnly) {
			const meta = await computeWrappedSeasonMetadata({ playerName: name, season });
			if ("error" in meta) {
				return NextResponse.json({ error: meta.error }, { status: meta.status, headers: corsHeaders });
			}
			return NextResponse.json(
				{
					seasonsAvailable: meta.data.seasonsAvailable,
					season: meta.data.seasonLabel,
				},
				{ headers: { ...corsHeaders, "Cache-Control": "public, max-age=300" } },
			);
		}

		const origin = getSitePublicOrigin(request);
		const result = await computeWrappedData({
			playerName: name,
			season,
			sitePublicOrigin: origin,
		});

		if (result && "error" in result) {
			return NextResponse.json({ error: result.error }, { status: result.status, headers: corsHeaders });
		}

		if (!result || !("data" in result)) {
			return NextResponse.json({ error: "Failed to load wrapped data" }, { status: 500, headers: corsHeaders });
		}

		return NextResponse.json(result.data, { headers: { ...corsHeaders, "Cache-Control": "public, max-age=120" } });
	} catch (e) {
		console.error("wrapped API error", e);
		return NextResponse.json({ error: "Failed to load wrapped data" }, { status: 500, headers: corsHeaders });
	}
}
