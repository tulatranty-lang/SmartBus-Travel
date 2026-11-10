import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { FeatureCollection, Feature } from "geojson";
import {
  Clock3,
  BusFront,
  Navigation,
  Pause,
  Play,
  RotateCcw,
  SearchCheck,
  X,
} from "lucide-react";
import {
  buildFleetRoutes,
  prepareFleet,
  predictFleet,
  type RoadNetwork,
  type EstimatedVehicle,
} from "./fleet";
import type { Route, Stop } from "../types";
import "./operations.css";

function todayAt(value: string) {
  const date = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  return Date.parse(date + "T" + value + ":00+07:00");
}
const hhmm = (epoch: number) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(epoch);
export function useTransitOperations(
  region: string,
  selected: string | null,
  sourceRoutes: Route[],
  original?: FeatureCollection,
  initialTime?: string | null,
) {
  const initial =
    initialTime && /^\d{2}:\d{2}$/.test(initialTime)
      ? todayAt(initialTime)
      : NaN;
  const [epoch, setEpoch] = useState(
      Number.isFinite(initial) ? initial : Date.now(),
    ),
    [mode, setMode] = useState<"now" | "preview">(
      Number.isFinite(initial) ? "preview" : "now",
    ),
    [paused, setPaused] = useState(false),
    [rate, setRate] = useState(1);
  const network = useQuery({
    queryKey: ["road-network-v2"],
    queryFn: async ({ signal }) => {
      const r = await fetch(
        import.meta.env.BASE_URL + "data/road-network.json",
        { signal },
      );
      if (!r.ok) throw Error("Chưa tải được hình học đường.");
      return r.json() as Promise<RoadNetwork>;
    },
    staleTime: Infinity,
  });
  const roadRoutes = useMemo(
    () =>
      network.data?.routes.filter(
        (r) => r.provinceCode === region && (!selected || r.id === selected),
      ) ?? [],
    [network.data, region, selected],
  );
  const prepared = useMemo(
    () => prepareFleet(buildFleetRoutes(roadRoutes, sourceRoutes)),
    [roadRoutes, sourceRoutes],
  );
  const prediction = useMemo(
    () => predictFleet(prepared, epoch),
    [prepared, epoch],
  );
  const mapStops = useMemo<Stop[]>(
    () =>
      prepared.routes.flatMap((p) =>
        (["outbound", "inbound"] as const).flatMap((direction) => {
          const d = p[direction];
          return d.anchors.map((a, index) => {
            let lo = 0,
              hi = d.prefix.length - 2;
            while (lo < hi) {
              const mid = (lo + hi + 1) >> 1;
              if (d.prefix[mid] <= a.s) lo = mid;
              else hi = mid - 1;
            }
            const u = Math.max(
                0,
                Math.min(
                  1,
                  (a.s - d.prefix[lo]) / (d.prefix[lo + 1] - d.prefix[lo] || 1),
                ),
              ),
              v = d.coordinates[lo],
              w = d.coordinates[lo + 1];
            return {
              id: `${p.route.id}:${direction}:${index}`,
              routeId: p.route.id,
              name: a.name + " · điểm tuyến ước tính",
              lat: v[1] + (w[1] - v[1]) * u,
              lng: v[0] + (w[0] - v[0]) * u,
            };
          });
        }),
      ),
    [prepared],
  );
  const roadGeo = useMemo<FeatureCollection>(() => {
    if (!network.data)
      return original ?? { type: "FeatureCollection", features: [] };
    const features: Feature[] = [];
    for (const r of roadRoutes.filter(
      (r) => selected || !r.service?.historical,
    )) {
      const source =
        original?.features.find((f) => String(f.properties?.id) === r.id)
          ?.properties ?? {};
      for (const direction of ["outbound", "inbound"] as const)
        if (r[direction]?.coordinates.length > 1)
          features.push({
            type: "Feature",
            properties: {
              ...source,
              id: r.id,
              name: r.name,
              color: r.color || source.color || "#087f72",
              geometryStatus: r.geometryStatus,
              direction,
            },
            geometry: {
              type: "LineString",
              coordinates: r[direction].coordinates,
            },
          });
    }
    return { type: "FeatureCollection", features };
  }, [network.data, roadRoutes, original, selected]);
  const previous = useRef(0);
  useEffect(() => {
    previous.current = performance.now();
    const timer = setInterval(() => {
      const now = performance.now(),
        delta = Math.min(500, now - previous.current);
      previous.current = now;
      if (!paused && !document.hidden)
        setEpoch((v) => (mode === "now" ? Date.now() : v + delta * rate));
    }, 100);
    return () => clearInterval(timer);
  }, [mode, paused, rate]);
  function current() {
    setMode("now");
    setEpoch(Date.now());
    setPaused(false);
    setRate(1);
  }
  function at(value: string) {
    const time = todayAt(value);
    if (Number.isFinite(time)) {
      setMode("preview");
      setEpoch(time);
      setPaused(false);
    }
  }
  function advance() {
    setMode("preview");
    setEpoch((v) => v + 15 * 60000);
  }
  function pause() {
    setMode("preview");
    setPaused((v) => !v);
  }
  return {
    network,
    roadRoutes,
    roadGeo,
    mapStops,
    prediction,
    mode,
    paused,
    rate,
    epoch,
    time: hhmm(epoch),
    current,
    at,
    advance,
    pause,
    setRate,
  };
}
export type TransitOperations = ReturnType<typeof useTransitOperations>;
export function OperationsToolbar({
  operations: o,
  perspective,
  setPerspective,
}: {
  operations: TransitOperations;
  perspective: boolean;
  setPerspective: (v: boolean) => void;
}) {
  return (
    <div className="operations-toolbar" data-testid="operations-toolbar">
      <div className="operations-title">
        <span className="operations-icon">
          <BusFront size={21} />
        </span>
        <div>
          <strong>Xe buýt trên bản đồ</strong>
          <small>Vị trí ước tính theo lịch và thời gian đi</small>
        </div>
        <span className={"operations-clock " + o.mode}>
          <Clock3 size={12} />
          <output data-testid="fleet-clock">{o.time}</output>
          <small>{o.mode === "now" ? "Hiện tại" : "Giờ xem"}</small>
        </span>
      </div>
      <div className="operations-controls">
        <button aria-pressed={o.mode === "now"} onClick={o.current}>
          Hiện tại
        </button>
        <label>
          Giờ xem
          <input
            aria-label="Giờ xem xe trên bản đồ"
            type="time"
            value={o.time}
            onChange={(e) => o.at(e.target.value)}
          />
        </label>
        <button onClick={o.advance}>+15 phút</button>
        <button
          onClick={o.pause}
          aria-label={
            o.paused ? "Tiếp tục thời gian ước tính" : "Dừng thời gian ước tính"
          }
        >
          {o.paused ? <Play size={14} /> : <Pause size={14} />}
        </button>
        <button
          aria-pressed={perspective}
          onClick={() => setPerspective(!perspective)}
        >
          3D
        </button>
        {o.mode === "preview" && (
          <select
            aria-label="Tốc độ xem thời gian"
            value={o.rate}
            onChange={(e) => o.setRate(Number(e.target.value))}
          >
            {[1, 10, 60].map((r) => (
              <option key={r} value={r}>
                {r}×
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="operations-counts">
        <span>
          <b data-testid="fleet-active-count">{o.prediction.counts.active}</b>{" "}
          xe đang đi
        </span>
        <span>
          <b>{o.prediction.counts.parked}</b> xe ở đầu bến
        </span>
        <span>{o.prediction.counts.scheduledRoutes} tuyến được tính</span>
      </div>
    </div>
  );
}
export function SelectedBus({
  bus,
  follow,
  setFollow,
  close,
}: {
  bus: EstimatedVehicle;
  follow: boolean;
  setFollow: (v: boolean) => void;
  close: () => void;
}) {
  return (
    <article className="selected-bus-card" data-testid="selected-bus-card">
      <div className="selected-bus-title">
        <span>{bus.displayCode}</span>
        <div>
          <strong>{bus.statusLabel}</strong>
          <small>
            {bus.direction === "outbound" ? "Chiều đi" : "Chiều về"} · {bus.id}
          </small>
        </div>
        <button onClick={close} aria-label="Đóng thông tin xe">
          <X size={17} />
        </button>
      </div>
      <div className="selected-bus-next">
        <small>ĐIỂM KẾ TIẾP</small>
        <strong>{bus.nextStop || "Đầu bến"}</strong>
        <span>
          {bus.etaMinutes === undefined
            ? "Đang ở đầu bến"
            : `Khoảng ${Math.max(1, Math.ceil(bus.etaMinutes))} phút`}
          <i />
          {Math.round(bus.speedKph)} km/h
        </span>
      </div>
      <p>
        Ước tính từ lịch tuyến, chưa có tín hiệu GPS của xe. Vùng mờ biểu thị độ
        bất định của mô hình.
      </p>
      <button
        className="follow-bus"
        aria-pressed={follow}
        onClick={() => setFollow(!follow)}
      >
        <Navigation size={15} />
        {follow ? "Đang theo xe" : "Theo xe trên bản đồ"}
      </button>
    </article>
  );
}
export function FleetList({
  operations: o,
  search,
  selectedId,
  onSelect,
}: {
  operations: TransitOperations;
  search: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const rows = o.prediction.vehicles.filter((v) =>
    (v.displayCode + " " + v.routeId + " " + (v.nextStop || ""))
      .toLowerCase()
      .includes(search.toLowerCase()),
  );
  if (o.network.isPending)
    return (
      <p className="fleet-empty">
        Đang tải đường và lịch chạy để tính vị trí xe…
      </p>
    );
  if (o.network.error)
    return (
      <div className="fleet-empty">
        <strong>Chưa tải được đường tuyến</strong>
        <p>Chưa thể tính vị trí xe khi thiếu hình học đường.</p>
        <button onClick={() => o.network.refetch()}>Thử tải lại</button>
      </div>
    );
  return (
    <>
      <div className="fleet-list-summary">
        <strong>{o.prediction.counts.active} xe trên đường</strong>
        <span>
          {o.time} · {o.mode === "now" ? "Giờ hiện tại" : "Giờ đang xem"}
        </span>
      </div>
      {!rows.length && (
        <div className="fleet-empty">
          <BusFront size={30} />
          <strong>
            {o.prediction.counts.totalConfigured
              ? "Chưa có xe đang chạy ở giờ này"
              : "Chưa đủ dữ liệu vận hành"}
          </strong>
          <p>
            Xe chạy trong khung giờ tuyến, có thời gian nghỉ và quay đầu ở hai
            bến.
          </p>
          <button onClick={() => o.at("08:00")}>
            <Clock3 size={15} />
            Xem lúc 08:00 trên bản đồ
          </button>
        </div>
      )}
      {rows.map((v) => (
        <button
          key={v.id}
          className={
            "fleet-list-item " + (selectedId === v.id ? "selected" : "")
          }
          onClick={() => onSelect(v.id)}
        >
          <span className="fleet-route-badge" style={{ background: v.color }}>
            {v.displayCode}
          </span>
          <div>
            <strong>{v.statusLabel}</strong>
            <small>
              {v.direction === "outbound" ? "Chiều đi" : "Chiều về"} ·{" "}
              {v.nextStop || "Đang đi đến đầu bến"}
            </small>
          </div>
          <span className="fleet-eta">
            {v.etaMinutes !== undefined
              ? `~${Math.max(1, Math.ceil(v.etaMinutes))}′`
              : "—"}
          </span>
        </button>
      ))}
      <details className="fleet-method">
        <summary>
          <SearchCheck size={14} />
          Cách tính vị trí và số xe
        </summary>
        <p>
          Vị trí được tính theo giờ xuất bến, đội xe, chiều tuyến, tốc độ từng
          đoạn và thời gian dừng. Một xe phải đi hết chuyến, nghỉ đầu bến rồi
          mới quay lại; không sinh thêm xe theo mỗi lần cập nhật.
        </p>
        <p>
          Đây là dự đoán lý thuyết, chưa đối chiếu vị trí thật. Lịch công bố
          được ưu tiên; phần thiếu dùng giả định có ghi trong dữ liệu. Tuyến
          lịch sử không được tính là tuyến đang hoạt động.
        </p>
        <p>
          {o.roadRoutes.filter((r) => r.geometryStatus === "review").length}{" "}
          tuyến trong phạm vi còn cần soát hành lang đường. Các điểm GPS gốc
          được giữ riêng, không bị đổi số.
        </p>
      </details>
    </>
  );
}
