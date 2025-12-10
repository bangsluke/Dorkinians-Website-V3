"use client";

import { PlayerData, PlayerFilters } from "@/lib/stores/navigation";
import { formatFilterSummary } from "@/lib/utils/shareUtils";
import { statObject } from "@/config/config";
import { BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, CartesianGrid } from "recharts";

interface ShareableStatsCardProps {
	playerName: string;
	playerData: PlayerData;
	playerFilters: PlayerFilters;
	filterData?: {
		seasons: Array<{ season: string; startDate: string; endDate: string }>;
		teams: Array<{ name: string }>;
		opposition: Array<{ name: string }>;
		competitions: Array<{ name: string; type: string }>;
	};
	selectedVisualization?: {
		type: string;
		data?: any;
	};
}

function toNumber(val: any): number {
	if (val === null || val === undefined) return 0;
	if (typeof val === "number") {
		if (isNaN(val)) return 0;
		return val;
	}
	if (typeof val === "object") {
		if ("toNumber" in val && typeof val.toNumber === "function") {
			return val.toNumber();
		}
		if ("low" in val && "high" in val) {
			const low = val.low || 0;
			const high = val.high || 0;
			return low + high * 4294967296;
		}
	}
	const num = Number(val);
	return isNaN(num) ? 0 : num;
}

function formatStatValue(value: any, statFormat: string, decimalPlaces: number, statUnit?: string): string {
	if (value === null || value === undefined) return "0";

	const numValue = toNumber(value);

	let formattedValue: string;
	switch (statFormat) {
		case "Integer":
			formattedValue = Math.round(numValue).toString();
			break;
		case "Decimal1":
			formattedValue = numValue.toFixed(1);
			break;
		case "Decimal2":
			formattedValue = numValue.toFixed(decimalPlaces);
			break;
		case "Percentage":
			formattedValue = `${Math.round(numValue)}%`;
			break;
		case "String":
			formattedValue = String(value);
			break;
		default:
			formattedValue = String(value);
	}

	return statUnit ? `${formattedValue} ${statUnit}` : formattedValue;
}

