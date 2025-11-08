// Formation coordinate constants
export const GKy = 1;
export const DEFy = 24;
export const MIDy = 47;
export const FWDy = 71;

// Player width constant
export const PlayerWidth = 20;

// X position constants
export const Centerx = 50 - PlayerWidth / 2;
export const LeftOf2x = 30 - PlayerWidth / 2;
export const RightOf2x = 70 - PlayerWidth / 2;
export const LeftOf3x = 25 - PlayerWidth / 2;
export const RightOf3x = 75 - PlayerWidth / 2;
export const LeftOf4x = 15 - PlayerWidth / 2;
export const LeftCenterOf4x = 35 - PlayerWidth / 2;
export const RightCenterOf4x = 65 - PlayerWidth / 2;
export const RightOf4x = 85 - PlayerWidth / 2;
export const LeftOf5x = 10 - PlayerWidth / 2;
export const LeftCenterOf5x = 30 - PlayerWidth / 2;
export const RightCenterOf5x = 70 - PlayerWidth / 2;
export const RightOf5x = 90 - PlayerWidth / 2;

// Position interface
export interface Position {
	Classification: string;
	x: number;
	y: number;
}

// Formation interface
export interface Formation {
	Pos1: Position;
	Pos2: Position;
	Pos3: Position;
	Pos4: Position;
	Pos5: Position;
	Pos6: Position;
	Pos7: Position;
	Pos8: Position;
	Pos9: Position;
	Pos10: Position;
	Pos11: Position;
}

