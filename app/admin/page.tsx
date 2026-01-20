"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import AdminPanel from "@/components/admin/AdminPanel";

export default function AdminPage() {
	const { data: session, status } = useSession();
	const router = useRouter();

	useEffect(() => {
		if (status === "unauthenticated") {
			router.push("/api/auth/signin?callbackUrl=/admin");
		}
	}, [status, router]);

	if (status === "loading") {
		return (
			<div className='min-h-screen bg-gray-100 flex items-center justify-center'>
				<div className='text-center'>
					<div className='animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto'></div>
					<p className='mt-4 text-gray-600'>Checking authentication...</p>
				</div>
			</div>
		);
	}

	if (status === "unauthenticated") {
		return null; // Will redirect via useEffect
	}

	return (
		<div className='min-h-screen bg-gray-100'>
			<div className='container mx-auto'>
				<div className='mb-4 flex justify-between items-center p-4 bg-white rounded-lg shadow'>
					<div>
						<p className='text-sm text-gray-600'>Logged in as: <span className='font-semibold'>{session?.user?.email}</span></p>
					</div>
					<button
						onClick={() => signOut({ callbackUrl: "/" })}
						className='px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors'>
						Sign Out
					</button>
				</div>
				<AdminPanel />
			</div>
		</div>
	);
}
