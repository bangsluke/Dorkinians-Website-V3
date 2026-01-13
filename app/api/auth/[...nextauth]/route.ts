import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth/config";

const handler = NextAuth(authOptions);

export const auth = handler.auth;

export { handler as GET, handler as POST };