// Formation coordinate object
export const formationCoordinateObject: Record<string, Formation> = {
	"4-4-2": {
		Pos1: {
			Classification: "GK",
			x: Centerx,
			y: GKy,
		},
		Pos2: {
			Classification: "DEF1",
			x: LeftOf4x,
			y: DEFy,
		},
		Pos3: {
			Classification: "DEF2",
			x: LeftCenterOf4x,
			y: DEFy,
		},
		Pos4: {
			Classification: "DEF3",
			x: RightCenterOf4x,
			y: DEFy,
		},
		Pos5: {
			Classification: "DEF4",
			x: RightOf4x,
			y: DEFy,
		},
		Pos6: {
			Classification: "MID1",
			x: LeftOf4x,
			y: MIDy,
		},
		Pos7: {
			Classification: "MID2",
			x: LeftCenterOf4x,
			y: MIDy,
		},
		Pos8: {
			Classification: "MID3",
			x: RightCenterOf4x,
			y: MIDy,
		},
		Pos9: {
			Classification: "MID4",
			x: RightOf4x,
			y: MIDy,
		},
		Pos10: {
			Classification: "FWD1",
			x: LeftOf2x,
			y: FWDy,
		},
		Pos11: {
			Classification: "FWD2",
			x: RightOf2x,
			y: FWDy,
		},
	},
	"4-3-3": {
		Pos1: {
			Classification: "GK",
			x: Centerx,
			y: GKy,
		},
		Pos2: {
			Classification: "DEF1",
			x: LeftOf4x,
			y: DEFy,
		},
		Pos3: {
			Classification: "DEF2",
			x: LeftCenterOf4x,
			y: DEFy,
		},
		Pos4: {
			Classification: "DEF3",
			x: RightCenterOf4x,
			y: DEFy,
		},
		Pos5: {
			Classification: "DEF4",
			x: RightOf4x,
			y: DEFy,
		},
		Pos6: {
			Classification: "MID1",
			x: LeftOf3x,
			y: MIDy,
		},
		Pos7: {
			Classification: "MID2",
			x: Centerx,
			y: MIDy,
		},
		Pos8: {
			Classification: "MID3",
			x: RightOf3x,
			y: MIDy,
		},
		Pos9: {
			Classification: "FWD1",
			x: LeftOf3x,
			y: FWDy,
		},
		Pos10: {
			Classification: "FWD2",
			x: Centerx,
			y: FWDy,
		},
		Pos11: {
			Classification: "FWD3",
			x: RightOf3x,
			y: FWDy,
		},
	},
	"4-5-1": {
		Pos1: {
			Classification: "GK",
			x: Centerx,
			y: GKy,
		},
		Pos2: {
			Classification: "DEF1",
			x: LeftOf4x,
			y: DEFy,
		},
		Pos3: {
			Classification: "DEF2",
			x: LeftCenterOf4x,
			y: DEFy,
		},
		Pos4: {
			Classification: "DEF3",
			x: RightCenterOf4x,
			y: DEFy,
		},
		Pos5: {
			Classification: "DEF4",
			x: RightOf4x,
			y: DEFy,
		},
		Pos6: {
			Classification: "MID1",
			x: LeftOf5x,
			y: MIDy,
		},
		Pos7: {
			Classification: "MID2",
			x: LeftCenterOf5x,
			y: MIDy,
		},
		Pos8: {
			Classification: "MID3",
			x: Centerx,
			y: MIDy,
		},
		Pos9: {
			Classification: "MID4",
			x: RightCenterOf5x,
			y: MIDy,
		},
		Pos10: {
			Classification: "MID5",
			x: RightOf5x,
			y: MIDy,
		},
		Pos11: {
			Classification: "FWD1",
			x: Centerx,
			y: FWDy,
		},
	},
	"3-5-2": {
		Pos1: {
			Classification: "GK",
			x: Centerx,
			y: GKy,
		},
		Pos2: {
			Classification: "DEF1",
			x: LeftOf3x,
			y: DEFy,
		},
		Pos3: {
			Classification: "DEF2",
			x: Centerx,
			y: DEFy,
		},
		Pos4: {
			Classification: "DEF3",
			x: RightOf3x,
			y: DEFy,
		},
		Pos5: {
			Classification: "MID1",
			x: LeftOf5x,
			y: MIDy,
		},
		Pos6: {
			Classification: "MID2",
			x: LeftCenterOf5x,
			y: MIDy,
		},
		Pos7: {
			Classification: "MID3",
			x: Centerx,
			y: MIDy,
		},
		Pos8: {
			Classification: "MID4",
			x: RightCenterOf5x,
			y: MIDy,
		},
		Pos9: {
			Classification: "MID5",
			x: RightOf5x,
			y: MIDy,
		},
		Pos10: {
			Classification: "FWD1",
			x: LeftOf2x,
			y: FWDy,
		},
		Pos11: {
			Classification: "FWD2",
			x: RightOf2x,
			y: FWDy,
		},
	},
	"3-4-3": {
		Pos1: {
			Classification: "GK",
			x: Centerx,
			y: GKy,
		},
		Pos2: {
			Classification: "DEF1",
			x: LeftOf3x,
			y: DEFy,
		},
		Pos3: {
			Classification: "DEF2",
			x: Centerx,
			y: DEFy,
		},
		Pos4: {
			Classification: "DEF3",
			x: RightOf3x,
			y: DEFy,
		},
		Pos5: {
			Classification: "MID1",
			x: LeftOf4x,
			y: MIDy,
		},
		Pos6: {
			Classification: "MID2",
			x: LeftCenterOf4x,
			y: MIDy,
		},
		Pos7: {
			Classification: "MID3",
			x: RightCenterOf4x,
			y: MIDy,
		},
		Pos8: {
			Classification: "MID4",
			x: RightOf4x,
			y: MIDy,
		},
		Pos9: {
			Classification: "FWD1",
			x: LeftOf3x,
			y: FWDy,
		},
		Pos10: {
			Classification: "FWD2",
			x: Centerx,
			y: FWDy,
		},
		Pos11: {
			Classification: "FWD3",
			x: RightOf3x,
			y: FWDy,
		},
	},
	"5-3-2": {
		Pos1: {
			Classification: "GK",
			x: Centerx,
			y: GKy,
		},
		Pos2: {
			Classification: "DEF1",
			x: LeftOf5x,
			y: DEFy,
		},
		Pos3: {
			Classification: "DEF2",
			x: LeftCenterOf5x,
			y: DEFy,
		},
		Pos4: {
			Classification: "DEF3",
			x: Centerx,
			y: DEFy,
		},
		Pos5: {
			Classification: "DEF4",
			x: RightCenterOf5x,
			y: DEFy,
		},
		Pos6: {
			Classification: "DEF5",
			x: RightOf5x,
			y: DEFy,
		},
		Pos7: {
			Classification: "MID1",
			x: LeftOf3x,
			y: MIDy,
		},
		Pos8: {
			Classification: "MID2",
			x: Centerx,
			y: MIDy,
		},
		Pos9: {
			Classification: "MID3",
			x: RightOf3x,
			y: MIDy,
		},
		Pos10: {
			Classification: "FWD1",
			x: LeftOf2x,
			y: FWDy,
		},
		Pos11: {
			Classification: "FWD2",
			x: RightOf2x,
			y: FWDy,
		},
	},
	"5-4-1": {
		Pos1: {
			Classification: "GK",
			x: Centerx,
			y: GKy,
		},
		Pos2: {
			Classification: "DEF1",
			x: LeftOf5x,
			y: DEFy,
		},
		Pos3: {
			Classification: "DEF2",
			x: LeftCenterOf5x,
			y: DEFy,
		},
		Pos4: {
			Classification: "DEF3",
			x: Centerx,
			y: DEFy,
		},
		Pos5: {
			Classification: "DEF4",
			x: RightCenterOf5x,
			y: DEFy,
		},
		Pos6: {
			Classification: "DEF5",
			x: RightOf5x,
			y: DEFy,
		},
		Pos7: {
			Classification: "MID1",
			x: LeftOf4x,
			y: MIDy,
		},
		Pos8: {
			Classification: "MID2",
			x: LeftCenterOf4x,
			y: MIDy,
		},
		Pos9: {
			Classification: "MID3",
			x: RightCenterOf4x,
			y: MIDy,
		},
		Pos10: {
			Classification: "MID4",
			x: RightOf4x,
			y: MIDy,
		},
		Pos11: {
			Classification: "FWD1",
			x: Centerx,
			y: FWDy,
		},
	},
};

