import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
	MapContainer,
	Polyline,
	ImageOverlay,
	useMap,
	ZoomControl,
	useMapEvents,
	Marker,
} from "react-leaflet";
import L, { LatLngTuple } from "leaflet";
import "leaflet/dist/leaflet.css";
import { City, Nation } from "../../types";
import CityMarker from "./CityMarker";
import { useMapData } from "../../context/MapContext";
import {useUserInteraction} from "../../context/UserInteractionContext";
import { useHover, EMPTY_HIGHLIGHT } from "../../context/HoverContext";
import VoronoiLayer from './VoronoiLayer';
import { VoronoiGeometry } from "../Timelapse/TimelapseView";
import { mapBounds, MAX_MAP_BOUNDS } from "../../constants";
import TimelapseVoronoiLayer from "./TimelapseVoronoiLayer";
import { useUIView } from "../../context/UIViewContext";
import { useMediaQuery } from "../../hooks/useMediaQuery";

// Leaflet default icon issue fix
import iconRetinaUrl from "leaflet/dist/images/marker-icon-2x.png";
import iconUrl from "leaflet/dist/images/marker-icon.png";
import shadowUrl from "leaflet/dist/images/marker-shadow.png";

L.Icon.Default.mergeOptions({
	iconRetinaUrl,
	iconUrl,
	shadowUrl,
});

interface MapControllerProps {
	mapView: { center: LatLngTuple; zoom: number } | null;
	onMapViewComplete: () => void;
	isAnimating: boolean;
	onAnimationEnd: () => void;
	onMapClick: () => void;
	onZoomChange: (zoom: number) => void;
}

/**
 * Declared at module scope on purpose. Defining it inside MapComponent made it
 * a brand new component type on every render, so React unmounted and remounted
 * it — re-running its effects and re-binding every map event handler.
 */
const MapController: React.FC<MapControllerProps> = ({
	mapView,
	onMapViewComplete,
	isAnimating,
	onAnimationEnd,
	onMapClick,
	onZoomChange,
}) => {
	const map = useMap();

	useEffect(() => {
		if (mapView) {
			map.flyTo(mapView.center, mapView.zoom);
			onMapViewComplete();
		}
	}, [map, mapView, onMapViewComplete]);

	useEffect(() => {
		onZoomChange(map.getZoom());
	}, [map, onZoomChange]);

	useMapEvents({
		zoomend: () => onZoomChange(map.getZoom()),
		click: () => onMapClick(),
		moveend: () => { if (isAnimating) onAnimationEnd(); },
	});

	return null;
};

interface MapComponentProps {
	// Callbacks from parent
	onCityClick: (city: City) => void;
	onMapClick: () => void;
	// Special-case props for different modes
	isTimelapse?: boolean;
	voronoiGeometry?: VoronoiGeometry | null;
	// Optional data overrides for timelapse mode
	cities?: City[];
	nations?: Nation[];
}