function renderVisualization(viz: { type: string; data?: any }) {
	const { type, data } = viz;

	switch (type) {
		case "seasonal-performance":
			if (!data || !data.chartData || data.chartData.length === 0) return null;
			return (
				<div style={{ width: "100%", height: "300px" }}>
					<ResponsiveContainer width="100%" height="100%">
						<BarChart data={data.chartData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
							<CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
							<XAxis dataKey="name" stroke="#fff" fontSize={14} />
							<YAxis stroke="#fff" fontSize={14} />
							<Bar dataKey="value" fill="#f9ed32" radius={[4, 4, 0, 0]} opacity={0.9} />
						</BarChart>
					</ResponsiveContainer>
				</div>
			);

		case "team-performance":
			if (!data || !data.chartData || data.chartData.length === 0) return null;
			return (
				<div style={{ width: "100%", height: "300px" }}>
					<ResponsiveContainer width="100%" height="100%">
						<BarChart data={data.chartData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
							<CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
							<XAxis dataKey="name" stroke="#fff" fontSize={14} />
							<YAxis stroke="#fff" fontSize={14} />
							<Bar dataKey="value" fill="#f9ed32" radius={[4, 4, 0, 0]} opacity={0.9} />
						</BarChart>
					</ResponsiveContainer>
				</div>
			);

		case "match-results":
			if (!data || !data.pieData || data.pieData.length === 0) return null;
			return (
				<div style={{ width: "100%", height: "300px" }}>
					<ResponsiveContainer width="100%" height="100%">
						<PieChart>
							<Pie
								data={data.pieData}
								cx="50%"
								cy="50%"
								labelLine={false}
								label={({ name, value }) => `${name}: ${value}`}
								outerRadius={100}
								fill="#8884d8"
								dataKey="value">
								{data.pieData.map((entry: any, index: number) => (
									<Cell key={`cell-${index}`} fill={entry.color} />
								))}
							</Pie>
						</PieChart>
					</ResponsiveContainer>
				</div>
			);

		case "positional-stats":
			if (!data) return null;
			return (
				<div style={{ width: "100%", textAlign: "center", color: "#fff" }}>
					<div style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "20px" }}>Positional Stats</div>
					<div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "20px" }}>
						{data.gk > 0 && (
							<div>
								<div style={{ fontSize: "36px", fontWeight: "bold", color: "#f9ed32" }}>{data.gk}</div>
								<div style={{ fontSize: "16px", color: "rgba(255,255,255,0.8)" }}>GK</div>
							</div>
						)}
						{data.def > 0 && (
							<div>
								<div style={{ fontSize: "36px", fontWeight: "bold", color: "#f9ed32" }}>{data.def}</div>
								<div style={{ fontSize: "16px", color: "rgba(255,255,255,0.8)" }}>DEF</div>
							</div>
						)}
						{data.mid > 0 && (
							<div>
								<div style={{ fontSize: "36px", fontWeight: "bold", color: "#f9ed32" }}>{data.mid}</div>
								<div style={{ fontSize: "16px", color: "rgba(255,255,255,0.8)" }}>MID</div>
							</div>
						)}
						{data.fwd > 0 && (
							<div>
								<div style={{ fontSize: "36px", fontWeight: "bold", color: "#f9ed32" }}>{data.fwd}</div>
								<div style={{ fontSize: "16px", color: "rgba(255,255,255,0.8)" }}>FWD</div>
							</div>
						)}
					</div>
				</div>
			);

		case "defensive-record":
			if (!data) return null;
			return (
				<div style={{ width: "100%", textAlign: "center", color: "#fff" }}>
					<div style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "20px" }}>Defensive Record</div>
					<div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "20px" }}>
						<div>
							<div style={{ fontSize: "36px", fontWeight: "bold", color: "#f9ed32" }}>{data.cleanSheets || 0}</div>
							<div style={{ fontSize: "16px", color: "rgba(255,255,255,0.8)" }}>Clean Sheets</div>
						</div>
						<div>
							<div style={{ fontSize: "36px", fontWeight: "bold", color: "#f9ed32" }}>{data.conceded || 0}</div>
							<div style={{ fontSize: "16px", color: "rgba(255,255,255,0.8)" }}>Goals Conceded</div>
						</div>
					</div>
				</div>
			);

		case "card-stats":
			if (!data) return null;
			return (
				<div style={{ width: "100%", textAlign: "center", color: "#fff" }}>
					<div style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "20px" }}>Card Stats</div>
					<div style={{ display: "flex", justifyContent: "center", gap: "40px" }}>
						<div>
							<div style={{ fontSize: "36px", fontWeight: "bold", color: "#f9ed32" }}>{data.yellowCards || 0}</div>
							<div style={{ fontSize: "16px", color: "rgba(255,255,255,0.8)" }}>Yellow Cards</div>
						</div>
						<div>
							<div style={{ fontSize: "36px", fontWeight: "bold", color: "#ef4444" }}>{data.redCards || 0}</div>
							<div style={{ fontSize: "16px", color: "rgba(255,255,255,0.8)" }}>Red Cards</div>
						</div>
					</div>
				</div>
			);

		case "penalty-stats":
			if (!data) return null;
			return (
				<div style={{ width: "100%", textAlign: "center", color: "#fff" }}>
					<div style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "20px" }}>Penalty Stats</div>
					<div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "20px" }}>
						<div>
							<div style={{ fontSize: "32px", fontWeight: "bold", color: "#22c55e" }}>{data.scored || 0}</div>
							<div style={{ fontSize: "14px", color: "rgba(255,255,255,0.8)" }}>Scored</div>
						</div>
						<div>
							<div style={{ fontSize: "32px", fontWeight: "bold", color: "#ef4444" }}>{data.missed || 0}</div>
							<div style={{ fontSize: "14px", color: "rgba(255,255,255,0.8)" }}>Missed</div>
						</div>
						<div>
							<div style={{ fontSize: "32px", fontWeight: "bold", color: "#60a5fa" }}>{data.saved || 0}</div>
							<div style={{ fontSize: "14px", color: "rgba(255,255,255,0.8)" }}>Saved</div>
						</div>
						<div>
							<div style={{ fontSize: "32px", fontWeight: "bold", color: "#f97316" }}>{data.conceded || 0}</div>
							<div style={{ fontSize: "14px", color: "rgba(255,255,255,0.8)" }}>Conceded</div>
						</div>
					</div>
				</div>
			);

		case "fantasy-points":
			if (!data || !data.totalPoints) return null;
			return (
				<div style={{ width: "100%", textAlign: "center", color: "#fff" }}>
					<div style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "10px" }}>Fantasy Points</div>
					<div style={{ fontSize: "48px", fontWeight: "bold", color: "#f9ed32", marginBottom: "20px" }}>
						{Math.round(data.totalPoints)}
					</div>
					{data.highestWeek && (
						<div style={{ fontSize: "16px", color: "rgba(255,255,255,0.8)" }}>
							Best Week: {data.highestWeek.points} pts
						</div>
					)}
				</div>
			);

		case "distance-travelled":
			if (!data || !data.distance) return null;
			return (
				<div style={{ width: "100%", textAlign: "center", color: "#fff" }}>
					<div style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "20px" }}>Distance Travelled</div>
					<div style={{ fontSize: "36px", fontWeight: "bold", color: "#f9ed32" }}>
						{data.distance.toLocaleString()} miles
					</div>
					<div style={{ fontSize: "16px", color: "rgba(255,255,255,0.8)", marginTop: "10px" }}>
						{data.awayGames} away games
					</div>
				</div>
			);

		case "minutes-per-stats":
			if (!data) return null;
			return (
				<div style={{ width: "100%", textAlign: "center", color: "#fff" }}>
					<div style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "20px" }}>Minutes per Stats</div>
					<div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "15px", fontSize: "14px" }}>
						{data.minutesPerGoal > 0 && (
							<div>
								<div style={{ fontSize: "28px", fontWeight: "bold", color: "#f9ed32" }}>
									{Math.round(data.minutesPerGoal).toLocaleString()}
								</div>
								<div style={{ color: "rgba(255,255,255,0.8)" }}>per Goal</div>
							</div>
						)}
						{data.minutesPerAssist > 0 && (
							<div>
								<div style={{ fontSize: "28px", fontWeight: "bold", color: "#f9ed32" }}>
									{Math.round(data.minutesPerAssist).toLocaleString()}
								</div>
								<div style={{ color: "rgba(255,255,255,0.8)" }}>per Assist</div>
							</div>
						)}
						{data.minutesPerMoM > 0 && (
							<div>
								<div style={{ fontSize: "28px", fontWeight: "bold", color: "#f9ed32" }}>
									{Math.round(data.minutesPerMoM).toLocaleString()}
								</div>
								<div style={{ color: "rgba(255,255,255,0.8)" }}>per MoM</div>
							</div>
						)}
						{data.minutesPerCleanSheet > 0 && (
							<div>
								<div style={{ fontSize: "28px", fontWeight: "bold", color: "#f9ed32" }}>
									{Math.round(data.minutesPerCleanSheet).toLocaleString()}
								</div>
								<div style={{ color: "rgba(255,255,255,0.8)" }}>per Clean Sheet</div>
							</div>
						)}
					</div>
				</div>
			);

		case "game-details":
			if (!data) return null;
			return (
				<div style={{ width: "100%", textAlign: "center", color: "#fff" }}>
					<div style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "20px" }}>Game Details</div>
					<div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "15px", fontSize: "14px" }}>
						<div>
							<div style={{ fontSize: "32px", fontWeight: "bold", color: "#f9ed32" }}>{data.uniqueOpponents || 0}</div>
							<div style={{ color: "rgba(255,255,255,0.8)" }}>Opponents</div>
						</div>
						<div>
							<div style={{ fontSize: "32px", fontWeight: "bold", color: "#f9ed32" }}>{data.uniqueCompetitions || 0}</div>
							<div style={{ color: "rgba(255,255,255,0.8)" }}>Competitions</div>
						</div>
						<div>
							<div style={{ fontSize: "32px", fontWeight: "bold", color: "#f9ed32" }}>{data.uniqueTeammates || 0}</div>
							<div style={{ color: "rgba(255,255,255,0.8)" }}>Teammates</div>
						</div>
					</div>
				</div>
			);

		default:
			return null;
	}
}

