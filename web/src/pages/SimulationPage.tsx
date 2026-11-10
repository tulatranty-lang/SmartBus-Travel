import { useEffect, useRef, useState, type PointerEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BusFront,
  Check,
  CloudRain,
  CornerDownRight,
  ExternalLink,
  Eye,
  Gauge,
  Layers,
  Map,
  Navigation,
  Pause,
  Play,
  RotateCcw,
  Route,
  SearchCheck,
  Sun,
  TrafficCone,
  Users,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Busy, Button, ErrorState, Modal } from "../components/ui";
import { MapPainter } from "../simulation/map-painter";
import { busStatus, clock, phase, samples } from "../simulation/replay";
import type {
  CameraMode,
  MapView,
  Replay,
  ScenarioId,
  SimulationNetwork,
  VehicleProfile,
} from "../simulation/types";
import "../simulation/simulation.css";

const asset = (name: string) =>
  import.meta.env.BASE_URL + "simulation/v1/" + name;
async function json<T>(name: string, signal: AbortSignal): Promise<T> {
  const r = await fetch(asset(name), { signal });
  if (!r.ok) throw Error("Chưa tải được dữ liệu mô phỏng. Hãy thử lại.");
  return r.json();
}
const initialView: MapView = {
  time: 0,
  camera: "follow",
  zoom: 1,
  pan: [0, 0],
  lanes: true,
  signals: true,
  buildings: true,
  gps: false,
  envelope: true,
};
const cameras: { value: CameraMode; title: string; icon: typeof Map }[] = [
  { value: "follow", title: "Theo xe", icon: Navigation },
  { value: "signals", title: "Nút giao", icon: TrafficCone },
  { value: "corner", title: "Góc cua", icon: CornerDownRight },
  { value: "all", title: "Toàn đoạn", icon: Map },
];
const statuses: Record<string, string> = {
  published: "Đã công bố",
  "family-reference": "Tham chiếu dòng xe",
  assumed: "Ước tính",
  "model-reference": "Cơ sở thuật toán",
};
function StreetMap({
  network,
  profile,
  replay,
  view,
  setView,
  selectSignal,
}: {
  network: SimulationNetwork;
  profile: VehicleProfile;
  replay: Replay;
  view: MapView;
  setView: (update: (v: MapView) => MapView) => void;
  selectSignal: (id: string) => void;
}) {
  const base = useRef<HTMLCanvasElement>(null),
    motion = useRef<HTMLCanvasElement>(null),
    painter = useRef<MapPainter | null>(null);
  const current = useRef({ view, replay });
  current.current = { view, replay };
  const drag = useRef<{
    x: number;
    y: number;
    pan: [number, number];
    moved: boolean;
  } | null>(null);
  useEffect(() => {
    painter.current = new MapPainter(
      base.current!,
      motion.current!,
      network,
      profile,
    );
    const redraw = () =>
      painter.current?.draw(current.current.view, current.current.replay);
    const resize = new ResizeObserver(redraw);
    resize.observe(base.current!.parentElement!);
    redraw();
    return () => {
      resize.disconnect();
      painter.current = null;
    };
  }, [network, profile]);
  const previous = useRef<MapView | null>(null);
  useEffect(() => {
    const old = previous.current;
    const timeOnly =
      old &&
      Object.keys(view).every(
        (k) =>
          k === "time" || view[k as keyof MapView] === old[k as keyof MapView],
      );
    painter.current?.draw(view, replay, !timeOnly || view.camera === "follow");
    previous.current = view;
  }, [view, replay]);
  function pointerMove(e: PointerEvent<HTMLCanvasElement>) {
    const d = drag.current;
    if (!d) return;
    const x = e.clientX - d.x,
      y = e.clientY - d.y;
    if (Math.abs(x) + Math.abs(y) > 4) {
      d.moved = true;
      setView((v) => ({ ...v, pan: [d.pan[0] + x, d.pan[1] + y] }));
    }
  }
  return (
    <>
      <canvas ref={base} className="sim-map-canvas" aria-hidden="true" />
      <canvas
        ref={motion}
        className="sim-map-canvas sim-motion"
        role="img"
        tabIndex={0}
        aria-label="Bản đồ mô phỏng đoạn Cầu Rồng, Võ Văn Kiệt, Võ Nguyên Giáp. Kéo để di chuyển, dùng phím mũi tên để dịch bản đồ."
        onKeyDown={(e) => {
          const delta: Record<string, [number, number]> = {
            ArrowLeft: [40, 0],
            ArrowRight: [-40, 0],
            ArrowUp: [0, 40],
            ArrowDown: [0, -40],
          };
          if (delta[e.key]) {
            e.preventDefault();
            setView((v) => ({
              ...v,
              pan: [v.pan[0] + delta[e.key][0], v.pan[1] + delta[e.key][1]],
            }));
          }
        }}
        onPointerDown={(e) => {
          drag.current = {
            x: e.clientX,
            y: e.clientY,
            pan: [...view.pan],
            moved: false,
          };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={pointerMove}
        onPointerCancel={() => {
          drag.current = null;
        }}
        onPointerUp={(e) => {
          if (drag.current && !drag.current.moved) {
            const rect = e.currentTarget.getBoundingClientRect(),
              id = painter.current?.hitSignal(
                e.clientX - rect.left,
                e.clientY - rect.top,
              );
            if (id) selectSignal(id);
          }
          drag.current = null;
        }}
      >
        Bản đồ đường và công trình từ OpenStreetMap; xe, vạch làn và pha đèn
        được mô phỏng.
      </canvas>
    </>
  );
}

export default function SimulationPage() {
  const [scenario, setScenario] = useState<ScenarioId>("normal"),
    [view, setView] = useState<MapView>(initialView),
    [playing, setPlaying] = useState(false),
    [rate, setRate] = useState(1),
    [sources, setSources] = useState(false),
    [layers, setLayers] = useState(false),
    [signalId, setSignalId] = useState<string | null>(null);
  const network = useQuery({
    queryKey: ["simulation", "network-v1"],
    queryFn: ({ signal }) => json<SimulationNetwork>("network.json", signal),
    staleTime: Infinity,
  });
  const profile = useQuery({
    queryKey: ["simulation", "profile-v1"],
    queryFn: ({ signal }) => json<VehicleProfile>("profile.json", signal),
    staleTime: Infinity,
  });
  const replay = useQuery({
    queryKey: ["simulation", scenario],
    queryFn: ({ signal }) =>
      json<Replay>("replay-" + scenario + ".json", signal),
    staleTime: Infinity,
  });
  useEffect(() => {
    if (replay.data) {
      setPlaying(false);
      setView((v) => ({
        ...v,
        time: (replay.data.events.redWait ?? 0) + 4,
        pan: [0, 0],
        zoom: 1,
      }));
    }
  }, [replay.data]);
  useEffect(() => {
    if (!playing || !replay.data) return;
    let request = 0,
      last = 0,
      accumulated = 0;
    function tick(now: number) {
      if (document.hidden) {
        last = now;
        request = requestAnimationFrame(tick);
        return;
      }
      if (last) accumulated += Math.min(0.1, (now - last) / 1000);
      last = now;
      if (accumulated >= 1 / 30) {
        const advance = accumulated * rate;
        accumulated = 0;
        setView((v) => ({
          ...v,
          time: Math.min(replay.data!.duration, v.time + advance),
        }));
      }
      request = requestAnimationFrame(tick);
    }
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [playing, rate, replay.data]);
  useEffect(() => {
    if (replay.data && view.time >= replay.data.duration) setPlaying(false);
  }, [view.time, replay.data]);
  if (network.error || profile.error || replay.error)
    return (
      <ErrorState
        error={(network.error || profile.error || replay.error)!}
        retry={() => {
          network.refetch();
          profile.refetch();
          replay.refetch();
        }}
      />
    );
  if (!network.data || !profile.data || !replay.data)
    return <Busy text="Đang chuẩn bị đường phố và chuyển động của xe…" />;
  const N = network.data,
    P = profile.data,
    R = replay.data,
    bus = samples(R, view.time).find((v) => v[0] === 0),
    ph = phase(view.time),
    config = P.scenarios[scenario];
  const status = busStatus(bus, N, view.time),
    afterBoarding =
      view.time >= (R.events.boarding ?? Infinity) + R.passengers.dwellSeconds;
  const passengers = afterBoarding ? R.passengers.after : R.passengers.before;
  function camera(value: CameraMode) {
    setView((v) => ({ ...v, camera: value, zoom: 1, pan: [0, 0] }));
  }
  function jump(event: "redWait" | "corner" | "boarding") {
    const time = R.events[event];
    if (time === null) return;
    setPlaying(false);
    setView((v) => ({
      ...v,
      time: Math.min(R.duration, time + (event === "corner" ? 0 : 3)),
      camera: event === "redWait" ? "signals" : "follow",
      zoom: 1,
      pan: [0, 0],
    }));
  }
  return (
    <div className="simulation-page" data-testid="simulation-page">
      <header className="sim-heading">
        <div>
          <span className="eyebrow">ĐÀ NẴNG · TUYẾN 06</span>
          <h1>Một chuyến xe, nhìn thật gần.</h1>
          <p>
            Cầu Rồng <ArrowRight size={12} /> Võ Văn Kiệt{" "}
            <ArrowRight size={12} /> Võ Nguyên Giáp
          </p>
        </div>
        <button
          className="sim-evidence-button"
          onClick={() => setSources(true)}
        >
          <SearchCheck size={17} />
          Nguồn & độ chính xác
          <ExternalLink size={13} />
        </button>
      </header>
      <div className="sim-scenario-bar">
        <div className="sim-scenarios" aria-label="Tình huống mô phỏng">
          {(
            [
              { value: "normal", icon: Sun },
              { value: "busy", icon: Users },
              { value: "rain", icon: CloudRain },
            ] as const
          ).map(({ value, icon: Icon }) => (
            <button
              key={value}
              aria-pressed={scenario === value}
              onClick={() => {
                setPlaying(false);
                setScenario(value);
              }}
            >
              <Icon size={15} />
              {P.scenarios[value].label}
            </button>
          ))}
        </div>
        <span className="sim-mode">
          <i />
          Mô phỏng · không phải GPS trực tiếp
        </span>
      </div>
      <div className="sim-stage">
        <section className="sim-map" aria-label="Bản đồ chi tiết">
          <StreetMap
            network={N}
            profile={P}
            replay={R}
            view={view}
            setView={setView}
            selectSignal={setSignalId}
          />
          <div className="sim-camera-bar" aria-label="Góc nhìn bản đồ">
            {cameras.map((c) => (
              <button
                key={c.value}
                onClick={() => camera(c.value)}
                aria-pressed={view.camera === c.value}
              >
                <c.icon size={15} />
                {c.title}
              </button>
            ))}
          </div>
          <button
            className="sim-layer-toggle"
            aria-expanded={layers}
            onClick={() => setLayers(!layers)}
          >
            <Layers size={16} />
            Lớp bản đồ
          </button>
          {layers && (
            <fieldset className="sim-layer-panel">
              <legend>Hiển thị trên bản đồ</legend>
              {(
                [
                  { key: "lanes", title: "Làn & điểm qua đường" },
                  { key: "signals", title: "Vị trí đèn giao thông" },
                  { key: "buildings", title: "Công trình từ OSM" },
                  { key: "gps", title: "Điểm GPS gốc" },
                  { key: "envelope", title: "Vùng cần xác minh" },
                ] as const
              ).map((l) => (
                <label key={l.key}>
                  <input
                    type="checkbox"
                    checked={view[l.key]}
                    onChange={(e) =>
                      setView((v) => ({ ...v, [l.key]: e.target.checked }))
                    }
                  />
                  {l.title}
                </label>
              ))}
              <small>Vạch làn và bề rộng chưa đo đạc thực địa.</small>
            </fieldset>
          )}
          <div className="sim-map-chip">
            <span className="sim-bus-dot" />
            <div>
              <strong>06 · Kim Long điện</strong>
              <small>{status}</small>
            </div>
          </div>
          <div className="sim-zoom">
            <button
              aria-label="Phóng to bản đồ"
              onClick={() =>
                setView((v) => ({ ...v, zoom: Math.min(8, v.zoom * 1.4) }))
              }
            >
              <ZoomIn size={18} />
            </button>
            <button
              aria-label="Thu nhỏ bản đồ"
              onClick={() =>
                setView((v) => ({ ...v, zoom: Math.max(0.4, v.zoom / 1.4) }))
              }
            >
              <ZoomOut size={18} />
            </button>
            <button
              aria-label="Đặt lại góc nhìn"
              onClick={() => camera(view.camera)}
            >
              <RotateCcw size={16} />
            </button>
          </div>
          <div className="sim-map-caption">
            <span>
              <i className="sim-key-route" />
              Quỹ đạo tính toán
            </span>
            <span>
              <i className="sim-key-signal" />
              Đèn có kịch bản
            </span>
            <span>
              <i className="sim-key-unknown" />
              Đèn chưa gán pha
            </span>
          </div>
          <div className="sim-attribution">
            ©{" "}
            <a
              href="https://www.openstreetmap.org/copyright"
              target="_blank"
              rel="noreferrer"
            >
              OpenStreetMap contributors
            </a>{" "}
            · ODbL ·{" "}
            <a href={asset("network.json")} target="_blank" rel="noreferrer">
              Dữ liệu bản đồ
            </a>
          </div>
        </section>
        <aside className="sim-dashboard" aria-label="Thông tin xe mô phỏng">
          <div className="sim-vehicle-heading">
            <span className="sim-bus-icon">
              <BusFront size={24} />
            </span>
            <div>
              <span className="eyebrow">XE THAM CHIẾU</span>
              <h2>Kim Long · 40 người</h2>
              <p>Điện · FUTA Bus Lines</p>
            </div>
          </div>
          <div className="sim-status">
            <span />
            {status}
          </div>
          <section className="sim-speed-panel">
            <span>
              <Gauge size={15} />
              Tốc độ mô phỏng
            </span>
            <div>
              <output data-testid="sim-speed">
                {bus ? (bus[2] * 3.6).toFixed(1).replace(".", ",") : "—"}
              </output>
              <small>km/h</small>
            </div>
            <div className="sim-meter">
              <i
                style={{
                  width: `${Math.min(100, (((bus?.[2] ?? 0) * 3.6) / config.speedKph) * 100)}%`,
                }}
              />
            </div>
            <p>Trần kịch bản {config.speedKph} km/h · giảm theo độ cong</p>
          </section>
          <div className="sim-mini-grid">
            <div>
              <small>Quãng đường</small>
              <strong>
                {bus
                  ? Math.round(bus[1]).toLocaleString("vi-VN")
                  : Math.round(N.length).toLocaleString("vi-VN")}
                <span> m</span>
              </strong>
            </div>
            <div>
              <small>Góc bánh lái</small>
              <strong>
                {bus ? Math.round((Math.abs(bus[4]) * 180) / Math.PI) : "—"}
                <span>°</span>
              </strong>
            </div>
          </div>
          <section className="sim-signal-panel">
            <div className="sim-lamps" aria-label={ph.label}>
              {["red", "yellow", "green"].map((color) => (
                <i key={color} className={ph.color === color ? color : ""} />
              ))}
            </div>
            <div>
              <strong>
                {ph.label}
                <output>{Math.ceil(ph.remaining)} s</output>
              </strong>
              <small>Chu kỳ giả định · cùng hướng xe</small>
            </div>
          </section>
          <section className="sim-passenger-panel">
            <div>
              <Users size={16} />
              <strong>
                {passengers} / {P.service.capacity}
              </strong>
              <span>người trên xe</span>
            </div>
            <div className="sim-capacity">
              <i
                style={{ width: `${(passengers / P.service.capacity) * 100}%` }}
              />
            </div>
            <p>
              {R.passengers.alighting} xuống · {R.passengers.boarding} lên ·
              dừng {R.passengers.dwellSeconds.toLocaleString("vi-VN")} s
            </p>
            <small>Số khách và bến dừng thuộc kịch bản.</small>
          </section>
          <section className="sim-jumps">
            <h3>Xem một tình huống</h3>
            <button
              onClick={() => jump("redWait")}
              disabled={R.events.redWait === null}
            >
              <TrafficCone size={15} />
              Xếp hàng trước đèn
              <ArrowRight size={14} />
            </button>
            <button
              onClick={() => jump("boarding")}
              disabled={R.events.boarding === null}
            >
              <Users size={15} />
              Mở cửa đón khách
              <ArrowRight size={14} />
            </button>
            <button
              onClick={() => jump("corner")}
              disabled={R.events.corner === null}
            >
              <CornerDownRight size={15} />
              Bánh trước và đuôi xe khi cua
              <ArrowRight size={14} />
            </button>
          </section>
          <div className="sim-quality-note">
            <SearchCheck size={17} />
            <div>
              <strong>Bản đồ là trọng tâm</strong>
              <p>
                Đường và nút giao từ OSM. Còn vùng cần kiểm tra mép đường; chưa
                xác nhận đúng từng làn ngoài thực địa.
              </p>
              <button onClick={() => setSources(true)}>
                Xem kết quả đối chiếu <ArrowRight size={12} />
              </button>
            </div>
          </div>
        </aside>
      </div>
      <div className="sim-player">
        <button
          className="sim-play"
          aria-label={playing ? "Tạm dừng mô phỏng" : "Phát mô phỏng"}
          onClick={() => {
            if (view.time >= R.duration) setView((v) => ({ ...v, time: 0 }));
            setPlaying(!playing);
          }}
        >
          {playing ? <Pause size={17} /> : <Play size={17} />}
          {playing ? "Tạm dừng" : "Phát chuyến xe"}
        </button>
        <span className="sim-clock">
          <output data-testid="sim-clock">{clock(view.time)}</output> /{" "}
          {clock(R.duration)}
        </span>
        <input
          aria-label="Thời điểm mô phỏng"
          type="range"
          min={0}
          max={R.duration}
          step={0.25}
          value={view.time}
          onChange={(e) => {
            setPlaying(false);
            setView((v) => ({ ...v, time: Number(e.target.value) }));
          }}
        />
        <label className="sim-rate">
          Tốc độ phát
          <select
            aria-label="Tốc độ phát"
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
          >
            {[0.5, 1, 2, 4].map((v) => (
              <option key={v} value={v}>
                {v}×
              </option>
            ))}
          </select>
        </label>
        <button
          className="sim-restart"
          aria-label="Phát lại từ đầu"
          onClick={() => {
            setPlaying(false);
            setView((v) => ({ ...v, time: 0 }));
          }}
        >
          <RotateCcw size={16} />
        </button>
      </div>
      <footer className="sim-footer">
        <span>
          <Route size={14} />
          Đoạn mô phỏng {(N.length / 1000).toFixed(2).replace(".", ",")} km ·
          tuyến công bố {P.service.routeLengthKm.toLocaleString("vi-VN")} km
        </span>
        <Link to="/explore">
          Mở bản đồ các tuyến <ArrowRight size={13} />
        </Link>
      </footer>
      <Modal
        open={sources}
        onOpenChange={setSources}
        wide
        title="Thông số nào đã được xác thực?"
        description="Báo chí và kênh chính thức giúp chọn xe và hành lang tuyến; dữ liệu đó chưa đủ để tái hiện hành vi của một xe cụ thể."
      >
        <div className="sim-evidence-summary">
          <span>
            <Check size={16} />
            40 người · 19 ngồi + 21 đứng
          </span>
          <span>
            <Eye size={16} />
            Không có luồng GPS xe thật
          </span>
        </div>
        <div className="sim-parameter-list">
          {P.parameters.map((p) => (
            <article key={p.name}>
              <span className={"sim-evidence-tag " + p.status}>
                {statuses[p.status] || p.status}
              </span>
              <h3>{p.name}</h3>
              <strong>{p.value}</strong>
              {p.note && <p>{p.note}</p>}
            </article>
          ))}
        </div>
        <div className="sim-audit">
          <h3>Hình học và chuyển động</h3>
          <p>
            Đường có hướng, nút giao và điểm đèn được giữ theo OSM. Xe nối các
            nhánh đường bằng tiếp tuyến, giảm tốc theo độ cong, bám xe trước
            bằng IDM và giới hạn độ thay đổi gia tốc. Thân xe và hai trục được
            tính riêng khi cua.
          </p>
          <p>
            Kiểm tra mô hình:{" "}
            <strong>
              {R.stats.redCrossings} lần vượt đèn đỏ · {R.stats.overlaps} lần
              chồng xe
            </strong>
            . Góc lái lớn nhất {R.stats.maxBusSteeringDegrees}°. Đây là kiểm tra
            các xe cùng luồng; chưa mô phỏng đầy đủ xe máy, người đi bộ hay dòng
            cắt ngang.
          </p>
          <p>
            Mép đường hiện được suy ra từ số làn hoặc bề rộng trong OSM. Góc
            thân xe lệch tối đa{" "}
            <strong>
              {N.clearance.maxOutsideEstimatedAsphaltM.toLocaleString("vi-VN")}{" "}
              m
            </strong>{" "}
            khỏi phạm vi mặt đường ước tính trong phép kiểm tra. Vùng này được
            đánh dấu trên bản đồ, cần ảnh hoặc khảo sát để nghiệm thu; con số
            này không phải sai số GPS thực địa.
          </p>
          <p>
            Điểm dừng, thời gian đèn 80 giây và lưu lượng xe nền là kịch bản.
            Các điểm GPS gốc của bạn được giữ riêng để đối chiếu, không bị kéo
            sang đường mới.
          </p>
          <a href={asset("NOTICE.txt")} target="_blank" rel="noreferrer">
            Mã nguồn, thư viện và giấy phép <ExternalLink size={13} />
          </a>
        </div>
        <div className="sim-source-list">
          <h3>Nguồn đã đối chiếu · {P.version}</h3>
          {P.sources.map((s) => (
            <article key={s.id}>
              <a href={s.url} target="_blank" rel="noreferrer">
                {s.title}
                <ExternalLink size={13} />
              </a>
              <p>{s.usedFor}</p>
              <small>
                {s.publishedAt ? `Đăng ${s.publishedAt} · ` : ""}Kiểm tra{" "}
                {s.checkedAt}
                {s.accessible === false ? " · Không đọc được bài đăng" : ""}
              </small>
            </article>
          ))}
        </div>
        <details className="sim-source-conflict">
          <summary>Thông tin khác nhau giữa các nguồn</summary>
          {P.conflicts.map((c) => (
            <p key={c.url}>
              {c.note}{" "}
              <a href={c.url} target="_blank" rel="noreferrer">
                Xem nguồn
              </a>
            </p>
          ))}
        </details>
      </Modal>
      <Modal
        open={signalId !== null}
        onOpenChange={(open) => {
          if (!open) setSignalId(null);
        }}
        title="Đèn giao thông trên bản đồ"
        description={
          N.gates.some((g) => g.id === signalId)
            ? "Vị trí từ OSM; đang dùng chu kỳ giả định 80 giây cho kịch bản, không phải trạng thái đèn ngoài đường."
            : "Vị trí từ OSM; chưa có chu kỳ điều khiển trong kịch bản này."
        }
      >
        <p>Mã điểm OSM: {signalId}</p>
        <a
          href={"https://www.openstreetmap.org/node/" + signalId}
          target="_blank"
          rel="noreferrer"
        >
          Xem dữ liệu nguồn <ExternalLink size={13} />
        </a>
      </Modal>
    </div>
  );
}
