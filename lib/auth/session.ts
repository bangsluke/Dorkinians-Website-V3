import { auth } from "@/app/api/auth/[...nextauth]/route";

// Get session server-side
export async function getSession() {
	return await auth();
}

// Check if user is authenticated and authorized
export async function isAuthorized(): Promise<boolean> {
	const session = await getSession();
	return !!session?.user?.email;
}
