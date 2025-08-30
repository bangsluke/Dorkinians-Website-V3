/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ["./pages/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}", "./app/**/*.{js,ts,jsx,tsx,mdx}"],
	theme: {
		extend: {
			colors: {
				"dorkinians-green": "#1C8841",
				"dorkinians-yellow": "#F9ED32",
			},
			fontFamily: {
				sans: ["Inter", "system-ui", "sans-serif"],
			},
			screens: {
				xs: "475px",
			},
			spacing: {
				18: "4.5rem",
				88: "22rem",
			},
			animation: {
				"slide-in": "slideIn 0.3s ease-out",
				"slide-out": "slideOut 0.3s ease-in",
			},
			keyframes: {
				slideIn: {
					"0%": { transform: "translateX(100%)" },
					"100%": { transform: "translateX(0)" },
				},
				slideOut: {
					"0%": { transform: "translateX(0)" },
					"100%": { transform: "translateX(-100%)" },
				},
			},
		},
	},
	plugins: [],
};
