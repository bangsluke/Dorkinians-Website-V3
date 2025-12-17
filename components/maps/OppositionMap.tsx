"use client";

import { useEffect, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

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
	const [markerLibrary, setMarkerLibrary] = useState<google.maps.MarkerLibrary | null>(null);
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

			try {
				// Import marker library for AdvancedMarkerElement
				const markerLibrary = await google.maps.importLibrary("marker") as google.maps.MarkerLibrary;
				if (markerLibrary && markerLibrary.AdvancedMarkerElement) {
					setMarkerLibrary(markerLibrary);
				} else {
					console.error("[OppositionMap] Marker library not properly loaded");
					return;
				}
			} catch (error) {
				console.error("[OppositionMap] Error loading marker library:", error);
				return;
			}

			// Validate MAP_ID for Advanced Markers
			const mapId = MAP_ID && MAP_ID !== "DEMO_MAP_ID" ? MAP_ID : undefined;
			
			const mapOptions: google.maps.MapOptions = {
				center: defaultCenter,
				zoom: defaultZoom,
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
			};

			// Only add mapId if it's valid (Advanced Markers require a valid map ID)
			if (mapId) {
				mapOptions.mapId = mapId;
			}

			const newMap = new google.maps.Map(mapRef.current, mapOptions);

			setMap(newMap);
			setInfoWindow(new google.maps.InfoWindow());
		});
	}, []);

	useEffect(() => {
		if (!map || oppositions.length === 0 || !markerLibrary) return;

		// Verify AdvancedMarkerElement is available and is a constructor
		if (!markerLibrary.AdvancedMarkerElement || typeof markerLibrary.AdvancedMarkerElement !== 'function') {
			console.error("[OppositionMap] AdvancedMarkerElement not available or not a constructor in marker library", markerLibrary);
			return;
		}

		// Ensure map is fully initialized
		if (!mapRef.current) {
			console.warn("[OppositionMap] Map not fully initialized");
			return;
		}

		// Check if map has a valid mapId (required for Advanced Markers)
		const mapId = (map as any).mapId;
		if (!mapId || mapId === "DEMO_MAP_ID") {
			console.warn("[OppositionMap] Map does not have a valid mapId, Advanced Markers may not work. Please configure NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID");
			// Continue anyway, but markers might fail
		}

		// Small delay to ensure map is fully ready
		const timeoutId = setTimeout(() => {
			try {
				// Clear existing markers
				markersRef.current.forEach((marker) => {
					if (marker) {
						marker.map = null;
					}
				});
				markersRef.current = [];

				if (clustererRef.current) {
					clustererRef.current.clearMarkers();
				}

				// Create Advanced Markers for each opposition
				const markers = oppositions.map((opposition) => {
					try {
						// Validate position values
						if (typeof opposition.lat !== 'number' || typeof opposition.lng !== 'number' || 
							isNaN(opposition.lat) || isNaN(opposition.lng)) {
							console.warn("[OppositionMap] Invalid position for opposition:", opposition);
							return null;
						}

						// Ensure map is ready and marker library is valid
						if (!map || !markerLibrary || !markerLibrary.AdvancedMarkerElement) {
							console.warn("[OppositionMap] Map or marker library not ready");
							return null;
						}

						// Create position object (use plain object for compatibility)
						const position = { lat: opposition.lat, lng: opposition.lng };
						
						// Only create AdvancedMarker if mapId is set, otherwise fallback to regular markers
						const markerOptions: google.maps.AdvancedMarkerElementOptions = {
							position: position,
							map: map,
							title: opposition.name || 'Unknown',
						};

						const marker = new markerLibrary.AdvancedMarkerElement(markerOptions);

						if (marker && marker.addListener) {
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
						}

						return marker;
					} catch (error) {
						console.error("[OppositionMap] Error creating marker:", error, opposition);
						return null;
					}
				}).filter((marker): marker is google.maps.marker.AdvancedMarkerElement => marker !== null);

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
						if (marker && marker.position) {
							const pos = marker.position as google.maps.LatLng;
							if (pos) {
								bounds.extend(pos);
							}
						}
					});
					map.fitBounds(bounds);
				}
			} catch (error) {
				console.error("[OppositionMap] Error creating markers:", error);
			}
		}, 100); // Small delay to ensure map is ready

		return () => {
			clearTimeout(timeoutId);
		};
	}, [map, oppositions, infoWindow, markerLibrary]);

	if (isLoading) {
		return (
			<SkeletonTheme baseColor="var(--skeleton-base)" highlightColor="var(--skeleton-highlight)">
				<div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 md:p-6">
					<Skeleton height={20} width="40%" className="mb-4" />
					<div className='relative' style={{ height: '400px' }}>
						<Skeleton height="100%" className="rounded-lg" />
						{/* Marker placeholders */}
						<div className='absolute inset-0'>
							<Skeleton circle height={20} width={20} style={{ position: 'absolute', top: '30%', left: '40%' }} />
							<Skeleton circle height={20} width={20} style={{ position: 'absolute', top: '50%', left: '60%' }} />
							<Skeleton circle height={20} width={20} style={{ position: 'absolute', top: '70%', left: '35%' }} />
							<Skeleton circle height={20} width={20} style={{ position: 'absolute', top: '45%', left: '75%' }} />
						</div>
					</div>
				</div>
			</SkeletonTheme>
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

	const topOpponent = oppositions.length > 0 ? oppositions[0] : null;

	return (
		<div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 md:p-6">
			<h3 className="text-white font-semibold text-sm md:text-base mb-4">Opposition Locations</h3>
			{topOpponent && (
				<div className="mb-4">
					<p className="text-white text-sm mb-2">Most played against opposition:</p>
					<p className="text-white/80 text-sm">{topOpponent.name} ({topOpponent.timesPlayed} matches played)</p>
				</div>
			)}
			<div ref={mapRef} style={{ width: "100%", height: "320px" }} className="rounded-lg overflow-hidden" />
		</div>
	);
}

export default OppositionMapComponent;

