/**
 * Animation timing constants
 * These values match the CSS variables defined in app/globals.css
 * --duration-fast: 150ms
 * --duration-normal: 200ms
 * --duration-slow: 300ms
 * --duration-slower: 500ms
 * --delay-tooltip-mouse: 300ms
 * --delay-tooltip-touch: 500ms
 */

export const ANIMATION_DURATIONS = {
	fast: 150,
	normal: 200,
	slow: 300,
	slower: 500,
} as const;

export const TOOLTIP_DELAYS = {
	mouse: 300, // Matches --delay-tooltip-mouse
	touch: 500, // Matches --delay-tooltip-touch
} as const;
