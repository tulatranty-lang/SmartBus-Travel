import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, clearSession, saveSession, session, qs } from "./api";
import type { AuthData, Place, Route, User } from "./types";
export const regions: Record<string, string> = {
  DN: "Đà Nẵng",
  QN_CU: "Quảng Nam cũ",
  HUE: "Huế",
  QT: "Quảng Trị",
  QNG: "Quảng Ngãi",
};
export const centers: Record<string, [number, number]> = {
  DN: [108.213, 16.056],
  QN_CU: [108.328, 15.881],
  HUE: [107.585, 16.463],
  QT: [107.1, 16.85],
  QNG: [108.79, 15.13],
};
export const categories: Record<string, string> = {
  "": "Tất cả",
  beach: "Biển & đảo",
  culture: "Văn hóa",
  heritage: "Di sản",
  nature: "Thiên nhiên",
  spiritual: "Tâm linh",
  shopping: "Mua sắm",
  food: "Ẩm thực",
  checkin: "Check-in",
  entertainment: "Vui chơi",
  general: "Khám phá",
};
export const number = (v?: number) =>
    new Intl.NumberFormat("vi-VN").format(v || 0),
  date = (v?: string) =>
    v
      ? new Intl.DateTimeFormat("vi-VN", {
          dateStyle: "medium",
          timeStyle: "short",
        }).format(new Date(v))
      : "Chưa cập nhật";
export const initials = (v: string) =>
  v
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((v) => v[0])
    .join("")
    .toUpperCase();
export const routeName = (r: Partial<Route>) =>
  r.displayCode || r.code || r.routeCode || r.id || "Tuyến xe";
export const normalized = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .toLowerCase();
export const point = (p: {
  lat?: number;
  lng?: number;
  latitude?: number;
  longitude?: number;
}): [number, number] | null => {
  const a = p.latitude ?? p.lat,
    b = p.longitude ?? p.lng;
  return a != null && b != null && Number.isFinite(+a) && Number.isFinite(+b)
    ? [+b, +a]
    : null;
};
export const distance = (v?: number | null) =>
  v == null
    ? "Chưa có khoảng cách"
    : v >= 1000
      ? `${(v / 1000).toFixed(1)} km`
      : `${Math.round(v)} m`;
