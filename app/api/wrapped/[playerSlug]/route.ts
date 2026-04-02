import { NextRequest, NextResponse } from "next/server";
import { computeWrappedData } from "@/lib/wrapped/computeWrappedData";
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
