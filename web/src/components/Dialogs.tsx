import { useEffect, useRef, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import {
  ArrowRight,
  BusFront,
  Clock,
  Compass,
  CornerDownLeft,
  ExternalLink,
  Eye,
  EyeOff,
  Flag,
  LockKeyhole,
  Mail,
  MapPin,
  Route as RouteIcon,
  Search,
  ShieldCheck,
  Star,
  Ticket,
  Timer,
  UserRound,
} from "lucide-react";
import { toast } from "sonner";
import {
  useApp,
  useResource,
  useDebounced,
  regions,
  categories,
  routeName,
  photo,
  distance,
} from "../state";
import { api } from "../api";
import type { AuthData, Place, Route, Stop } from "../types";
import { Badge, Button, Busy, Field, Modal, ErrorState } from "./ui";
import { SaveButton } from "./cards";
export function AuthDialog() {
  const { authOpen, setAuthOpen, login } = useApp();
  const [mode, setMode] = useState<"login" | "register">("login"),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [show, setShow] = useState(false);
  const pending = useRef<AbortController | null>(null);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const f = new FormData(e.currentTarget),
      email = String(f.get("email") || "").trim(),
      password = String(f.get("password") || ""),
      fullName = String(f.get("fullName") || "").trim();
    setError("");
    if (
      mode === "register" &&
      (password.length < 8 || new TextEncoder().encode(password).length > 72)
    ) {
      setError("Mật khẩu cần ít nhất 8 ký tự và không vượt quá 72 byte.");
      return;
    }
    const c = new AbortController();
    pending.current = c;
    setBusy(true);
    try {
      const r = await api<AuthData>("/auth/" + mode, {
        method: "POST",
        body:
          mode === "register"
            ? { fullName, email, password }
            : { email, password },
        anonymous: true,
        refresh: false,
        signal: c.signal,
      });
      if (c.signal.aborted) return;
      login(r.data, f.get("remember") === "on");
      toast.success(
        mode === "register"
          ? "Chào mừng bạn đến với SmartBus!"
          : "Đăng nhập thành công.",
      );
    } catch (e) {
      if ((e as Error).name !== "AbortError") setError((e as Error).message);
    } finally {
      if (pending.current === c) {
        setBusy(false);
        pending.current = null;
      }
    }
  }
  return (
    <Modal
      open={authOpen}
      onOpenChange={(v) => {
        if (!v) {
          pending.current?.abort();
          pending.current = null;
          setBusy(false);
        }
        setAuthOpen(v);
        setError("");
      }}
      title={
        mode === "login"
          ? "Hành trình bắt đầu từ đây."
          : "Xin chào, người bạn đồng hành."
      }
      description={
        mode === "login"
          ? "Đăng nhập để lưu những nơi bạn muốn đến."
          : "Tạo tài khoản và viết tiếp hành trình của riêng bạn."
      }
      className="auth-dialog"
    >
      <div className="auth-brand">
        <BusFront size={24} />
        <span>
          Smart<span>Bus</span>
        </span>
        <span className="auth-small-label">MIỀN TRUNG TRONG TẦM TAY</span>
      </div>
      <div className="auth-tabs">
        <button
          disabled={busy}
          aria-pressed={mode === "login"}
          className={mode === "login" ? "active" : ""}
          onClick={() => {
            setMode("login");
            setError("");
          }}
        >
          Đăng nhập
        </button>
        <button
          disabled={busy}
          aria-pressed={mode === "register"}
          className={mode === "register" ? "active" : ""}
          onClick={() => {
            setMode("register");
            setError("");
          }}
        >
          Tạo tài khoản
        </button>
      </div>
      <form className="form-stack" key={mode} onSubmit={submit}>
        {mode === "register" && (
          <Field label="Họ và tên">
            <div className="input-icon">
              <UserRound size={18} />
              <input
                name="fullName"
                autoComplete="name"
                required
                minLength={2}
                maxLength={120}
                placeholder="Tên của bạn"
              />
            </div>
          </Field>
        )}
        <Field label="Email">
          <div className="input-icon">
            <Mail size={18} />
            <input
              name="email"
              type="email"
              autoComplete="email"
              required
              maxLength={254}
              placeholder="ban@example.com"
            />
          </div>
        </Field>
        <Field label="Mật khẩu">
          <div className="input-icon">
            <LockKeyhole size={18} />
            <input
              name="password"
              type={show ? "text" : "password"}
              required
              minLength={mode === "register" ? 8 : 1}
              maxLength={72}
              autoComplete={
                mode === "register" ? "new-password" : "current-password"
              }
              placeholder={
                mode === "register" ? "Tối thiểu 8 ký tự" : "Nhập mật khẩu"
              }
            />
            <button
              type="button"
              className="inline-icon"
              aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
              onClick={() => setShow(!show)}
            >
              {show ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </Field>
        <label className="check-row">
          <input type="checkbox" name="remember" />
          Ghi nhớ trên thiết bị này
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <Button type="submit" busy={busy} className="full-width">
          {mode === "login" ? "Tiếp tục hành trình" : "Tạo tài khoản"}
          <ArrowRight size={17} />
        </Button>
        <p className="auth-security">
          <ShieldCheck size={15} />
          Mật khẩu được bảo vệ bằng mã hóa băm.
        </p>
      </form>
    </Modal>
  );
}
export function SearchDialog() {
  const { searchOpen, setSearchOpen, region, setPlaceId, setRouteId } =
    useApp();
  const [q, setQ] = useState(""),
    text = useDebounced(q);
  useEffect(() => {
    if (!searchOpen) setQ("");
  }, [searchOpen]);
  const routes = useResource<Route[]>(
      "search-routes",
      "/routes",
      { q: text, provinceCode: region, limit: 5 },
      searchOpen && text.trim().length > 1,
    ),
    places = useResource<Place[]>(
      "search-places",
      "/tourism/places",
      { q: text, provinceCode: region, limit: 5 },
      searchOpen && text.trim().length > 1,
    );
  return (
    <Modal
      open={searchOpen}
      onOpenChange={setSearchOpen}
      title="Bạn muốn khám phá điều gì?"
      description={`Tìm tuyến và điểm đến tại ${regions[region]}.`}
      className="search-dialog"
    >
      <label className="command-input">
        <Search size={21} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Thử Hội An, Mỹ Khê hoặc DN-03…"
          autoFocus
          aria-label="Tìm kiếm nhanh"
        />
        <kbd>ESC</kbd>
      </label>
      <div className="command-results">
        {text.trim().length < 2 ? (
          <div className="command-hint">
            <Compass size={26} />
            <p>Nhập ít nhất 2 ký tự để bắt đầu khám phá.</p>
          </div>
        ) : routes.isFetching || places.isFetching ? (
          <Busy text="Đang tìm kết nối phù hợp…" />
        ) : routes.error || places.error ? (
          <ErrorState
            error={routes.error || places.error!}
            retry={() => {
              routes.refetch();
              places.refetch();
            }}
          />
        ) : (
          <>
            {routes.data?.data.length ? (
              <>
                <h4>TUYẾN XE BUÝT</h4>
                {routes.data.data.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      setSearchOpen(false);
                      setRouteId(r.id);
                    }}
                  >
                    <span className="command-icon">
                      <BusFront size={20} />
                    </span>
                    <span>
                      <strong>{routeName(r)}</strong>
                      <small>{r.name}</small>
                    </span>
                    <CornerDownLeft size={15} />
                  </button>
                ))}
              </>
            ) : null}
            {places.data?.data.length ? (
              <>
                <h4>ĐIỂM ĐẾN</h4>
                {places.data.data.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSearchOpen(false);
                      setPlaceId(p.id);
                    }}
                  >
                    <span className="command-icon orange">
                      <Compass size={20} />
                    </span>
                    <span>
                      <strong>{p.name}</strong>
                      <small>{regions[p.provinceCode]}</small>
                    </span>
                    <CornerDownLeft size={15} />
                  </button>
                ))}
              </>
            ) : null}
            {!routes.data?.data.length && !places.data?.data.length && (
              <p className="command-hint">
                Chưa có kết quả cho “{text}”. Thử từ khóa khác.
              </p>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}
export function DetailsDialogs() {
  const { placeId, setPlaceId, routeId, setRouteId, setRegion } = useApp(),
    nav = useNavigate();
  const [report, setReport] = useState(false);
  const place = useResource<Place>(
      "place-detail",
      "/tourism/places/" + placeId,
      {},
      !!placeId,
    ),
    route = useResource<Route>(
      "route-detail",
      "/routes/" + encodeURIComponent(routeId || ""),
      {},
      !!routeId,
    ),
    stops = useResource<Stop[]>(
      "route-stops",
      "/routes/" + encodeURIComponent(routeId || "") + "/stops",
      {},
      !!routeId,
    );
  const p = place.data?.data,
    r = route.data?.data;
  function openMap() {
    if (r && regions[r.provinceCode]) setRegion(r.provinceCode);
    setRouteId(null);
    nav("/explore?route=" + encodeURIComponent(routeId || ""));
  }
  return (
    <>
      <Modal
        open={!!placeId}
        onOpenChange={(v) => {
          if (!v) setPlaceId(null);
        }}
        title={p?.name || "Khám phá điểm đến"}
        wide
        className="place-detail"
      >
        {place.isPending ? (
          <Busy />
        ) : place.error ? (
          <ErrorState error={place.error} retry={place.refetch} />
        ) : (
          p && (
            <>
              <div className="detail-photo">
                <img
                  src={photo(p).src}
                  alt={
                    photo(p).area
                      ? `Ảnh khu vực ${regions[p.provinceCode]}`
                      : p.name
                  }
                />
                <Badge tone="light">
                  {photo(p).area
                    ? "Ảnh khu vực"
                    : categories[p.category] || "Khám phá"}
                </Badge>
                <SaveButton kind="place" id={p.id} />
              </div>
              <div className="detail-meta">
                <Badge tone="teal">
                  <MapPin size={13} />
                  {regions[p.provinceCode] || p.provinceName}
                </Badge>
                {p.averageRating > 0 && (
                  <span>
                    <Star size={15} fill="currentColor" />
                    {Number(p.averageRating).toFixed(1)}
                    <small>({p.reviewCount} đánh giá tham khảo)</small>
                  </span>
                )}
              </div>
              <p className="detail-description">
                {p.description ||
                  p.shortDescription ||
                  "Mô tả đang được cập nhật."}
              </p>
              <div className="detail-facts">
                <div>
                  <Clock size={19} />
                  <span>
                    Giờ mở cửa
                    <strong>{p.openingHours || "Đang cập nhật"}</strong>
                  </span>
                </div>
                <div>
                  <Timer size={19} />
                  <span>
                    Thời gian khám phá
                    <strong>
                      {p.suggestedDurationMinutes
                        ? `${p.suggestedDurationMinutes} phút`
                        : "Tùy hành trình"}
                    </strong>
                  </span>
                </div>
              </div>
              {p.bestTime && (
                <section className="detail-section">
                  <h3>Cảm hứng cho chuyến đi</h3>
                  <p>{p.bestTime}</p>
                </section>
              )}
              {p.foodSuggestions && (
                <section className="detail-section">
                  <h3>Hương vị quanh đây</h3>
                  <p>{p.foodSuggestions}</p>
                </section>
              )}
              <section className="detail-section">
                <h3>
                  <BusFront size={18} />
                  Kết nối bằng xe buýt
                </h3>
                {p.nearbyStops?.length ? (
                  <div className="stop-links">
                    {p.nearbyStops.slice(0, 4).map((s, i) => (
                      <button
                        key={s.stopId + "-" + i}
                        onClick={() => {
                          setPlaceId(null);
                          setRouteId(s.routeId);
                        }}
                      >
                        <span className="stop-link-icon">
                          <MapPin size={19} />
                        </span>
                        <span>
                          <strong>{s.stopName}</strong>
                          <small>
                            {s.routeDisplayCode || s.routeId} ·{" "}
                            {distance(s.distanceMeters)}
                            {s.walkingMinutes
                              ? ` · khoảng ${s.walkingMinutes} phút đi bộ`
                              : ""}
                          </small>
                        </span>
                        <ArrowRight size={16} />
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="muted">
                    Chưa có liên kết tuyến xe được ghi nhận cho địa điểm này.
                  </p>
                )}
              </section>
              <div className="detail-actions">
                <Button
                  onClick={() => {
                    setPlaceId(null);
                    nav("/planner");
                  }}
                >
                  <RouteIcon size={17} />
                  Lên lịch trình
                </Button>
                <a
                  className="button button-secondary"
                  href={`https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink size={16} />
                  Mở chỉ đường
                </a>
              </div>
            </>
          )
        )}
      </Modal>
      <Modal
        open={!!routeId}
        onOpenChange={(v) => {
          if (!v) setRouteId(null);
        }}
        title={r ? `Tuyến ${routeName(r)}` : "Thông tin tuyến xe"}
        wide
      >
        {route.isPending ? (
          <Busy />
        ) : route.error ? (
          <ErrorState error={route.error} retry={route.refetch} />
        ) : (
          r && (
            <>
              <div className="route-detail-header">
                <span className="route-detail-icon">
                  <BusFront size={30} />
                </span>
                <div>
                  <Badge tone="teal">
                    {regions[r.provinceCode] || r.province}
                  </Badge>
                  <h2>{r.name}</h2>
                </div>
                <SaveButton kind="route" id={r.id} />
              </div>
              <div className="detail-facts route-facts">
                <div>
                  <Clock size={18} />
                  <span>
                    Giờ hoạt động
                    <strong>{r.operatingHours || "Đang cập nhật"}</strong>
                  </span>
                </div>
                <div>
                  <Timer size={18} />
                  <span>
                    Tần suất
                    <strong>{r.frequencyText || "Đang cập nhật"}</strong>
                  </span>
                </div>
                <div>
                  <Ticket size={18} />
                  <span>
                    Vé tham khảo<strong>{r.fare || "Đang cập nhật"}</strong>
                  </span>
                </div>
              </div>
              <div className="route-detail-actions">
                <Button onClick={openMap}>
                  <MapPin size={17} />
                  Xem tuyến trên bản đồ
                </Button>
                <Button variant="ghost" onClick={() => setReport(true)}>
                  <Flag size={16} />
                  Góp ý thông tin
                </Button>
              </div>
              {(r.sourceNote || r.id === "DN-06") && (
                <p className="muted route-source-note">
                  {r.sourceNote ||
                    "Giờ trong tài liệu nguồn tuyến 06 có ghi chú lịch Tết. Xem thông tin đối chiếu trước khi dùng để lên chuyến đi."}{" "}
                  <a
                    href="https://www.danangbus.vn/lo-trinh-tuyen.html"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Nguồn Danabus
                  </a>
                </p>
              )}
              {r.id === "DN-06" && (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setRouteId(null);
                    nav("/simulation");
                  }}
                >
                  <BusFront size={16} />
                  Xem mô phỏng đoạn tuyến 06
                </Button>
              )}
              <section className="detail-section">
                <h3>Các điểm dừng trên tuyến</h3>
                {stops.isPending ? (
                  <Busy />
                ) : stops.error ? (
                  <ErrorState error={stops.error} retry={stops.refetch} />
                ) : stops.data?.data.length ? (
                  <ol className="stop-timeline">
                    {stops.data.data.map((s, i) => (
                      <li key={s.id + "-" + i}>
                        <span className="timeline-marker">{i + 1}</span>
                        <div>
                          <strong>{s.name}</strong>
                          {s.address && <p>{s.address}</p>}
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="muted">
                    Chưa có danh sách điểm dừng cho tuyến này.
                  </p>
                )}
              </section>
            </>
          )
        )}
      </Modal>
      <ReportDialog
        open={report}
        onOpenChange={setReport}
        routeId={routeId || ""}
      />
    </>
  );
}
function ReportDialog({
  open,
  onOpenChange,
  routeId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  routeId: string;
}) {
  const mutation = useMutation({
    mutationFn: (note: string) =>
      api("/reports", { method: "POST", body: { routeId, note } }),
    onSuccess: () => {
      toast.success("Đã gửi góp ý. Cảm ơn bạn!");
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message),
  });
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Góp ý thông tin tuyến"
      description={`Tuyến ${routeId}. Chia sẻ điều bạn muốn chúng tôi kiểm tra lại.`}
    >
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate(
            String(new FormData(e.currentTarget).get("note") || ""),
          );
        }}
      >
        <Field label="Nội dung góp ý">
          <textarea
            name="note"
            required
            minLength={5}
            maxLength={500}
            rows={5}
            placeholder="Giờ chạy, điểm dừng hoặc thông tin giá vé cần cập nhật…"
          />
        </Field>
        <Button type="submit" busy={mutation.isPending}>
          Gửi góp ý<ArrowRight size={17} />
        </Button>
      </form>
    </Modal>
  );
}
