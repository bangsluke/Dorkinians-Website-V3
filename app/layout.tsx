import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
	title: "Dorkinians FC Stats",
	description: "Dorkinians FC Statistics and Chatbot - Mobile-first PWA",
	manifest: "/manifest.json",
	themeColor: "#1e40af",
	viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no",
	appleWebApp: {
		capable: true,
		statusBarStyle: "default",
		title: "Dorkinians Stats",
	},
	formatDetection: {
		telephone: false,
	},
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang='en'>
			<head>
				<meta name='apple-mobile-web-app-capable' content='yes' />
				<meta name='apple-mobile-web-app-status-bar-style' content='default' />
				<meta name='apple-mobile-web-app-title' content='Dorkinians Stats' />
				<meta name='mobile-web-app-capable' content='yes' />
				<link rel='apple-touch-icon' href='/icon-192x192.png' />
				<link rel='icon' type='image/png' sizes='32x32' href='/icon-192x192.png' />
				<link rel='icon' type='image/png' sizes='16x16' href='/icon-192x192.png' />
			</head>
			<body className={inter.className}>{children}</body>
		</html>
	);
}
