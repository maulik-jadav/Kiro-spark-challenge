"use client";

import { useEffect, useState } from "react";
import { APIProvider, Map, AdvancedMarker } from "@vis.gl/react-google-maps";

interface MapViewProps {
  origin: string | null;
  destination: string | null;
}

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const DEFAULT_CENTER = { lat: 37.0902, lng: -95.7129 };
const DEFAULT_ZOOM = 4;

const MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#ebe3cd" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#523735" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#f5f1e6" }] },
  { featureType: "administrative", elementType: "geometry.stroke", stylers: [{ color: "#c9b2a6" }] },
  { featureType: "administrative.land_parcel", elementType: "geometry.stroke", stylers: [{ color: "#dcd2be" }] },
  { featureType: "administrative.land_parcel", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "administrative.land_parcel", elementType: "labels.text.fill", stylers: [{ color: "#ae9e90" }] },
  { featureType: "landscape.natural", elementType: "geometry", stylers: [{ color: "#dfd2ae" }] },
  { featureType: "landscape.natural", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "poi", elementType: "geometry", stylers: [{ color: "#dfd2ae" }] },
  { featureType: "poi", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "poi", elementType: "labels.text", stylers: [{ visibility: "off" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#93817c" }] },
  { featureType: "poi.business", stylers: [{ visibility: "off" }] },
  { featureType: "poi.medical", elementType: "geometry", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "geometry.fill", stylers: [{ color: "#a5b076" }] },
  { featureType: "poi.park", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "labels.text", stylers: [{ visibility: "off" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#447530" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#f5f1e6" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#fdfcf8" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#f8c967" }] },
  { featureType: "road.highway", elementType: "geometry.stroke", stylers: [{ color: "#e9bc62" }] },
  { featureType: "road.highway.controlled_access", elementType: "geometry", stylers: [{ color: "#e98d58" }] },
  { featureType: "road.highway.controlled_access", elementType: "geometry.stroke", stylers: [{ color: "#db8555" }] },
  { featureType: "road.local", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "road.local", elementType: "labels.text.fill", stylers: [{ color: "#806b63" }] },
  { featureType: "transit.line", elementType: "geometry", stylers: [{ color: "#dfd2ae" }] },
  { featureType: "transit.line", elementType: "labels.text.fill", stylers: [{ color: "#8f7d77" }] },
  { featureType: "transit.line", elementType: "labels.text.stroke", stylers: [{ color: "#ebe3cd" }] },
  { featureType: "transit.station", elementType: "geometry", stylers: [{ color: "#dfd2ae" }] },
  { featureType: "water", elementType: "geometry.fill", stylers: [{ color: "#b9d3c2" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#92998d" }] },
];

export default function MapView({ origin, destination }: MapViewProps) {
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
          styles={MAP_STYLES}
          gestureHandling="cooperative"
          disableDefaultUI={false}
        >
          {origin && <GeocodedMarker address={origin} color="#00352e" label="A" />}
          {destination && <GeocodedMarker address={destination} color="#ba1a1a" label="B" />}
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