export default function ShareableStatsCard({
	playerName,
	playerData,
	playerFilters,
	filterData,
	selectedVisualization,
}: ShareableStatsCardProps) {
	const filterSummary = formatFilterSummary(playerFilters, filterData);

	// Key stats to display
	const keyStats = [
		{
			key: "APP",
			label: "Apps",
			value: toNumber(playerData.appearances),
			icon: statObject.APP?.iconName || "Appearance-Icon",
		},
		{
			key: "MIN",
			label: "Minutes",
			value: toNumber(playerData.minutes),
			icon: statObject.MIN?.iconName || "Appearance-Icon",
			format: (val: number) => Math.round(val).toLocaleString(),
		},
		{
			key: "AllGSC",
			label: "Goals",
			value: toNumber(playerData.allGoalsScored),
			icon: statObject.AllGSC?.iconName || "Appearance-Icon",
		},
		{
			key: "A",
			label: "Assists",
			value: toNumber(playerData.assists),
			icon: statObject.A?.iconName || "Appearance-Icon",
		},
		{
			key: "MOM",
			label: "MoM",
			value: toNumber(playerData.mom),
			icon: statObject.MOM?.iconName || "Appearance-Icon",
		},
	];

	return (
		<div
			className="shareable-stats-card"
			style={{
				width: "1080px",
				height: "1080px",
				backgroundColor: "#0f0f0f",
				position: "relative",
				overflow: "hidden",
				fontFamily: "system-ui, -apple-system, sans-serif",
				boxSizing: "border-box",
			}}>
			{/* Background gradient overlay */}
			<div
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					right: 0,
					bottom: 0,
					background: "linear-gradient(135deg, rgba(249, 237, 50, 0.1) 0%, rgba(249, 237, 50, 0.05) 50%, transparent 100%)",
					pointerEvents: "none",
				}}
			/>

			{/* Logo in top right corner */}
			<div
				style={{
					position: "absolute",
					top: "30px",
					right: "30px",
					zIndex: 2,
					transform: "rotate(15deg)",
					opacity: 0.15,
				}}>
				<img
					src={`${typeof window !== 'undefined' ? window.location.origin : ''}/icons/icon-512x512.png`}
					alt="Dorkinians FC Logo"
					style={{
						width: "200px",
						height: "200px",
						filter: "brightness(0) invert(1)",
						objectFit: "contain",
					}}
					crossOrigin="anonymous"
					loading="eager"
				/>
			</div>

			{/* Content */}
			<div
				style={{
					position: "relative",
					zIndex: 1,
					padding: "50px",
					height: "100%",
					display: "flex",
					flexDirection: "column",
				}}>
				{/* Header */}
				<div style={{ flexShrink: 0 }}>
					{/* Player Name */}
					<h1
						style={{
							fontSize: "64px",
							fontWeight: "bold",
							color: "#f9ed32",
							margin: "0 0 16px 0",
							lineHeight: "1.1",
						}}>
						{playerName}
					</h1>

					{/* Filter Summary */}
					<div
						style={{
							fontSize: "20px",
							color: "rgba(255, 255, 255, 0.7)",
							marginBottom: "30px",
							lineHeight: "1.4",
						}}>
						{filterSummary}
					</div>
				</div>

				{/* Selected Visualization */}
				{selectedVisualization && (
					<div
						style={{
							flex: "1",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							marginBottom: "20px",
							minHeight: "280px",
							maxHeight: "380px",
						}}>
						{renderVisualization(selectedVisualization)}
					</div>
				)}

				{/* Stats Grid */}
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(5, 1fr)",
						gap: "30px",
						marginTop: selectedVisualization ? "0" : "auto",
						marginBottom: "20px",
						flexShrink: 0,
					}}>
					{keyStats.map((stat) => (
						<div
							key={stat.key}
							style={{
								display: "flex",
								flexDirection: "column",
								alignItems: "center",
								gap: "16px",
							}}>
							{/* Icon */}
							<div
								style={{
									width: "70px",
									height: "70px",
									display: "flex",
									alignItems: "center",
									justifyContent: "center",
									backgroundColor: "rgba(249, 237, 50, 0.1)",
									borderRadius: "12px",
									border: "2px solid rgba(249, 237, 50, 0.3)",
								}}>
								<img
									src={`${typeof window !== 'undefined' ? window.location.origin : ''}/stat-icons/${stat.icon}.svg`}
									alt={stat.label}
									style={{
										width: "42px",
										height: "42px",
										filter: "brightness(0) invert(1)",
										objectFit: "contain",
									}}
									crossOrigin="anonymous"
									loading="eager"
									onError={(e) => {
										// Hide icon if it fails to load
										(e.target as HTMLImageElement).style.display = "none";
									}}
								/>
							</div>

							{/* Value */}
							<div
								style={{
									fontSize: "42px",
									fontWeight: "bold",
									color: "#ffffff",
									textAlign: "center",
									lineHeight: "1",
								}}>
								{stat.format ? stat.format(stat.value) : stat.value.toLocaleString()}
							</div>

							{/* Label */}
							<div
								style={{
									fontSize: "18px",
									color: "rgba(255, 255, 255, 0.8)",
									textAlign: "center",
									fontWeight: "500",
								}}>
								{stat.label}
							</div>
						</div>
					))}
				</div>

				{/* Footer */}
				<div
					style={{
						paddingTop: "20px",
						borderTop: "2px solid rgba(249, 237, 50, 0.3)",
						display: "flex",
						justifyContent: "space-between",
						alignItems: "center",
					}}>
					<div
						style={{
							fontSize: "24px",
							fontWeight: "bold",
							color: "#f9ed32",
						}}>
						Dorkinians FC
					</div>
					<div
						style={{
							fontSize: "18px",
							color: "rgba(255, 255, 255, 0.6)",
						}}>
						dorkiniansfcstats.co.uk
					</div>
				</div>
			</div>
		</div>
	);
}

