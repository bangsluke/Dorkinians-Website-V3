import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/session";
import { appConfig } from "@/config/config";
import { neo4jService } from "@/lib/neo4j";
import { parseFailedTestsDetailJson } from "@/lib/utils/failedTestsDetailFormat";
import { NO_STORE } from "@/lib/utils/publicCacheHeaders";

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

async function requireAdminSession(): Promise<{ ok: true } | { ok: false; response: NextResponse }> {
	const session = await getSession();
	const email = session?.user?.email?.toLowerCase();
	const authorized = appConfig.contact.toLowerCase();
	if (!email || email !== authorized) {
		return {
			ok: false,
			response: NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401, headers: { "Cache-Control": NO_STORE } },
			),
		};
	}
	return { ok: true };
}

async function loadSeedRunLogNode(): Promise<Record<string, unknown> | null> {
	const connected = await neo4jService.connect();
	if (!connected) {
		throw new Error("Database connection failed");
	}
	const result = await neo4jService.runQuery(
		`
		MATCH (m:DorkiniansSeedRunLog { id: 'singleton' })
		RETURN m
		LIMIT 1
		`,
		{},
	);
	if (!result.records.length) {
		return null;
	}
	return (result.records[0].get("m")?.properties || {}) as Record<string, unknown>;
}

export async function GET(request: NextRequest) {
	try {
		const authCheck = await requireAdminSession();
		if (!authCheck.ok) {
			return authCheck.response;
		}

		const download = request.nextUrl.searchParams.get("download");
		const props = await loadSeedRunLogNode();

		if (download === "full") {
			if (!props) {
				return NextResponse.json(
					{ error: "No seed run has been recorded yet." },
					{ status: 404, headers: { "Cache-Control": NO_STORE } },
				);
			}
			const fullLogText = toPlainString(props.fullLogText) || "";
			const jobId = toPlainString(props.lastSeedJobId) || "unknown";
			const finishedAt = toPlainString(props.lastSeedFinishedAt) || "unknown";
			const filename = `seed-run-${jobId}-${finishedAt.replace(/[:.]/g, "-")}.log`;
			return new NextResponse(fullLogText, {
				status: 200,
				headers: {
					"Cache-Control": NO_STORE,
					"Content-Type": "text/plain; charset=utf-8",
					"Content-Disposition": `attachment; filename="${filename}"`,
				},
			});
		}

		if (!props) {
			return NextResponse.json(
				{
					exists: false,
					lastSeedJobId: null,
					lastSeedFinishedAt: null,
					lastSeedOutcome: null,
					errorLogText: "",
					fullLogText: null,
					fullLogTruncated: false,
					errorLogTruncated: false,
					failedTestsDetail: [],
					hasErrors: false,
				},
				{ headers: { "Cache-Control": NO_STORE } },
			);
		}

		const includeFull = request.nextUrl.searchParams.get("includeFull") === "1";
		const errorLogText = toPlainString(props.errorLogText) || "";
		const fullLogText = toPlainString(props.fullLogText) || "";
		const failedTestsDetail = parseFailedTestsDetailJson(props.failedTestsDetailJson);

		return NextResponse.json(
			{
				exists: true,
				lastSeedJobId: toPlainString(props.lastSeedJobId),
				lastSeedFinishedAt: toPlainString(props.lastSeedFinishedAt),
				lastSeedOutcome: toPlainString(props.lastSeedOutcome),
				errorLogText,
				fullLogText: includeFull ? fullLogText : null,
				fullLogTruncated: toPlainBoolean(props.fullLogTruncated) === true,
				errorLogTruncated: toPlainBoolean(props.errorLogTruncated) === true,
				failedTestsDetail,
				hasErrors: errorLogText.trim().length > 0,
			},
			{ headers: { "Cache-Control": NO_STORE } },
		);
	} catch (error) {
		console.error("last-seed-run: failed", error);
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Failed to load last seed run" },
			{ status: 500, headers: { "Cache-Control": NO_STORE } },
		);
	}
}
