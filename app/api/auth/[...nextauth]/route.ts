import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth/config";
import type { NextRequest } from "next/server";

const { handlers, auth } = NextAuth(authOptions);

// Wrap handlers with error logging to capture 500 errors
const GET = async (req: NextRequest) => {
	try {
		return await handlers.GET(req);
	} catch (error) {
		console.error("NextAuth GET error:", error);
		// Re-throw to maintain error response
		throw error;
	}
};

const POST = async (req: NextRequest) => {
	try {
		return await handlers.POST(req);
	} catch (error) {
		console.error("NextAuth POST error:", error);
		// Re-throw to maintain error response
		throw error;
	}
};

export { GET, POST, auth };
