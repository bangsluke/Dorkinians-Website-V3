import Image from "next/image";
import Link from "next/link";

export default function NotFound() {
	return (
		<div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-gray-900 via-black to-gray-900">
			<div className="max-w-2xl w-full bg-white/10 backdrop-blur-sm rounded-lg p-6 md:p-8 border border-white/20">
				<div className="flex flex-col items-center text-center space-y-6">
					{/* Dorkinians Logo */}
					<div className="flex items-center justify-center">
						<Image
							src="/icons/icon-512x512.png"
							alt="Dorkinians FC Logo"
							width={128}
							height={128}
							className="rounded-full"
							priority
						/>
					</div>

					{/* Error Message */}
					<div className="space-y-4">
						<h1 className="text-2xl md:text-3xl font-bold text-white">
							404 error. Sorry this page could not be found
						</h1>
					</div>

					{/* Homepage Link */}
					<div className="pt-4">
						<Link
							href="/"
							className="text-dorkinians-yellow hover:text-dorkinians-yellow-dark underline text-base md:text-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dorkinians-yellow focus-visible:ring-offset-2 focus-visible:ring-offset-transparent rounded"
							aria-label="Return to homepage"
						>
							Click here to return to the homepage
						</Link>
					</div>
				</div>
			</div>
		</div>
	);
}
