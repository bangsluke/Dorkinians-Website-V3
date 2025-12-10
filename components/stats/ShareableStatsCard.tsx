"use client";

import { PlayerData, PlayerFilters } from "@/lib/stores/navigation";
import { formatFilterSummary } from "@/lib/utils/shareUtils";
import { statObject } from "@/config/config";

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

export default function ShareableStatsCard({
	playerName,
	playerData,
	playerFilters,
	filterData,
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

			{/* Content */}
			<div
				style={{
					position: "relative",
					zIndex: 1,
					padding: "50px",
					height: "100%",
					display: "flex",
					flexDirection: "column",
					justifyContent: "space-between",
				}}>
				{/* Header */}
				<div>
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

				{/* Stats Grid */}
				<div
					style={{
						display: "grid",
						gridTemplateColumns: "repeat(5, 1fr)",
						gap: "30px",
						marginTop: "auto",
						marginBottom: "30px",
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
						dorkiniansfc.co.uk
					</div>
				</div>
			</div>
		</div>
	);
}

