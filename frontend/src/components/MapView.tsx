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
          mapId="pathproject-map"
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
