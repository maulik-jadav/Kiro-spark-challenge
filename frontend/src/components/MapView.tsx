"use client";

import { useEffect, useState, useMemo } from "react";
import { APIProvider, Map, AdvancedMarker, useMap } from "@vis.gl/react-google-maps";
import type { RouteComparison } from "@/types/api";

interface MapViewProps {
  origin: string | null;
  destination: string | null;
  routeComparison?: RouteComparison | null;
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const DEFAULT_CENTER = { lat: 37.0902, lng: -95.7129 };
const DEFAULT_ZOOM = 4;

/**
 * Decode a Google Encoded Polyline string into an array of {lat, lng} coordinates.
 * Implements the Encoded Polyline Algorithm:
 * https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
export function decodePolyline(encoded: string): { lat: number; lng: number }[] {
  const points: { lat: number; lng: number }[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    // Decode latitude
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    // Decode longitude
    result = 0;
    shift = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
}

/**
 * Side-effect component that renders a Google Maps Polyline on the map.
 * Uses the useMap() hook to get the map instance and creates/cleans up
 * a google.maps.Polyline imperatively.
 */
function CategoryPolyline({
  encodedPolyline,
  color,
  strokeWeight,
  opacity,
}: {
  encodedPolyline: string;
  color: string;
  strokeWeight: number;
  opacity: number;
}) {
  const map = useMap();

  useEffect(() => {
    if (!map || !encodedPolyline) return;

    const path = decodePolyline(encodedPolyline);
    const polyline = new google.maps.Polyline({
      path,
      strokeColor: color,
      strokeWeight,
      strokeOpacity: opacity,
      map,
    });

    return () => {
      polyline.setMap(null);
    };
  }, [map, encodedPolyline, color, strokeWeight, opacity]);

  return null;
}

/**
 * Side-effect component that fits the map bounds to show all polyline paths.
 */
function PolylineBoundsFitter({
  routeComparison,
}: {
  routeComparison: RouteComparison;
}) {
  const map = useMap();

  const allPoints = useMemo(() => {
    const points: { lat: number; lng: number }[] = [];
    const categories = [
      routeComparison.greenest,
      routeComparison.recommended_route,
      routeComparison.fastest,
    ];
    for (const route of categories) {
      if (route?.polyline) {
        points.push(...decodePolyline(route.polyline));
      }
    }
    return points;
  }, [routeComparison]);

  useEffect(() => {
    if (!map || allPoints.length === 0) return;

    const bounds = new google.maps.LatLngBounds();
    for (const point of allPoints) {
      bounds.extend(point);
    }
    map.fitBounds(bounds);
  }, [map, allPoints]);

  return null;
}

export default function MapView({ origin, destination, routeComparison }: MapViewProps) {
  if (!API_KEY) {
    return (
      <div className="w-full h-full min-h-[300px] bg-surface-dim flex items-center justify-center">
        <div className="text-center text-on-surface-variant">
          <span className="material-symbols-outlined text-5xl text-outline-variant block mb-2">map</span>
          <p className="text-sm">Map unavailable — no API key configured.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[300px] lg:min-h-screen relative">
      {/* Subtle dot grid overlay like the Stitch design */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none z-10"
        style={{
          backgroundImage: "radial-gradient(#191c1e 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />
      <APIProvider apiKey={API_KEY}>
        <Map
          style={{ width: "100%", height: "100%", minHeight: "300px" }}
          defaultCenter={DEFAULT_CENTER}
          defaultZoom={DEFAULT_ZOOM}
          mapId={process.env.NEXT_PUBLIC_GOOGLE_MAP_ID ?? "DEMO_MAP_ID"}
          gestureHandling="cooperative"
          disableDefaultUI={false}
        >
          {origin && <GeocodedMarker address={origin} color="#00352e" label="A" />}
          {destination && <GeocodedMarker address={destination} color="#ba1a1a" label="B" />}

          {/* Render category polylines — only one color per unique route */}
          {(() => {
            if (!routeComparison) return null;
            // Deduplicate: if multiple categories share the same polyline, render once
            // Priority order for color: greenest > fastest > recommended
            const rendered = new Set<string>();
            const polylines: { encoded: string; color: string }[] = [];

            const greenestPoly = routeComparison.greenest?.polyline;
            const fastestPoly = routeComparison.fastest?.polyline;
            const recommendedPoly = routeComparison.recommended_route?.polyline;

            if (greenestPoly && !rendered.has(greenestPoly)) {
              polylines.push({ encoded: greenestPoly, color: "#16a34a" }); // green
              rendered.add(greenestPoly);
            }
            if (fastestPoly && !rendered.has(fastestPoly)) {
              polylines.push({ encoded: fastestPoly, color: "#f59e0b" }); // amber
              rendered.add(fastestPoly);
            }
            if (recommendedPoly && !rendered.has(recommendedPoly)) {
              polylines.push({ encoded: recommendedPoly, color: "#6366f1" }); // indigo
              rendered.add(recommendedPoly);
            }

            return polylines.map((p, i) => (
              <CategoryPolyline
                key={`polyline-${i}`}
                encodedPolyline={p.encoded}
                color={p.color}
                strokeWeight={4}
                opacity={0.8}
              />
            ));
          })()}

          {/* Auto-fit map bounds to show all polylines */}
          {routeComparison && <PolylineBoundsFitter routeComparison={routeComparison} />}
        </Map>
      </APIProvider>

      {/* Map zoom controls overlay */}
      <div className="absolute top-md right-md flex flex-col gap-sm z-20">
        <div className="flex flex-col bg-surface-container-lowest border border-outline-variant rounded shadow-sm overflow-hidden">
          <button className="p-sm hover:bg-surface-container-low text-on-surface-variant flex items-center justify-center border-b border-outline-variant">
            <span className="material-symbols-outlined text-[18px]">add</span>
          </button>
          <button className="p-sm hover:bg-surface-container-low text-on-surface-variant flex items-center justify-center">
            <span className="material-symbols-outlined text-[18px]">remove</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function GeocodedMarker({
  address,
  color,
  label,
}: {
  address: string;
  color: string;
  label: string;
}) {
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!address || typeof window === "undefined" || !window.google) return;
    const geocoder = new window.google.maps.Geocoder();
    geocoder.geocode({ address }, (results, status) => {
      if (status === "OK" && results && results[0]) {
        const loc = results[0].geometry.location;
        setPos({ lat: loc.lat(), lng: loc.lng() });
      }
    });
  }, [address]);

  if (!pos) return null;

  return (
    <AdvancedMarker position={pos}>
      <div
        style={{ background: color }}
        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-md border-2 border-white"
      >
        {label}
      </div>
    </AdvancedMarker>
  );
}
