/**
 * Value for player stats dropdown charts (seasonal / team / monthly).
 * "Goals" includes open-play goals + penalties scored (a penalty is still a goal).
 * "Penalties Scored" stays penalties-only so it is not double-counted.
 */
export function getDropdownChartStatValue(
	stat: Record<string, unknown>,
	statKey: string,
	toNum: (v: unknown) => number,
): number {
	if (statKey === "goals") {
		return toNum(stat.goals) + toNum(stat.penaltiesScored);
	}
	return toNum(stat[statKey]);
}
