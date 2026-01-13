import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth/config";

const { handlers, auth } = NextAuth(authOptions);

export { handlers as GET, handlers as POST, auth };