const MapComponent: React.FC<MapComponentProps> = ({
													   onCityClick,
													   onMapClick,
													   isTimelapse = false,
													   voronoiGeometry,
													   cities: historicalCities,
													   nations: historicalNations,
												   }) => {
	// --- Fetch data and state from contexts ---
	const {
		cities: liveCities,
		paths,
		nations: liveNations,
	} = useMapData();

	const {
		hoveredCityId,
		highlightedCityIds,
		setHoveredCityId,
		setHighlightedCityIds,
	} = useHover();

	const {
		mapView,
		onMapViewComplete,
		isAnimating,
		onAnimationEnd,
		userRoutes,
		cityMarkers
	} = useUserInteraction();

	const { isVoronoiVisible, isTacticalMode, isAirRoutesVisible, isPathsVisible } = useUIView();

	// --- Determine which data to use (live vs. historical) ---
	const cities = historicalCities || liveCities;
	const nations = historicalNations || liveNations;

	const [hoveredRouteId, setHoveredRouteId] = useState<string | null>(null);

	const MAX_Y = mapBounds[1][0];
	const isDesktop = useMediaQuery('(min-width: 1024px)');
	const [currentZoom, setCurrentZoom] = useState(isDesktop ? -3 : -4);

	const handleZoomChange = useCallback((zoom: number) => setCurrentZoom(zoom), []);

	// Stable identities so React.memo on CityMarker actually holds.
	const handleMouseOver = useCallback((cityId: number) => {
		setHoveredCityId(cityId);
		const connected = new Set<number>();
		for (const p of paths) {
			if (p.type !== "air") continue;
			if (p.from === cityId) connected.add(p.to);
			else if (p.to === cityId) connected.add(p.from);
		}
		setHighlightedCityIds(connected);
	}, [paths, setHoveredCityId, setHighlightedCityIds]);

	const handleMouseOut = useCallback(() => {
		setHoveredCityId(null);
		setHighlightedCityIds(EMPTY_HIGHLIGHT);
	}, [setHoveredCityId, setHighlightedCityIds]);

	const cityMap = useMemo(() => new Map(cities.map(city => [city.id, city])), [cities]);

	// Ground routes never depend on hover, so they are memoised separately from
	// air routes. Hovering a city used to rebuild all ~480 polylines.
	const groundPathLines = useMemo(() => {
		if (!isPathsVisible) return [];
		const lines: React.ReactElement[] = [];

		paths.forEach((path, index) => {
			if (path.type === "air") return;
			const fromCity = cityMap.get(path.from);
			const toCity = cityMap.get(path.to);
			if (!fromCity || !toCity) return;

			let color = "rgba(255, 255, 255, 0.8)";
			let weight = 2;
			let dashArray: string | undefined;
			let opacity = 0.8;

			switch (path.type) {
				case "rail": weight = 4; dashArray = undefined; break;
				case "road": weight = 2; dashArray = "4, 4"; break;
				case "sea": color = "#00BFFF"; weight = 2; dashArray = "12, 6, 3, 6"; opacity = 0.6; break;
			}

			lines.push(
				<Polyline
					key={`path-${index}`}
					positions={[
						[MAX_Y - fromCity.y_position, fromCity.x_position],
						[MAX_Y - toCity.y_position, toCity.x_position],
					]}
					pathOptions={{ color, weight, dashArray, opacity }}
				/>
			);
		});

		return lines;
	}, [paths, cityMap, MAX_Y, isPathsVisible]);

	// Only the ~22 air routes react to hover, so this rebuild is cheap.
	const airPathLines = useMemo(() => {
		const lines: React.ReactElement[] = [];

		paths.forEach((path, index) => {
			if (path.type !== "air") return;
			const fromCity = cityMap.get(path.from);
			const toCity = cityMap.get(path.to);
			if (!fromCity || !toCity) return;

			const isHovered = hoveredCityId === fromCity.id || hoveredCityId === toCity.id;
			if (!isAirRoutesVisible && !isHovered) return;

			lines.push(
				<Polyline
					key={`path-${index}`}
					positions={[
						[MAX_Y - fromCity.y_position, fromCity.x_position],
						[MAX_Y - toCity.y_position, toCity.x_position],
					]}
					pathOptions={{
						color: "#FFD700",
						weight: isHovered ? 3 : 2,
						dashArray: "10, 10",
						opacity: isHovered ? 0.9 : 0.55,
					}}
				/>
			);
		});

		return lines;
	}, [paths, cityMap, MAX_Y, isAirRoutesVisible, hoveredCityId]);

	const userRouteLines = useMemo(() => {
		return userRoutes.map(route => {
			const fromCity = cityMap.get(route.from);
			const toCity = cityMap.get(route.to);
			if (!fromCity || !toCity) return null;

			const fromPos: LatLngTuple = [MAX_Y - fromCity.y_position, fromCity.x_position];
			const toPos: LatLngTuple = [MAX_Y - toCity.y_position, toCity.x_position];

			const angle = Math.atan2(fromPos[1] - toPos[1], fromPos[0] - toPos[0]) * (180 / Math.PI) + 180;

			const arrowIcon = L.divIcon({
				className: 'user-route-arrow',
				html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24px" height="24px">
                        <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" fill="${route.color}" transform="rotate(${angle} 12 12)"/>
                    </svg>`,
				iconSize: [24, 24],
				iconAnchor: [12, 12]
			});

			const midPoint: LatLngTuple = [(fromPos[0] + toPos[0]) / 2, (fromPos[1] + toPos[1]) / 2];
			const isHovered = route.id === hoveredRouteId;

			return (
				<React.Fragment key={route.id}>
					<Polyline
						positions={[fromPos, toPos]}
						pathOptions={{ color: route.color, weight: isHovered ? 7 : 4, opacity: 0.9 }}
						eventHandlers={{
							mouseover: () => setHoveredRouteId(route.id),
							mouseout: () => setHoveredRouteId(null)
						}}
					/>
					<Marker position={midPoint} icon={arrowIcon} interactive={false} />
				</React.Fragment>
			);
		}).filter(Boolean);
	}, [userRoutes, cityMap, MAX_Y, hoveredRouteId]);

	return (
		<MapContainer
			center={[MAX_Y / 2, mapBounds[1][1] / 2]}
			zoom={isDesktop ? -3 : -4}
			minZoom={isDesktop ? -3 : -4}
			maxZoom={0}
			maxBounds={MAX_MAP_BOUNDS}
			zoomSnap={0.1}
			zoomDelta={0.25}
			zoomAnimation={false}
			wheelDebounceTime={10}
			crs={L.CRS.Simple}
			style={{ height: "100%", width: "100%" }}
			scrollWheelZoom={true}
			zoomControl={false}
			preferCanvas={true}
		>
			<ZoomControl position="bottomright" />
			<MapController
				mapView={mapView}
				onMapViewComplete={onMapViewComplete}
				isAnimating={isAnimating}
				onAnimationEnd={onAnimationEnd}
				onMapClick={onMapClick}
				onZoomChange={handleZoomChange}
			/>
			<ImageOverlay url="/map.png" bounds={mapBounds} />

			{isVoronoiVisible && (
				isTimelapse && voronoiGeometry ? (
					<TimelapseVoronoiLayer geometry={voronoiGeometry} cities={cities} nations={nations} />
				) : (
					<VoronoiLayer
						cities={cities}
						nations={nations}
						mapImageBounds={mapBounds as [[number, number], [number, number]]}
						isTacticalMode={isTacticalMode}
						cityMarkers={cityMarkers}
					/>
				)
			)}

			{groundPathLines}
			{airPathLines}
			{userRouteLines}
			{cities.map((city) => (
				<CityMarker
					key={city.id}
					city={city}
					currentZoom={currentZoom}
					isHovered={hoveredCityId === city.id}
					isHighlighted={highlightedCityIds.has(city.id)}
					onCityClick={onCityClick}
					onMouseOver={handleMouseOver}
					onMouseOut={handleMouseOut}
				/>
			))}
		</MapContainer>
	);
};

export default MapComponent;
