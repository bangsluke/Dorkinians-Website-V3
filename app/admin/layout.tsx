import SessionProvider from "@/components/SessionProvider";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
	return <SessionProvider>{children}</SessionProvider>;
}
