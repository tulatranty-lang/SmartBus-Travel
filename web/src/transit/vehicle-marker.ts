import type { FeatureCollection } from "geojson";
import type { EstimatedVehicle } from "./fleet";

// The icon is an upright city bus, with its front pointing north at zero degrees.
// Geographic position and direction come from the timetable model, not the SVG.
const busSvg = `<svg class="estimated-bus-vehicle" viewBox="0 0 28 58" aria-hidden="true">
  <ellipse cx="14" cy="31" rx="12" ry="24" fill="#18343a" opacity=".16"/>
  <g fill="#263a40"><rect x="2" y="13" width="4" height="9" rx="1"/><rect x="22" y="13" width="4" height="9" rx="1"/><rect x="2" y="40" width="4" height="8" rx="1"/><rect x="22" y="40" width="4" height="8" rx="1"/></g>
  <rect class="estimated-bus-paint" x="5" y="4" width="18" height="49" rx="5" stroke="#fafffd" stroke-width="1.4"/>
  <path d="M8 10Q14 7 20 10L20 17Q14 19 8 17Z" fill="#203f50"/>
  <path d="M8 11L13 10L11 17L8 16Z" fill="#b6e3e7" opacity=".65"/>
  <rect x="7" y="21" width="1.6" height="24" rx=".6" fill="#efd772"/><rect x="19.4" y="21" width="1.6" height="24" rx=".6" fill="#efd772"/>
  <rect x="10" y="24" width="8" height="9" rx="1" fill="#e7f3ef"/><path d="M11 26H17M11 28H17M11 30H17" stroke="#a9c6c2" stroke-width=".6"/>
  <rect x="11" y="37" width="6" height="7" rx="1" fill="#d7ece8"/>
  <rect x="7" y="6" width="3" height="1.5" rx=".5" fill="#fff7c5"/><rect x="18" y="6" width="3" height="1.5" rx=".5" fill="#fff7c5"/>
  <g class="estimated-bus-brakes"><rect x="7" y="49" width="3" height="2" rx=".5"/><rect x="18" y="49" width="3" height="2" rx=".5"/></g>
</svg><span class="estimated-bus-code"></span><span class="estimated-bus-estimate" aria-hidden="true"></span>`;

export function createVehicleButton(onSelect: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "estimated-bus-marker";
  button.innerHTML = busSvg;
  button.addEventListener("click", (e) => {
    e.stopPropagation();
    onSelect();
  });
  return button;
}

export function updateVehicleButton(
  button: HTMLButtonElement,
  vehicle: EstimatedVehicle,
  selected: boolean,
  mapBearing = 0,
) {
  const color = /^#[\da-f]{3,8}$/i.test(vehicle.color)
    ? vehicle.color
    : "#248fbd";
  button.style.setProperty(
    "--bus-color",
    vehicle.routeId === "DN-06" ? "#248fbd" : color,
  );
  const target = vehicle.headingDegrees - mapBearing;
  const old = Number(button.dataset.angle ?? target);
  const angle = old + ((((target - old + 540) % 360) + 360) % 360) - 180;
  button.dataset.angle = String(angle);
  button.style.setProperty("--bus-bearing", `${angle}deg`);
  button.classList.toggle("estimated-bus-selected", selected);
  button.classList.toggle("estimated-bus-stopped", vehicle.status !== "moving");
  button.dataset.vehicleId = vehicle.id;
  button.dataset.routeId = vehicle.routeId;
  button.setAttribute("aria-pressed", String(selected));
  const next = vehicle.nextStop
    ? `, tiếp theo ${vehicle.nextStop}${vehicle.etaMinutes !== undefined ? ` khoảng ${Math.ceil(vehicle.etaMinutes)} phút` : ""}`
    : "";
  const label = `Xe ${vehicle.displayCode} · ${vehicle.id} · vị trí ước tính · ${vehicle.statusLabel}${next}`;
  button.title = label;
  button.setAttribute("aria-label", label);
  button.querySelector(".estimated-bus-code")!.textContent =
    vehicle.displayCode;
}

export function uncertaintyFeature(
  vehicle: EstimatedVehicle | undefined,
): FeatureCollection {
  if (!vehicle) return { type: "FeatureCollection", features: [] };
  const [lng, lat] = vehicle.position,
    radius = Math.max(20, Math.min(5000, vehicle.uncertaintyM));
  const coordinates = Array.from({ length: 49 }, (_, i) => {
    const angle = (i / 48) * Math.PI * 2;
    return [
      lng +
        (Math.cos(angle) * radius) / (111320 * Math.cos((lat * Math.PI) / 180)),
      lat + (Math.sin(angle) * radius) / 111320,
    ];
  });
  return {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        properties: { id: vehicle.id },
        geometry: { type: "Polygon", coordinates: [coordinates] },
      },
    ],
  };
}
