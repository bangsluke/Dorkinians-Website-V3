/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ["./pages/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}", "./app/**/*.{js,ts,jsx,tsx,mdx}"],
	theme: {
		extend: {
			colors: {
				"dorkinians-green": "#1C8841",
				"dorkinians-green-dark": "#1a7a3a",
				"dorkinians-green-darker": "#156b32",
				"dorkinians-green-text": "#66BB6A", // WCAG-compliant text color
				"dorkinians-yellow": "#F9ED32",
				"dorkinians-yellow-dark": "#e5d12e",
				"dorkinians-yellow-darker": "#cfbf29",
				"dorkinians-yellow-text": "#FFF176", // WCAG-compliant text color
				"dorkinians-yellow-text-hover": "#FFEB3B", // Hover state variant
			},
			fontFamily: {
				sans: ["Inter", "system-ui", "sans-serif"],
			},
			fontSize: {
				xs: ["0.75rem", { lineHeight: "1.5" }], // 12px
				sm: ["0.875rem", { lineHeight: "1.5" }], // 14px
				base: ["1rem", { lineHeight: "1.625" }], // 16px - WCAG compliant
				lg: ["1.125rem", { lineHeight: "1.625" }], // 18px
				xl: ["1.25rem", { lineHeight: "1.5" }], // 20px
				"2xl": ["1.5rem", { lineHeight: "1.5" }], // 24px
				"3xl": ["1.875rem", { lineHeight: "1.4" }], // 30px
				"4xl": ["2.25rem", { lineHeight: "1.3" }], // 36px
			},
			fontWeight: {
				normal: "400",
				medium: "500",
				semibold: "600",
				bold: "700",
			},
			borderRadius: {
				lg: "0.5rem", // 8px
				xl: "0.75rem", // 12px
				"2xl": "0.875rem", // 14px - matches existing design
			},
		screens: {
			xs: "475px",
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
