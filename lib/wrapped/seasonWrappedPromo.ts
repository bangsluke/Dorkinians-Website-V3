/** Inclusive calendar months (0-based, `Date#getMonth`) when the Player Profile promotes Season Wrapped. */
export const SEASON_WRAPPED_PROMO_MONTH_MIN = 3; // April
export const SEASON_WRAPPED_PROMO_MONTH_MAX = 7; // August

export function isSeasonWrappedPromoMonth(date: Date): boolean {
	const m = date.getMonth();
	return m >= SEASON_WRAPPED_PROMO_MONTH_MIN && m <= SEASON_WRAPPED_PROMO_MONTH_MAX;
}
