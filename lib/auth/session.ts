import { getServerSession } from "next-auth";
import { authOptions } from "./config";

// Get session server-side
export async function getSession() {
	return await getServerSession(authOptions);
}

// Check if user is authenticated and authorized
export async function isAuthorized(): Promise<boolean> {
	const session = await getSession();
	return !!session?.user?.email;
}
