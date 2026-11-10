import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import type { FeatureCollection } from "geojson";
import "leaflet/dist/leaflet.css";
import { MapPinned, RotateCcw } from "lucide-react";
import { centers, point } from "../state";
import type { MapProps } from "./TransitMap";
import {
  createVehicleButton,
  updateVehicleButton,
} from "../transit/vehicle-marker";
import "../transit/vehicles.css";
/** SVG/raster fallback keeps the same live data and actions when WebGL is unavailable. */
export default function CompatibleMap({
  region,
  routes,
  places = [],
  fitPlaces = false,
  stops = [],
  selected,
  focus,
  compact = false,
  vehicles = [],
  selectedVehicleId,
  followVehicle = false,
  onVehicle,
  onPlace,
  onRoute,
}: MapProps) {
  const el = useRef<HTMLDivElement>(null),
    map = useRef<L.Map | null>(null),
    layers = useRef<L.LayerGroup | null>(null),
    tiles = useRef<L.TileLayer | null>(null),
    loaded = useRef(0),
    handlers = useRef({ onPlace, onRoute, onVehicle }),
    vehicleLayer = useRef<L.LayerGroup | null>(null),
    markers = useRef(
      new Map<string, { marker: L.Marker; button: HTMLButtonElement }>(),
    ),
    uncertainty = useRef<L.Circle | null>(null),
    followTarget = useRef<string | null>(null);
  handlers.current = { onPlace, onRoute, onVehicle };
  const [ready, setReady] = useState(false),
    [unavailable, setUnavailable] = useState(false);
  useEffect(() => {
    if (!el.current) return;
    const center = centers[region] || centers.DN;
    const m = L.map(el.current, {
      zoomControl: false,
      scrollWheelZoom: !compact,
      preferCanvas: false,
    }).setView([center[1], center[0]], 11);
    map.current = m;
    L.control.zoom({ position: "bottomright" }).addTo(m);
    tiles.current = L.tileLayer(
      "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      {
        maxZoom: 19,
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
        crossOrigin: true,
      },
    ).addTo(m);
    tiles.current.on("tileload", () => {
      loaded.current++;
      setUnavailable(false);
    });
    layers.current = L.layerGroup().addTo(m);
    vehicleLayer.current = L.layerGroup().addTo(m);
    setReady(true);
    const timer = setTimeout(() => {
        if (!loaded.current) setUnavailable(true);
      }, 18000),
      observer = new ResizeObserver(() => m.invalidateSize());
    observer.observe(el.current);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
      markers.current.clear();
      vehicleLayer.current = null;
      uncertainty.current = null;
      m.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    const m = map.current,
      group = layers.current;
    if (!ready || !m || !group) return;
    group.clearLayers();
    const filtered =
      routes?.features.filter(
        (f) =>
          !selected ||
          String(
            f.properties?.id ||
              f.properties?.routeId ||
              f.properties?.routeCode,
          ) === selected,
      ) || [];
    const collection: FeatureCollection = {
      type: "FeatureCollection",
      features: filtered,
    };
    const geo = L.geoJSON(collection, {
      style: (f) => ({
        color: f?.properties?.color || "#168c7c",
        weight: 4,
        opacity: 0.85,
        dashArray:
          f?.properties?.geometryStatus === "road-routed" ? undefined : "7 6",
      }),
      onEachFeature: (feature, layer) => {
        const id = String(
          feature.properties?.id ||
            feature.properties?.routeId ||
            feature.properties?.routeCode ||
            "",
        );
        const label = document.createElement("strong");
        label.textContent = "Tuyến " + id;
        layer.bindTooltip(label);
        layer.on("click", () => handlers.current.onRoute?.(id));
      },
    }).addTo(group);
    if (selected && geo.getBounds().isValid() && !followVehicle)
      m.fitBounds(geo.getBounds(), {
        padding: [45, 45],
        maxZoom: 14,
        animate: false,
      });
    if (!selected && fitPlaces && !followVehicle) {
      const positions = places.flatMap((p) => {
        const pos = point(p);
        return pos ? [[pos[1], pos[0]] as [number, number]] : [];
      });
      if (positions.length)
        m.fitBounds(L.latLngBounds(positions), {
          padding: [45, 45],
          maxZoom: 14,
          animate: false,
        });
    }
    for (const p of stops) {
      const pos = point(p);
      if (!pos) continue;
      const label = document.createElement("strong");
      label.textContent = p.name;
      L.circleMarker([pos[1], pos[0]], {
        radius: 4,
        color: "#168c7c",
        weight: 2,
        fillColor: "#fff",
        fillOpacity: 1,
      })
        .bindPopup(label)
        .addTo(group);
    }
    for (const p of places) {
      const pos = point(p);
      if (!pos) continue;
      const label = document.createElement("strong");
      label.textContent = p.name;
      L.circleMarker([pos[1], pos[0]], {
        radius: 8,
        color: "#fff",
        weight: 3,
        fillColor: "#ef9567",
        fillOpacity: 1,
      })
        .bindTooltip(label)
        .on("click", () => handlers.current.onPlace?.(p.id))
        .addTo(group);
    }
  }, [ready, routes, places, stops, selected, fitPlaces, followVehicle]);
  useEffect(() => {
    const c = centers[region] || centers.DN;
    if (ready && !selected && !fitPlaces && !followVehicle)
      map.current?.setView([c[1], c[0]], compact ? 11 : 11.6, {
        animate: false,
      });
  }, [region, ready, selected, compact, fitPlaces, followVehicle]);
  useEffect(() => {
    if (ready && focus)
      map.current?.setView([focus[1], focus[0]], 14, { animate: false });
  }, [ready, focus]);
  useEffect(() => {
    const m = map.current,
      group = vehicleLayer.current;
    if (!ready || !m || !group) return;
    const ids = new Set(vehicles.map((v) => v.id));
    for (const [id, item] of markers.current)
      if (!ids.has(id)) {
        group.removeLayer(item.marker);
        markers.current.delete(id);
      }
    for (const vehicle of vehicles) {
      if (!vehicle.position.every(Number.isFinite)) continue;
      let item = markers.current.get(vehicle.id);
      if (!item) {
        const button = createVehicleButton(() =>
          handlers.current.onVehicle?.(vehicle.id),
        );
        const marker = L.marker([vehicle.position[1], vehicle.position[0]], {
          icon: L.divIcon({
            html: button,
            className: "estimated-bus-leaflet",
            iconSize: [44, 64],
            iconAnchor: [22, 32],
          }),
          keyboard: false,
          bubblingMouseEvents: false,
        }).addTo(group);
        item = { marker, button };
        markers.current.set(vehicle.id, item);
      }
      item.marker.setLatLng([vehicle.position[1], vehicle.position[0]]);
      item.marker.setZIndexOffset(
        vehicle.id === selectedVehicleId ? 1000 : 100,
      );
      updateVehicleButton(
        item.button,
        vehicle,
        vehicle.id === selectedVehicleId,
      );
    }
    const vehicle = vehicles.find((v) => v.id === selectedVehicleId);
    if (vehicle) {
      const position: L.LatLngExpression = [
        vehicle.position[1],
        vehicle.position[0],
      ];
      if (!uncertainty.current)
        uncertainty.current = L.circle(position, {
          radius: vehicle.uncertaintyM,
          color: "#278eaa",
          weight: 1.3,
          opacity: 0.6,
          fillColor: "#278eaa",
          fillOpacity: 0.08,
          dashArray: "5 5",
          interactive: false,
        }).addTo(group);
      else
        uncertainty.current.setLatLng(position).setRadius(vehicle.uncertaintyM);
      if (followVehicle) {
        if (followTarget.current !== vehicle.id)
          m.setView(position, 16, { animate: false });
        else m.panTo(position, { animate: false });
        followTarget.current = vehicle.id;
      } else followTarget.current = null;
    } else {
      if (uncertainty.current) group.removeLayer(uncertainty.current);
      uncertainty.current = null;
      followTarget.current = null;
    }
  }, [vehicles, selectedVehicleId, followVehicle, ready]);
  return (
    <div className="transit-map">
      <div
        className="map-canvas compatible-map"
        ref={el}
        aria-label="Bản đồ tuyến xe và điểm đến"
      />
      {unavailable && (
        <div className="map-tile-notice" role="status">
          <MapPinned size={16} />
          <span>
            Nền bản đồ chưa tải được. Thông tin tuyến vẫn được giữ lại.
          </span>
          <button
            onClick={() => {
              loaded.current = 0;
              setUnavailable(false);
              tiles.current?.redraw();
            }}
            aria-label="Thử tải lại nền bản đồ"
          >
            <RotateCcw size={16} />
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
