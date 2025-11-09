import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import PWAUpdateNotification from "../components/PWAUpdateNotification";
import UmamiAnalytics from "../components/UmamiAnalytics";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
	title: "Dorkinians FC Stats",
	description: "Dorkinians FC Statistics and Chatbot - Mobile-first PWA",
	manifest: "/manifest.json",
	appleWebApp: {
		capable: true,
		statusBarStyle: "default",
		title: "Dorkinians Stats",
		startupImage: [
			{
				url: "/apple-touch-startup-image-1290x2796.png",
				media: "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)",
			},
			{
				url: "/apple-touch-startup-image-2796x1290.png",
				media: "(device-width: 932px) and (device-height: 430px) and (-webkit-device-pixel-ratio: 3)",
			},
			{
				url: "/apple-touch-startup-image-1170x2532.png",
				media: "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)",
			},
			{
				url: "/apple-touch-startup-image-2532x1170.png",
				media: "(device-width: 844px) and (device-height: 390px) and (-webkit-device-pixel-ratio: 3)",
			},
			{
				url: "/apple-touch-startup-image-1242x2208.png",
				media: "(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3)",
			},
			{
				url: "/apple-touch-startup-image-2208x1242.png",
				media: "(device-width: 736px) and (device-height: 414px) and (-webkit-device-pixel-ratio: 3)",
			},
		],
	},
	formatDetection: {
		telephone: false,
	},
};

export const viewport = {
	width: "device-width",
	initialScale: 1,
	maximumScale: 1,
	userScalable: false,
	themeColor: "#F9ED32",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	const umamiScriptUrl = process.env.NEXT_PUBLIC_UMAMI_SCRIPT_URL;
	const umamiWebsiteId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;

	return (
		<html lang='en'>
			<head>
				<meta name='apple-mobile-web-app-capable' content='yes' />
				<meta name='apple-mobile-web-app-status-bar-style' content='default' />
				<meta name='apple-mobile-web-app-title' content='Dorkinians Stats' />
				<meta name='mobile-web-app-capable' content='yes' />
				<link rel='apple-touch-icon' href='/icons/icon-iOS-192x192.png' />
				<link rel='icon' type='image/png' sizes='32x32' href='/icons/icon-32x32.png' />
				<link rel='icon' type='image/png' sizes='16x16' href='/icons/icon-16x16.png' />
				<link rel='icon' type='image/png' sizes='192x192' href='/icons/icon-192x192.png' />
				<link rel='icon' type='image/png' sizes='512x512' href='/icons/icon-512x512.png' />
			</head>
			<body className={inter.className} suppressHydrationWarning={true}>
				{children}
				<PWAUpdateNotification />
				{umamiScriptUrl && umamiWebsiteId && (
					<Script
						async
						defer
						data-website-id={umamiWebsiteId}
						src={umamiScriptUrl}
						strategy='afterInteractive'
					/>
				)}
				<UmamiAnalytics />
			</body>
		</html>
	);
}
