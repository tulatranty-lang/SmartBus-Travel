import { useEffect, useState } from "react";
import {
  Link,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { motion, useReducedMotion } from "motion/react";
import {
  ArrowUpRight,
  Bell,
  Bookmark,
  BusFront,
  ChevronDown,
  Compass,
  Heart,
  History,
  Home,
  Image,
  LogIn,
  LogOut,
  Map,
  MapPin,
  Menu,
  MessageCircle,
  Route,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";
import { useApp, useResource, regions, initials, date } from "../state";
import { Button, Empty, ErrorState, IconButton, Modal, Busy } from "./ui";
import { AuthDialog, DetailsDialogs, SearchDialog } from "./Dialogs";
import { ChatPanel } from "./ChatPanel";
const primary = [
  { to: "/", label: "Tổng quan", icon: Home },
  { to: "/explore", label: "Bản đồ khám phá", icon: Map },
  { to: "/routes", label: "Tuyến xe buýt", icon: BusFront },
  { to: "/places", label: "Điểm đến", icon: Compass },
  { to: "/planner", label: "Lên lịch trình", icon: Route },
];
const secondary = [
  { to: "/favorites", label: "Đã lưu", icon: Bookmark },
  { to: "/community", label: "Góc trải nghiệm", icon: MessageCircle },
  { to: "/history", label: "Hành trình của tôi", icon: History },
];
type Notice = { id: number; title: string; content: string; createdAt: string };
type Credit = {
  title: string;
  source: string;
  author: string;
  license: string;
  licenseUrl: string;
  displayNote: string;
};
export default function Layout() {
  const app = useApp(),
    location = useLocation(),
    nav = useNavigate(),
    reduced = useReducedMotion();
  const [menu, setMenu] = useState(false),
    [notifications, setNotifications] = useState(false),
    [credits, setCredits] = useState(false),
    [photos, setPhotos] = useState<Credit[]>([]),
    [photoError, setPhotoError] = useState("");
  const notices = useResource<Notice[]>(
    "notifications",
    "/notifications",
    {},
    notifications && !!app.user,
  );
  const active =
    [...primary, ...secondary, { to: "/admin", label: "Quản trị" }].find(
      (v) => v.to === location.pathname,
    )?.label || "Khám phá";
  useEffect(() => {
    setMenu(false);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [location.pathname]);
  useEffect(() => {
    function shortcut(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        app.setSearchOpen(!app.searchOpen);
      }
      if (e.key === "Escape") setMenu(false);
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [app.searchOpen]);
  useEffect(() => {
    if (!credits || photos.length) return;
    const c = new AbortController();
    fetch(import.meta.env.BASE_URL + "images/credits.json", {
      signal: c.signal,
    })
      .then((r) => {
        if (!r.ok) throw Error("Chưa tải được thông tin ảnh.");
        return r.json();
      })
      .then(setPhotos)
      .catch((e) => {
        if (e.name !== "AbortError") setPhotoError(e.message);
      });
    return () => c.abort();
  }, [credits, photos.length]);
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Đến nội dung chính
      </a>
      {menu && (
        <button
          className="sidebar-backdrop"
          aria-label="Đóng trình đơn"
          onClick={() => setMenu(false)}
        />
      )}
      <aside
        className={`sidebar ${menu ? "sidebar-open" : ""}`}
        aria-label="Điều hướng chính"
      >
        <IconButton
          icon={X}
          label="Đóng trình đơn"
          className="sidebar-close"
          onClick={() => setMenu(false)}
        />
        <Link to="/" className="brand">
          <span className="brand-icon">
            <BusFront size={25} />
          </span>
          <span>
            Smart<span>Bus</span>
            <small>ĐI CHẬM · KHÁM PHÁ SÂU</small>
          </span>
        </Link>
        <p className="nav-label">KHÁM PHÁ MIỀN TRUNG</p>
        <nav>
          {primary.map((v) => (
            <NavLink
              key={v.to}
              to={v.to}
              end={v.to === "/"}
              className={({ isActive }) =>
                `nav-link ${isActive ? "active" : ""}`
              }
            >
              <v.icon size={19} />
              {v.label}
              {v.to === "/planner" && (
                <span className="nav-new">DÀNH CHO BẠN</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="nav-divider" />
        <p className="nav-label">KHÔNG GIAN CỦA BẠN</p>
        <nav>
          {secondary.map((v) => (
            <NavLink
              key={v.to}
              to={v.to}
              className={({ isActive }) =>
                `nav-link ${isActive ? "active" : ""}`
              }
            >
              <v.icon size={18} />
              {v.label}
            </NavLink>
          ))}
          {app.user?.role === "admin" && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                `nav-link ${isActive ? "active" : ""}`
              }
            >
              <ShieldCheck size={18} />
              Quản trị
            </NavLink>
          )}
        </nav>
        <button className="sidebar-help" onClick={() => app.setChatOpen(true)}>
          <span className="help-icon">
            <Sparkles size={23} />
          </span>
          <strong>Bạn muốn đi đâu?</strong>
          <span>Cùng tìm một hành trình phù hợp.</span>
          <b>
            Hỏi trợ lý SmartBus
            <ArrowUpRight size={15} />
          </b>
        </button>
        <div className="sidebar-bottom">
          <Heart size={11} />
          Một chuyến xe, nhiều trải nghiệm.
          <button onClick={() => setCredits(true)}>
            <Image size={11} />
            Nguồn ảnh & bản quyền
          </button>
        </div>
      </aside>
      <div className="app-main">
        <header className="topbar">
          <div className="topbar-left">
            <IconButton
              icon={Menu}
              label="Mở trình đơn"
              className="mobile-menu"
              onClick={() => setMenu(true)}
              aria-expanded={menu}
            />
            <div className="breadcrumb">
              SmartBus<span>/</span>
              <strong>{active}</strong>
            </div>
            <Link to="/" className="mobile-title">
              <BusFront size={21} />
              SmartBus
            </Link>
          </div>
          <div className="topbar-right">
            <button
              className="top-search"
              onClick={() => app.setSearchOpen(true)}
            >
              <Search size={15} />
              <span>Tìm nhanh hành trình…</span>
              <kbd>⌘ K</kbd>
            </button>
            <label className="region-select">
              <MapPin size={15} />
              <select
                value={app.region}
                aria-label="Khu vực khám phá"
                onChange={(e) => {
                  app.setRegion(e.target.value);
                  if (location.pathname === "/explore") nav("/explore");
                }}
              >
                {Object.entries(regions).map(([v, n]) => (
                  <option value={v} key={v}>
                    {n}
                  </option>
                ))}
              </select>
              <ChevronDown size={11} />
            </label>
            <IconButton
              icon={Bell}
              label="Thông báo"
              className="notification-button"
              onClick={() => {
                if (app.requireUser()) setNotifications(true);
              }}
            />
            {app.user ? (
              <Dropdown.Root>
                <Dropdown.Trigger asChild>
                  <button
                    className="profile-button"
                    aria-label="Tài khoản của bạn"
                  >
                    <span className="avatar">
                      {initials(app.user.fullName)}
                    </span>
                    <span className="profile-text">
                      <strong>{app.user.fullName}</strong>
                      <small>
                        {app.user.role === "admin"
                          ? "Quản trị viên"
                          : "Người bạn đồng hành"}
                      </small>
                    </span>
                    <ChevronDown size={13} />
                  </button>
                </Dropdown.Trigger>
                <Dropdown.Portal>
                  <Dropdown.Content
                    className="dropdown-menu"
                    align="end"
                    sideOffset={15}
                  >
                    <div className="dropdown-user">
                      <strong>{app.user.fullName}</strong>
                      <small>{app.user.email}</small>
                    </div>
                    <Dropdown.Separator className="nav-divider" />
                    {[
                      {
                        label: "Thông tin cá nhân",
                        to: "/history?tab=profile",
                        icon: UserRound,
                      },
                      {
                        label: "Bộ sưu tập đã lưu",
                        to: "/favorites",
                        icon: Bookmark,
                      },
                      {
                        label: "Lịch sử hành trình",
                        to: "/history",
                        icon: History,
                      },
                      ...(app.user.role === "admin"
                        ? [
                            {
                              label: "Quản trị hệ thống",
                              to: "/admin",
                              icon: Settings,
                            },
                          ]
                        : []),
                    ].map((v) => (
                      <Dropdown.Item key={v.to} onSelect={() => nav(v.to)}>
                        <v.icon size={16} />
                        {v.label}
                      </Dropdown.Item>
                    ))}
                    <Dropdown.Separator className="nav-divider" />
                    <Dropdown.Item onSelect={() => app.logout()}>
                      <LogOut size={16} />
                      Đăng xuất
                    </Dropdown.Item>
                  </Dropdown.Content>
                </Dropdown.Portal>
              </Dropdown.Root>
            ) : (
              <Button
                variant="secondary"
                className="header-login"
                onClick={() => app.setAuthOpen(true)}
              >
                <LogIn size={15} />
                <span>Đăng nhập</span>
              </Button>
            )}
          </div>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className={`main-content ${location.pathname === "/explore" ? "map-page-content" : ""}`}
        >
          <motion.div
            key={location.pathname}
            initial={reduced ? false : { opacity: 0, y: 7 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Outlet />
          </motion.div>
        </main>
        <footer className="app-footer">
          <span>© {new Date().getFullYear()} SmartBus Travel</span>
          <span>Thông tin tuyến và giá vé mang tính tham khảo.</span>
          <button onClick={() => setCredits(true)}>
            Nguồn ảnh
            <ArrowUpRight size={11} />
          </button>
        </footer>
      </div>
      <nav className="bottom-nav" aria-label="Điều hướng trên điện thoại">
        {[primary[0], primary[1], primary[4], secondary[0], secondary[1]].map(
          (v) => (
            <NavLink
              key={v.to}
              to={v.to}
              end={v.to === "/"}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              <v.icon size={20} />
              <span>
                {v.to === "/explore"
                  ? "Bản đồ"
                  : v.to === "/planner"
                    ? "Lịch trình"
                    : v.to === "/community"
                      ? "Cộng đồng"
                      : v.label}
              </span>
            </NavLink>
          ),
        )}
      </nav>
      <AuthDialog />
      <SearchDialog />
      <DetailsDialogs />
      <ChatPanel />
      <Modal
        open={notifications}
        onOpenChange={setNotifications}
        title="Thông báo của bạn"
        description="Những cập nhật liên quan đến hành trình."
      >
        {notices.isPending ? (
          <Busy />
        ) : notices.error ? (
          <ErrorState error={notices.error} retry={notices.refetch} />
        ) : notices.data?.data.length ? (
          <div className="notification-list">
            {notices.data.data.map((n) => (
              <article key={n.id}>
                <Bell size={19} />
                <div>
                  <strong>{n.title}</strong>
                  <p>{n.content}</p>
                  <small>{date(n.createdAt)}</small>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <Empty
            icon={Bell}
            title="Mọi thứ đã được cập nhật"
            description="Thông báo mới sẽ xuất hiện tại đây."
          />
        )}
      </Modal>
      <Modal
        open={credits}
        onOpenChange={setCredits}
        title="Những góc nhìn làm nên hành trình"
        description="Ảnh khu vực được ghi rõ trên từng thẻ; không thay thế ảnh xác minh của địa điểm."
      >
        {photoError ? (
          <p role="alert">{photoError}</p>
        ) : !photos.length ? (
          <Busy />
        ) : (
          <div className="credits-list">
            {photos.map((p) => (
              <article key={p.title}>
                <a href={p.source} target="_blank" rel="noreferrer">
                  <strong>{p.title}</strong>
                  <ArrowUpRight size={15} />
                </a>
                <p>
                  {p.author} ·{" "}
                  <a href={p.licenseUrl} target="_blank" rel="noreferrer">
                    {p.license}
                  </a>
                </p>
                <small>{p.displayNote}</small>
              </article>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
