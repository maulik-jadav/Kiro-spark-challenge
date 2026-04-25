import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

// --- Mocks ---

// Mock the env var — default to empty so we can control per-test
const apiKeyRef = { current: "" };

const mockSetOptions = vi.fn();
const mockUseMap = vi.fn(() => ({ setOptions: mockSetOptions }));

vi.mock("@vis.gl/react-google-maps", () => ({
  APIProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="api-provider">{children}</div>
  ),
  Map: ({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) => (
    <div data-testid="google-map" style={style}>
      {children}
    </div>
  ),
  AdvancedMarker: ({
    children,
    position,
  }: {
    children?: React.ReactNode;
    position: { lat: number; lng: number };
  }) => (
    <div data-testid="advanced-marker" data-lat={position.lat} data-lng={position.lng}>
      {children}
    </div>
  ),
  useMap: () => mockUseMap(),
}));

// We need to dynamically control the API_KEY module-level constant.
// Since it reads process.env at module load time, we use vi.hoisted + dynamic import.
// Instead, we'll mock at the module level and re-import per test group.

// For the geocoder mock
const mockGeocode = vi.fn();

beforeEach(() => {
  vi.resetModules();
  mockGeocode.mockReset();
  mockSetOptions.mockReset();
  mockUseMap.mockReturnValue({ setOptions: mockSetOptions });

  // Set up window.google.maps.Geocoder mock
  Object.defineProperty(globalThis, "google", {
    value: {
      maps: {
        Geocoder: class {
          geocode = mockGeocode;
        },
        MapTypeStyle: {},
      },
    },
    writable: true,
    configurable: true,
  });
});

async function importMapView(apiKey: string) {
  vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", apiKey);
  const mod = await import("./MapView");
  return mod.default;
}

