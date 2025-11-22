"use client";

import { useEffect, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { MarkerClusterer } from "@googlemaps/markerclusterer";

interface OppositionLocation {
	name: string;
	address: string;
	lat: number;
	lng: number;
	timesPlayed: number;
}

interface OppositionMapProps {
	oppositions: OppositionLocation[];
	isLoading?: boolean;
}

const defaultCenter = {
	lat: 51.5074,
	lng: -0.1278,
};

const defaultZoom = 8;

// Map ID is required for Advanced Markers
// You need to create one in Google Cloud Console: https://console.cloud.google.com/google/maps-apis/studio/maps
const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || "DEMO_MAP_ID";

function OppositionMapComponent({ oppositions, isLoading }: OppositionMapProps) {
	const [selectedOpposition, setSelectedOpposition] = useState<OppositionLocation | null>(null);
	const [map, setMap] = useState<google.maps.Map | null>(null);
	const [infoWindow, setInfoWindow] = useState<google.maps.InfoWindow | null>(null);
	const [markerLibrary, setMarkerLibrary] = useState<typeof google.maps.marker | null>(null);
	const mapRef = useRef<HTMLDivElement>(null);
	const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
	const clustererRef = useRef<MarkerClusterer | null>(null);
	const loaderRef = useRef<Loader | null>(null);

	useEffect(() => {
		const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
		if (!apiKey || !mapRef.current) return;

		// Initialize loader
		if (!loaderRef.current) {
			loaderRef.current = new Loader({
				apiKey,
				version: "weekly",
				libraries: ["marker"],
			});
		}

		// Load map and marker library
		loaderRef.current.load().then(async () => {
			if (!mapRef.current) return;

			// Import marker library for AdvancedMarkerElement
			const { AdvancedMarkerElement } = await google.maps.importLibrary("marker") as google.maps.MarkerLibrary;
			setMarkerLibrary(google.maps.marker);

			const newMap = new google.maps.Map(mapRef.current, {
				center: defaultCenter,
				zoom: defaultZoom,
				mapId: MAP_ID,
				styles: [
					{
						featureType: "all",
						elementType: "labels.text.fill",
						stylers: [{ color: "#ffffff" }],
					},
					{
						featureType: "all",
						elementType: "labels.text.stroke",
						stylers: [{ color: "#000000" }, { visibility: "on" }],
					},
					{
						featureType: "landscape",
						elementType: "geometry.fill",
						stylers: [{ color: "#1a1a1a" }],
					},
					{
						featureType: "water",
						elementType: "geometry.fill",
						stylers: [{ color: "#2d2d2d" }],
					},
				],
				disableDefaultUI: false,
				zoomControl: true,
				streetViewControl: false,
				fullscreenControl: true,
			});

			setMap(newMap);
			setInfoWindow(new google.maps.InfoWindow());
		});
	}, []);

	useEffect(() => {
		if (!map || oppositions.length === 0 || !markerLibrary) return;

		// Clear existing markers
		markersRef.current.forEach((marker) => {
			marker.map = null;
		});
		markersRef.current = [];

		if (clustererRef.current) {
			clustererRef.current.clearMarkers();
		}

		// Create Advanced Markers for each opposition
		const markers = oppositions.map((opposition) => {
			const marker = new markerLibrary.AdvancedMarkerElement({
				position: { lat: opposition.lat, lng: opposition.lng },
				map: map,
				title: opposition.name,
			});

			marker.addListener("click", () => {
				setSelectedOpposition(opposition);
				if (infoWindow) {
					const content = `
						<div style="padding: 8px; color: #000;">
							<h4 style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">${opposition.name}</h4>
							<p style="font-size: 12px; color: #666; margin-bottom: 4px;">${opposition.address}</p>
							<p style="font-size: 12px; color: #888;">Played ${opposition.timesPlayed} time${opposition.timesPlayed !== 1 ? "s" : ""}</p>
						</div>
					`;
					infoWindow.setContent(content);
					infoWindow.open(map, marker);
				}
			});

			return marker;
		});

		markersRef.current = markers;

		// Create clusterer with Advanced Markers
		if (markers.length > 0) {
			clustererRef.current = new MarkerClusterer({
				map,
				markers,
			});
		}

		// Fit bounds to show all markers
		if (markers.length > 0) {
			const bounds = new google.maps.LatLngBounds();
			markers.forEach((marker) => {
				if (marker.position) {
					const pos = marker.position as google.maps.LatLng;
					bounds.extend(pos);
				}
			});
			map.fitBounds(bounds);
		}
	}, [map, oppositions, infoWindow, markerLibrary]);

	if (isLoading) {
		return (
			<div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 md:p-6">
				<h3 className="text-white font-semibold text-sm md:text-base mb-4">Opposition Locations</h3>
				<div className="flex items-center justify-center h-96">
					<div className="text-white/60 text-sm">Loading map...</div>
				</div>
			</div>
		);
	}

	if (oppositions.length === 0) {
		return null;
	}

	const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

	if (!apiKey) {
		return (
			<div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 md:p-6">
				<h3 className="text-white font-semibold text-sm md:text-base mb-4">Opposition Locations</h3>
				<div className="text-white/60 text-sm">
					Google Maps API key is not configured. Please add NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to your environment variables.
				</div>
			</div>
		);
	}

	return (
		<div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 md:p-6">
			<h3 className="text-white font-semibold text-sm md:text-base mb-4">Opposition Locations</h3>
			<div ref={mapRef} style={{ width: "100%", height: "320px" }} className="rounded-lg overflow-hidden" />
		</div>
	);
}

export default OppositionMapComponent;

