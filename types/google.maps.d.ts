// Type declarations for Google Maps API
// This ensures the google namespace is available during TypeScript compilation

declare namespace google {
	namespace maps {
		class Map {
			constructor(element: HTMLElement | null, opts?: MapOptions);
			setCenter(latlng: LatLng | LatLngLiteral): void;
			setZoom(zoom: number): void;
			fitBounds(bounds: LatLngBounds): void;
		}

		class InfoWindow {
			constructor(opts?: InfoWindowOptions);
			setContent(content: string | Node): void;
			open(map?: Map | StreetViewPanorama, anchor?: MVCObject): void;
			close(): void;
		}

		class LatLngBounds {
			constructor(sw?: LatLng | LatLngLiteral, ne?: LatLng | LatLngLiteral);
			extend(point: LatLng | LatLngLiteral): void;
		}

		interface MapOptions {
			center?: LatLng | LatLngLiteral;
			zoom?: number;
			mapId?: string;
			styles?: MapTypeStyle[];
			disableDefaultUI?: boolean;
			zoomControl?: boolean;
			streetViewControl?: boolean;
			fullscreenControl?: boolean;
		}

		interface InfoWindowOptions {
			content?: string | Node;
			position?: LatLng | LatLngLiteral;
		}

		interface LatLng {
			lat(): number;
			lng(): number;
		}

		interface LatLngLiteral {
			lat: number;
			lng: number;
		}

		interface MapTypeStyle {
			featureType?: string;
			elementType?: string;
			stylers?: Array<Record<string, any>>;
		}

		interface MVCObject {
			[key: string]: any;
		}

		interface StreetViewPanorama {
			[key: string]: any;
		}

		class AdvancedMarkerElement {
			position?: LatLng | LatLngLiteral;
			map?: Map | null;
			title?: string;
			constructor(opts?: AdvancedMarkerElementOptions);
			addListener(eventName: string, handler: Function): void;
		}

		interface AdvancedMarkerElementOptions {
			position?: LatLng | LatLngLiteral;
			map?: Map;
			title?: string;
		}

		namespace marker {
			class AdvancedMarkerElement {
				position?: LatLng | LatLngLiteral;
				map?: Map | null;
				title?: string;
				constructor(opts?: AdvancedMarkerElementOptions);
				addListener(eventName: string, handler: Function): void;
			}
		}

		const marker: {
			AdvancedMarkerElement: typeof marker.AdvancedMarkerElement;
		};

		interface MarkerLibrary {
			AdvancedMarkerElement: typeof AdvancedMarkerElement;
		}

		function importLibrary(libraryName: string): Promise<MarkerLibrary>;
	}
}