describe("MapView", () => {
  describe("when API key is missing", () => {
    it("renders the fallback message", async () => {
      const MapView = await importMapView("");

      render(<MapView origin={null} destination={null} />);

      expect(
        screen.getByText("Map unavailable — no API key configured.")
      ).toBeInTheDocument();
    });

    it("does not render the Google Map", async () => {
      const MapView = await importMapView("");

      render(<MapView origin={null} destination={null} />);

      expect(screen.queryByTestId("google-map")).not.toBeInTheDocument();
    });
  });

  describe("when API key is present", () => {
    it("renders the Google Map", async () => {
      const MapView = await importMapView("test-api-key");

      render(<MapView origin={null} destination={null} />);

      expect(screen.getByTestId("google-map")).toBeInTheDocument();
    });

    it("renders the APIProvider", async () => {
      const MapView = await importMapView("test-api-key");

      render(<MapView origin={null} destination={null} />);

      expect(screen.getByTestId("api-provider")).toBeInTheDocument();
    });

    it("renders zoom control buttons", async () => {
      const MapView = await importMapView("test-api-key");

      render(<MapView origin={null} destination={null} />);

      const buttons = screen.getAllByRole("button");
      expect(buttons.length).toBe(2);
    });
  });

  describe("markers", () => {
    it("does not render markers when origin and destination are null", async () => {
      const MapView = await importMapView("test-api-key");

      render(<MapView origin={null} destination={null} />);

      expect(screen.queryAllByTestId("advanced-marker")).toHaveLength(0);
    });

    it("renders origin marker (A) when origin is provided and geocoding succeeds", async () => {
      mockGeocode.mockImplementation(
        (
          _req: unknown,
          cb: (
            results: { geometry: { location: { lat: () => number; lng: () => number } } }[] | null,
            status: string
          ) => void
        ) => {
          cb(
            [
              {
                geometry: {
                  location: { lat: () => 40.7128, lng: () => -74.006 },
                },
              },
            ],
            "OK"
          );
        }
      );

      const MapView = await importMapView("test-api-key");

      render(<MapView origin="New York, NY" destination={null} />);

      const markers = screen.getAllByTestId("advanced-marker");
      expect(markers).toHaveLength(1);
      expect(markers[0]).toHaveAttribute("data-lat", "40.7128");
      expect(markers[0]).toHaveAttribute("data-lng", "-74.006");
      expect(screen.getByText("A")).toBeInTheDocument();
    });

    it("renders destination marker (B) when destination is provided and geocoding succeeds", async () => {
      mockGeocode.mockImplementation(
        (
          _req: unknown,
          cb: (
            results: { geometry: { location: { lat: () => number; lng: () => number } } }[] | null,
            status: string
          ) => void
        ) => {
          cb(
            [
              {
                geometry: {
                  location: { lat: () => 34.0522, lng: () => -118.2437 },
                },
              },
            ],
            "OK"
          );
        }
      );

      const MapView = await importMapView("test-api-key");

      render(<MapView origin={null} destination="Los Angeles, CA" />);

      const markers = screen.getAllByTestId("advanced-marker");
      expect(markers).toHaveLength(1);
      expect(markers[0]).toHaveAttribute("data-lat", "34.0522");
      expect(markers[0]).toHaveAttribute("data-lng", "-118.2437");
      expect(screen.getByText("B")).toBeInTheDocument();
    });

    it("renders both markers when origin and destination are provided", async () => {
      let callCount = 0;
      mockGeocode.mockImplementation(
        (
          _req: unknown,
          cb: (
            results: { geometry: { location: { lat: () => number; lng: () => number } } }[] | null,
            status: string
          ) => void
        ) => {
          callCount++;
          if (callCount === 1) {
            cb(
              [{ geometry: { location: { lat: () => 40.7128, lng: () => -74.006 } } }],
              "OK"
            );
          } else {
            cb(
              [{ geometry: { location: { lat: () => 34.0522, lng: () => -118.2437 } } }],
              "OK"
            );
          }
        }
      );

      const MapView = await importMapView("test-api-key");

      render(<MapView origin="New York, NY" destination="Los Angeles, CA" />);

      const markers = screen.getAllByTestId("advanced-marker");
      expect(markers).toHaveLength(2);
      expect(screen.getByText("A")).toBeInTheDocument();
      expect(screen.getByText("B")).toBeInTheDocument();
    });

    it("does not render a marker when geocoding fails", async () => {
      mockGeocode.mockImplementation(
        (
          _req: unknown,
          cb: (results: null, status: string) => void
        ) => {
          cb(null, "ZERO_RESULTS");
        }
      );

      const MapView = await importMapView("test-api-key");

      render(<MapView origin="nonexistent-place-xyz" destination={null} />);

      expect(screen.queryAllByTestId("advanced-marker")).toHaveLength(0);
    });
  });

  describe("marker styling", () => {
    it("renders origin marker with green background (#00352e)", async () => {
      mockGeocode.mockImplementation(
        (
          _req: unknown,
          cb: (
            results: { geometry: { location: { lat: () => number; lng: () => number } } }[] | null,
            status: string
          ) => void
        ) => {
          cb(
            [{ geometry: { location: { lat: () => 40.7128, lng: () => -74.006 } } }],
            "OK"
          );
        }
      );

      const MapView = await importMapView("test-api-key");

      const { container } = render(
        <MapView origin="New York, NY" destination={null} />
      );

      const markerDiv = container.querySelector('[style*="background"]');
      expect(markerDiv).not.toBeNull();
      expect(markerDiv?.getAttribute("style")).toContain("#00352e");
    });

    it("renders destination marker with red background (#ba1a1a)", async () => {
      mockGeocode.mockImplementation(
        (
          _req: unknown,
          cb: (
            results: { geometry: { location: { lat: () => number; lng: () => number } } }[] | null,
            status: string
          ) => void
        ) => {
          cb(
            [{ geometry: { location: { lat: () => 34.0522, lng: () => -118.2437 } } }],
            "OK"
          );
        }
      );

      const MapView = await importMapView("test-api-key");

      const { container } = render(
        <MapView origin={null} destination="Los Angeles, CA" />
      );

      const markerDiv = container.querySelector('[style*="background"]');
      expect(markerDiv).not.toBeNull();
      expect(markerDiv?.getAttribute("style")).toContain("#ba1a1a");
    });
  });

  describe("MapStyleApplier (useMap integration)", () => {
    it("applies custom map styles when the map instance is available", async () => {
      const MapView = await importMapView("test-api-key");

      render(<MapView origin={null} destination={null} />);

      expect(mockSetOptions).toHaveBeenCalledWith({
        styles: expect.arrayContaining([
          expect.objectContaining({ elementType: "geometry" }),
        ]),
      });
    });

    it("does not call setOptions when useMap returns null", async () => {
      mockUseMap.mockReturnValue(null);

      const MapView = await importMapView("test-api-key");

      render(<MapView origin={null} destination={null} />);

      expect(mockSetOptions).not.toHaveBeenCalled();
    });
  });
});
