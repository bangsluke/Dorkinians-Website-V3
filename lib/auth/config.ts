import GoogleProvider from "next-auth/providers/google";
import { appConfig } from "@/config/config";
import type { NextAuthConfig } from "next-auth";

export const authOptions: NextAuthConfig = {
	providers: [
		GoogleProvider({
			clientId: process.env.AUTH_GOOGLE_ID!,
			clientSecret: process.env.AUTH_GOOGLE_SECRET!,
		}),
	],
	secret: process.env.AUTH_SECRET,
	trustHost: true, // Required for production deployments
	pages: {
		signIn: "/api/auth/signin",
	},
	callbacks: {
		async signIn({ user, account, profile }: any) {
			// Verify email matches the authorized contact email from config
			if (!user.email) {
				return false;
			}

			// Case-insensitive email comparison
			const authorizedEmail = appConfig.contact.toLowerCase();
			const userEmail = user.email.toLowerCase();

			if (userEmail !== authorizedEmail) {
				console.warn(`⚠️ Unauthorized login attempt from: ${user.email}`);
				return false;
			}

			return true;
		},
		async jwt({ token, user, account }: any) {
			// Initial sign in
			if (account && user) {
				token.email = user.email;
				token.name = user.name;
			}
			return token;
		},
		async session({ session, token }: any) {
			if (session.user) {
				session.user.email = token.email as string;
				session.user.name = token.name as string;
			}
			return session;
		},
	},
	session: {
		strategy: "jwt",
		maxAge: 7 * 24 * 60 * 60, // 7 days
	},
	cookies: {
		sessionToken: {
			name: process.env.NODE_ENV === "production" ? "__Secure-next-auth.session-token" : "next-auth.session-token",
			options: {
				httpOnly: true,
				sameSite: "lax",
				path: "/",
				secure: process.env.NODE_ENV === "production",
			},
		},
	},
};
