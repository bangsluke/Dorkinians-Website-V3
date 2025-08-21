/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ["./pages/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}", "./app/**/*.{js,ts,jsx,tsx,mdx}"],
	theme: {
		extend: {
			colors: {
				"dorkinians-blue": "#1e40af",
				"dorkinians-red": "#dc2626",
				"dorkinians-gold": "#f59e0b",
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