export function photo(p: Partial<Place>) {
  if (p.thumbnailUrl && /^https?:\/\//i.test(p.thumbnailUrl))
    return { src: p.thumbnailUrl, area: false };
  let file = "danang.jpg",
    area = true;
  if (p.provinceCode === "QN_CU") {
    file = "hoian.jpg";
    area = !/phố cổ hội an/i.test(p.name || "");
  } else if (p.provinceCode === "HUE") {
    file = "hue.jpg";
    area = !/đại nội/i.test(p.name || "");
  } else if (p.category === "beach") {
    file = "beach.jpg";
    area = !/mỹ khê/i.test(p.name || "");
  }
  return { src: import.meta.env.BASE_URL + "images/" + file, area };
}
interface State {
  user: User | null;
  authOpen: boolean;
  setAuthOpen: (v: boolean) => void;
  login: (d: AuthData, remember: boolean) => void;
  logout: () => Promise<void>;
  requireUser: () => boolean;
  region: string;
  setRegion: (v: string) => void;
  placeId: number | null;
  setPlaceId: (v: number | null) => void;
  routeId: string | null;
  setRouteId: (v: string | null) => void;
  chatOpen: boolean;
  setChatOpen: (v: boolean) => void;
  searchOpen: boolean;
  setSearchOpen: (v: boolean) => void;
  position: { lat: number; lng: number } | null;
  setPosition: (v: { lat: number; lng: number }) => void;
  locating: boolean;
  locate: () => Promise<void>;
}
const Context = createContext<State | null>(null);
export function AppState({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [user, setUser] = useState<User | null>(() => session().user);
  const [authOpen, setAuthOpen] = useState(false),
    [placeId, setPlaceId] = useState<number | null>(null),
    [routeId, setRouteId] = useState<string | null>(null),
    [chatOpen, setChatOpen] = useState(false),
    [searchOpen, setSearchOpen] = useState(false);
  const [region, setRegionState] = useState(() => {
    try {
      const v = localStorage.getItem("smartbus_region");
      return v && regions[v] ? v : "DN";
    } catch {
      return "DN";
    }
  });
  const [position, setPosition] = useState<State["position"]>(null),
    [locating, setLocating] = useState(false);
  useEffect(() => {
    const sync = () => setUser(session().user);
    window.addEventListener("smartbus:session", sync);
    return () => window.removeEventListener("smartbus:session", sync);
  }, []);
  useEffect(() => {
    if (!session().access) return;
    const c = new AbortController();
    api<User>("/users/me", { signal: c.signal })
      .then((r) => {
        const s = session();
        if (s.refresh)
          saveSession({
            user: r.data,
            accessToken: s.access || "",
            refreshToken: s.refresh,
          });
      })
      .catch((e) => {
        if (e.status === 401) clearSession();
      });
    return () => c.abort();
  }, []);
  const logout = async () => {
    try {
      if (session().refresh)
        await api("/auth/logout", {
          method: "POST",
          body: { refreshToken: session().refresh },
          refresh: false,
        });
    } finally {
      clearSession();
      client.clear();
    }
  };
  const locate = () =>
    new Promise<void>((resolve) => {
      if (!navigator.geolocation) {
        toast.error("Trình duyệt chưa hỗ trợ định vị. Có thể nhập tọa độ.");
        resolve();
        return;
      }
      setLocating(true);
      navigator.geolocation.getCurrentPosition(
        (p) => {
          setPosition({ lat: p.coords.latitude, lng: p.coords.longitude });
          setLocating(false);
          resolve();
        },
        (e) => {
          setLocating(false);
          toast.error(
            e.code === 1
              ? "Bạn chưa cấp quyền vị trí. Có thể nhập tọa độ hoặc thử lại."
              : "Chưa lấy được vị trí. Vui lòng thử lại.",
          );
          resolve();
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 },
      );
    });
  return (
    <Context.Provider
      value={{
        user,
        authOpen,
        setAuthOpen,
        login: (d, r) => {
          client.clear();
          saveSession(d, r);
          setAuthOpen(false);
        },
        logout,
        requireUser: () => {
          if (user) return true;
          setAuthOpen(true);
          return false;
        },
        region,
        setRegion: (v) => {
          setRegionState(v);
          try {
            localStorage.setItem("smartbus_region", v);
          } catch {}
        },
        placeId,
        setPlaceId,
        routeId,
        setRouteId,
        chatOpen,
        setChatOpen,
        searchOpen,
        setSearchOpen,
        position,
        setPosition,
        locating,
        locate,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useApp() {
  const v = useContext(Context);
  if (!v) throw Error("App provider missing");
  return v;
}
export function useDebounced<T>(v: T, delay = 250) {
  const [s, set] = useState(v);
  useEffect(() => {
    const id = setTimeout(() => set(v), delay);
    return () => clearTimeout(id);
  }, [v, delay]);
  return s;
}
export function useResource<T>(
  key: string,
  path: string,
  params: Record<string, unknown> = {},
  enabled = true,
) {
  return useQuery({
    queryKey: [key, path, params, session().user?.id || 0],
    queryFn: ({ signal }) => api<T>(path + qs(params), { signal }),
    enabled,
  });
}
export function useFavorites() {
  const { user, requireUser } = useApp();
  const client = useQueryClient();
  const routes = useResource<Route[]>(
      "favorite-routes",
      "/favorite-routes",
      {},
      !!user,
    ),
    places = useResource<Place[]>(
      "favorite-places",
      "/favorite-places",
      {},
      !!user,
    );
  const has = (kind: "route" | "place", id: string | number) =>
    (kind === "route" ? routes.data?.data : places.data?.data)?.some(
      (v) => String(v.id) === String(id),
    ) || false;
  const mutation = useMutation({
    mutationFn: ({
      kind,
      id,
      saved,
    }: {
      kind: "place" | "route";
      id: string | number;
      saved: boolean;
    }) =>
      api(
        `/favorite-${kind === "place" ? "places" : "routes"}${saved ? "/" + encodeURIComponent(String(id)) : ""}`,
        {
          method: saved ? "DELETE" : "POST",
          body: saved
            ? undefined
            : kind === "place"
              ? { placeId: id }
              : { routeId: id },
        },
      ),
    onSuccess: (_, v) => {
      client.invalidateQueries({
        queryKey: ["favorite-" + (v.kind === "place" ? "places" : "routes")],
      });
      toast.success(v.saved ? "Đã bỏ lưu." : "Đã thêm vào bộ sưu tập của bạn.");
    },
    onError: (e) => toast.error(e.message),
  });
  return {
    routes,
    places,
    has,
    pending: mutation.isPending,
    toggle: (kind: "place" | "route", id: string | number) => {
      if (requireUser() && !mutation.isPending)
        mutation.mutate({ kind, id, saved: has(kind, id) });
    },
  };
}
