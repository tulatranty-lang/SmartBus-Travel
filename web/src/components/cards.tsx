import {
  ArrowRight,
  Bookmark,
  BusFront,
  Clock,
  MapPin,
  Star,
  Timer,
} from "lucide-react";
import type { Place, Route } from "../types";
import { categories, photo, regions, routeName, useFavorites } from "../state";
import { Badge, Button } from "./ui";
export function SaveButton({
  kind,
  id,
}: {
  kind: "place" | "route";
  id: number | string;
}) {
  const f = useFavorites(),
    saved = f.has(kind, id);
  return (
    <button
      className={`save-button ${saved ? "is-saved" : ""}`}
      type="button"
      aria-label={saved ? "Bỏ lưu" : "Lưu vào yêu thích"}
      aria-pressed={saved}
      disabled={f.pending}
      onClick={(e) => {
        e.stopPropagation();
        f.toggle(kind, id);
      }}
    >
      <Bookmark size={17} fill={saved ? "currentColor" : "none"} />
    </button>
  );
}
export function PlaceCard({
  place: p,
  onSelect,
}: {
  place: Place;
  onSelect: (p: Place) => void;
}) {
  const image = photo(p);
  return (
    <article className="place-card">
      <div className="place-photo">
        <button onClick={() => onSelect(p)} aria-label={`Xem ${p.name}`}>
          <img
            src={image.src}
            alt={
              image.area
                ? `Phong cảnh khu vực ${regions[p.provinceCode] || p.provinceCode}`
                : p.name
            }
            loading="lazy"
            onError={(e) => {
              e.currentTarget.style.visibility = "hidden";
            }}
          />
        </button>
        <div className="photo-badges">
          <Badge tone="light">
            {categories[p.category] || p.categoryName || "Khám phá"}
          </Badge>
          <SaveButton kind="place" id={p.id} />
        </div>
        {image.area && <span className="area-photo-label">Ảnh khu vực</span>}
      </div>
      <div className="place-card-body">
        <div className="place-location">
          <MapPin size={13} />
          {regions[p.provinceCode] || p.provinceName}
          {p.averageRating > 0 && (
            <span>
              <Star size={13} fill="currentColor" />
              {Number(p.averageRating).toFixed(1)}
            </span>
          )}
        </div>
        <h3>
          <button onClick={() => onSelect(p)}>{p.name}</button>
        </h3>
        <p className="line-clamp-2">
          {p.shortDescription ||
            p.description ||
            "Khám phá thông tin địa điểm và kết nối xe buýt."}
        </p>
        <div className="place-card-footer">
          <span>
            <BusFront size={14} />
            {p.recommendedRoute
              ? routeName(p.recommendedRoute)
              : p.nearestStop?.routeId || "Xem tuyến gần điểm đến"}
          </span>
          <button onClick={() => onSelect(p)} aria-label={`Chi tiết ${p.name}`}>
            <ArrowRight size={17} />
          </button>
        </div>
      </div>
    </article>
  );
}
export function RouteCard({
  route: r,
  onSelect,
}: {
  route: Route;
  onSelect: (r: Route) => void;
}) {
  return (
    <article className="route-card">
      <div className="route-card-top">
        <div className="route-number">
          <BusFront size={20} />
          {routeName(r)}
        </div>
        <SaveButton kind="route" id={r.id} />
      </div>
      <div className="route-stations">
        <div>
          <span className="station-dot" />
          <p>{r.startPoint || r.originName || r.name.split("–")[0]}</p>
        </div>
        <div>
          <span className="station-dot destination" />
          <p>
            {r.endPoint ||
              r.destinationName ||
              r.name.split("–").slice(1).join("–") ||
              r.name}
          </p>
        </div>
      </div>
      <div className="route-metadata">
        <span>
          <Clock size={14} />
          {r.operatingHours || r.time || "Giờ chạy đang cập nhật"}
        </span>
        <span>
          <Timer size={14} />
          {r.frequencyText || r.interval || "Tần suất đang cập nhật"}
        </span>
      </div>
      <div className="route-card-footer">
        <strong>{r.fare || "Giá vé đang cập nhật"}</strong>
        <Button variant="ghost" onClick={() => onSelect(r)}>
          Chi tiết
          <ArrowRight size={15} />
        </Button>
      </div>
    </article>
  );
}
