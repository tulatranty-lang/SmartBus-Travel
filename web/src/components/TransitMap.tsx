import type * as GeoJSON from "geojson";
import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  Map as GLMap,
  NavigationControl,
  AttributionControl,
  Popup,
  Marker,
  setWorkerUrl,
  type GeoJSONSource,
} from "maplibre-gl";
import worker from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import { MapPinned, RotateCcw } from "lucide-react";
import { centers, point } from "../state";
import type { Place, Stop } from "../types";
import type { EstimatedVehicle } from "../transit/fleet";
import {
  createVehicleButton,
  updateVehicleButton,
  uncertaintyFeature,
} from "../transit/vehicle-marker";
import "../transit/vehicles.css";
setWorkerUrl(worker);
const CompatibleMap = lazy(() => import("./CompatibleMap"));
const empty: GeoJSON.FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};
export interface MapProps {
  region: string;
  routes?: GeoJSON.FeatureCollection;
  places?: Place[];
  fitPlaces?: boolean;
  stops?: Stop[];
  selected?: string | null;
  focus?: [number, number] | null;
  compact?: boolean;
  vehicles?: EstimatedVehicle[];
  selectedVehicleId?: string | null;
  followVehicle?: boolean;
  perspective?: boolean;
  onVehicle?: (id: string) => void;
  onPlace?: (id: number) => void;
  onRoute?: (id: string) => void;
}
export default function TransitMap({
  region,
  routes = empty,
  places = [],
  fitPlaces = false,
  stops = [],
  selected,
  focus,
  compact = false,
  vehicles = [],
  selectedVehicleId,
  followVehicle = false,
  perspective = false,
  onVehicle,
  onPlace,
  onRoute,
}: MapProps) {
  const el = useRef<HTMLDivElement>(null),
    map = useRef<GLMap | null>(null),
    handlers = useRef({ onPlace, onRoute, onVehicle }),
    markers = useRef(
      new Map<string, { marker: Marker; button: HTMLButtonElement }>(),
    ),
    latestVehicles = useRef({ vehicles, selectedVehicleId }),
    followTarget = useRef<string | null>(null);
  handlers.current = { onPlace, onRoute, onVehicle };
  latestVehicles.current = { vehicles, selectedVehicleId };
  const [ready, setReady] = useState(false),
    [error, setError] = useState(false);
  useEffect(() => {
    if (!el.current || error) return;
    let m: GLMap;
    try {
      m = new GLMap({
        container: el.current,
        style: "https://tiles.openfreemap.org/styles/positron",
        center: centers[region] || centers.DN,
        zoom: compact ? 11 : 11.6,
        pitch: compact ? 18 : 0,
        cooperativeGestures: compact,
        attributionControl: false,
      });
    } catch {
      setError(true);
      return;
    }
    map.current = m;
    m.addControl(
      new NavigationControl({ showCompass: !compact }),
      "bottom-right",
    );
    m.addControl(new AttributionControl({ compact: true }), "bottom-left");
    m.on("load", () => {
      for (const s of ["routes", "places", "stops", "vehicle-uncertainty"])
        m.addSource(s, { type: "geojson", data: empty });
      m.addLayer({
        id: "route-shadow",
        type: "line",
        source: "routes",
        paint: { "line-color": "#fff", "line-width": 8 },
        layout: { "line-cap": "round", "line-join": "round" },
      });
      m.addLayer({
        id: "route-line",
        type: "line",
        source: "routes",
        paint: {
          "line-color": ["coalesce", ["get", "color"], "#168c7c"],
          "line-width": 4.5,
          "line-opacity": 0.85,
        },
        filter: ["==", ["get", "geometryStatus"], "road-routed"],
        layout: { "line-cap": "round", "line-join": "round" },
      });
      m.addLayer({
        id: "route-review",
        type: "line",
        source: "routes",
        filter: ["!=", ["get", "geometryStatus"], "road-routed"],
        paint: {
          "line-color": ["coalesce", ["get", "color"], "#168c7c"],
          "line-width": 4.5,
          "line-opacity": 0.8,
          "line-dasharray": [2, 2],
        },
        layout: { "line-cap": "round", "line-join": "round" },
      });
      m.addLayer({
        id: "vehicle-uncertainty-fill",
        type: "fill",
        source: "vehicle-uncertainty",
        paint: { "fill-color": "#278eaa", "fill-opacity": 0.08 },
      });
      m.addLayer({
        id: "vehicle-uncertainty-line",
        type: "line",
        source: "vehicle-uncertainty",
        paint: {
          "line-color": "#278eaa",
          "line-width": 1.3,
          "line-opacity": 0.6,
          "line-dasharray": [3, 3],
        },
      });
      const building = m
        .getStyle()
        .layers.find(
          (l) =>
            l.type === "fill" &&
            "source-layer" in l &&
            l["source-layer"] === "building",
        );
      if (
        building &&
        "source" in building &&
        typeof building.source === "string"
      ) {
        m.addLayer({
          id: "street-buildings-3d",
          type: "fill-extrusion",
          source: building.source,
          "source-layer": "building",
          minzoom: 14.3,
          paint: {
            "fill-extrusion-color": "#d0ddd7",
            "fill-extrusion-height": [
              "to-number",
              ["get", "render_height"],
              ["get", "height"],
              7,
            ],
            "fill-extrusion-base": [
              "to-number",
              ["get", "render_min_height"],
              0,
            ],
            "fill-extrusion-opacity": 0.7,
          },
        });
      }
      m.addLayer({
        id: "stop-dots",
        type: "circle",
        source: "stops",
        minzoom: 11,
        paint: {
          "circle-radius": 4,
          "circle-color": "#fff",
          "circle-stroke-color": "#168c7c",
          "circle-stroke-width": 2,
        },
      });
      m.addLayer({
        id: "place-dots",
        type: "circle",
        source: "places",
        paint: {
          "circle-radius": 8,
          "circle-color": "#ef9567",
          "circle-stroke-color": "#fff",
          "circle-stroke-width": 3,
        },
      });
      setReady(true);
      setError(false);
    });
    m.on("click", "place-dots", (e) => {
      const p = e.features?.[0]?.properties;
      if (p) handlers.current.onPlace?.(Number(p.id));
    });
    const pickRoute = (e: import("maplibre-gl").MapLayerMouseEvent) => {
      const p = e.features?.[0]?.properties;
      if (p)
        handlers.current.onRoute?.(
          String(p.id || p.routeId || p.routeCode || ""),
        );
    };
    m.on("click", "route-line", pickRoute);
    m.on("click", "route-review", pickRoute);
    m.on("click", "stop-dots", (e) => {
      const f = e.features?.[0];
      if (f?.geometry.type !== "Point") return;
      const node = document.createElement("strong");
      node.textContent = String(f.properties?.name || "Điểm dừng");
      new Popup({ offset: 10 })
        .setLngLat(f.geometry.coordinates as [number, number])
        .setDOMContent(node)
        .addTo(m);
    });
    for (const layer of [
      "route-line",
      "route-review",
      "place-dots",
      "stop-dots",
    ]) {
      m.on("mouseenter", layer, () => (m.getCanvas().style.cursor = "pointer"));
      m.on("mouseleave", layer, () => (m.getCanvas().style.cursor = ""));
    }
    m.on("rotate", () => {
      for (const v of latestVehicles.current.vehicles) {
        const item = markers.current.get(v.id);
        if (item)
          updateVehicleButton(
            item.button,
            v,
            v.id === latestVehicles.current.selectedVehicleId,
            m.getBearing(),
          );
      }
    });
    const lost = () => setError(true);
    m.getCanvas().addEventListener("webglcontextlost", lost);
    const observer = new ResizeObserver(() => m.resize());
    observer.observe(el.current);
    const timer = setTimeout(() => {
      if (!m.isStyleLoaded()) setError(true);
    }, 18000);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      m.getCanvas().removeEventListener("webglcontextlost", lost);
      markers.current.forEach((item) => item.marker.remove());
      markers.current.clear();
      m.remove();
      map.current = null;
    };
  }, [error]);
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const filtered = {
      ...routes,
      features: routes.features.filter(
        (f) =>
          !selected ||
          String(
            f.properties?.id ||
              f.properties?.routeId ||
              f.properties?.routeCode,
          ) === selected,
      ),
    };
    (m.getSource("routes") as GeoJSONSource)?.setData(filtered);
    const points = (rows: (Place | Stop)[]): GeoJSON.FeatureCollection => ({
      type: "FeatureCollection",
      features: rows.flatMap((p) => {
        const pos = point(p);
        return pos
          ? [
              {
                type: "Feature",
                properties: { id: p.id, name: p.name },
                geometry: { type: "Point", coordinates: pos },
              } as GeoJSON.Feature,
            ]
          : [];
      }),
    });
    (m.getSource("places") as GeoJSONSource)?.setData(points(places));
    (m.getSource("stops") as GeoJSONSource)?.setData(points(stops));
    if ((selected || fitPlaces) && !followVehicle) {
      const coords = selected
        ? filtered.features.flatMap((f) =>
            f.geometry.type === "LineString" ? f.geometry.coordinates : [],
          )
        : places.flatMap((p) => {
            const pos = point(p);
            return pos ? [pos] : [];
          });
      if (coords.length)
        m.fitBounds(
          [
            [
              Math.min(...coords.map((p) => p[0])),
              Math.min(...coords.map((p) => p[1])),
            ],
            [
              Math.max(...coords.map((p) => p[0])),
              Math.max(...coords.map((p) => p[1])),
            ],
          ],
          {
            padding: 60,
            maxZoom: 14,
            duration: matchMedia("(prefers-reduced-motion: reduce)").matches
              ? 0
              : 400,
          },
        );
    }
  }, [ready, routes, places, stops, selected, fitPlaces, followVehicle]);
  useEffect(() => {
    if (ready && !selected && !fitPlaces && !followVehicle)
      map.current?.flyTo({
        center: centers[region] || centers.DN,
        zoom: compact ? 11 : 11.6,
        duration: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 0
          : 700,
      });
  }, [region, ready, compact, selected, fitPlaces, followVehicle]);
  useEffect(() => {
    if (ready && focus)
      map.current?.flyTo({
        center: focus,
        zoom: 14,
        duration: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 0
          : 650,
      });
  }, [focus, ready]);
  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const ids = new Set(vehicles.map((v) => v.id));
    for (const [id, item] of markers.current)
      if (!ids.has(id)) {
        item.marker.remove();
        markers.current.delete(id);
      }
    for (const vehicle of vehicles) {
      if (!vehicle.position.every(Number.isFinite)) continue;
      let item = markers.current.get(vehicle.id);
      if (!item) {
        const button = createVehicleButton(() =>
          handlers.current.onVehicle?.(vehicle.id),
        );
        const marker = new Marker({
          element: button,
          anchor: "center",
          pitchAlignment: "viewport",
          rotationAlignment: "viewport",
        })
          .setLngLat(vehicle.position)
          .addTo(m);
        item = { marker, button };
        markers.current.set(vehicle.id, item);
      }
      item.marker.setLngLat(vehicle.position);
      updateVehicleButton(
        item.button,
        vehicle,
        vehicle.id === selectedVehicleId,
        m.getBearing(),
      );
    }
    const vehicle = vehicles.find((v) => v.id === selectedVehicleId);
    (m.getSource("vehicle-uncertainty") as GeoJSONSource)?.setData(
      uncertaintyFeature(vehicle),
    );
    if (vehicle && followVehicle) {
      const first = followTarget.current !== vehicle.id;
      if (first) m.jumpTo({ center: vehicle.position, zoom: 16.3 });
      else
        m.easeTo({ center: vehicle.position, duration: 90, essential: true });
      followTarget.current = vehicle.id;
    } else followTarget.current = null;
  }, [vehicles, selectedVehicleId, followVehicle, ready]);
  useEffect(() => {
    if (ready)
      map.current?.easeTo({
        pitch: perspective ? 45 : compact ? 18 : 0,
        duration: 500,
      });
  }, [perspective, ready, compact]);
  if (error)
    return (
      <Suspense
        fallback={
          <div className="map-loading">Đang mở bản đồ tương thích…</div>
        }
      >
        <CompatibleMap
          region={region}
          routes={routes}
          places={places}
          fitPlaces={fitPlaces}
          stops={stops}
          selected={selected}
          focus={focus}
          compact={compact}
          vehicles={vehicles}
          selectedVehicleId={selectedVehicleId}
          followVehicle={followVehicle}
          perspective={perspective}
          onVehicle={onVehicle}
          onPlace={onPlace}
          onRoute={onRoute}
        />
      </Suspense>
    );
  return (
    <div className="transit-map">
      <div
        ref={el}
        className="map-canvas"
        aria-label="Bản đồ tuyến xe và điểm đến"
      />
      {!ready && !error && (
        <div className="map-loading">
          <MapPinned size={25} />
          <span>Đang mở bản đồ…</span>
        </div>
      )}
      {error && (
        <div className="map-fallback">
          <MapPinned size={25} />
          <strong>Nền bản đồ chưa sẵn sàng</strong>
          <span>Bạn vẫn có thể dùng danh sách và thông tin hành trình.</span>
          <button onClick={() => location.reload()}>
            <RotateCcw size={14} />
            Tải lại bản đồ
          </button>
        </div>
      )}
      <div className="map-label">
        <span className="estimated-map-dot" />
        Bản đồ khám phá<span className="map-separator">/</span>
        <span>
          {vehicles.length ? "Xe theo lịch ước tính" : "Lộ trình tham khảo"}
        </span>
      </div>
    </div>
  );
}
