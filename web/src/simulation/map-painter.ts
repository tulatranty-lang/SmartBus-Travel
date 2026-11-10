import { geoMercator, type GeoProjection } from "d3-geo";
import { phase, pose, samples } from "./replay";
import type {
  MapView,
  Replay,
  SimulationNetwork,
  VehicleFrame,
  VehicleProfile,
  XY,
} from "./types";

const C = {
  land: "#e9eee8",
  water: "#bbdbe1",
  building: "#d8dfd9",
  edge: "#c2ccc7",
  road: "#596567",
  paving: "#c6cec9",
  paint: "#f2efdb",
  text: "#183e46",
  muted: "#597170",
  panel: "#fffef8",
  red: "#df655b",
  yellow: "#e9be5c",
  green: "#4cac87",
  gps: "#aa649f",
  amber: "#c57c29",
};
export class MapPainter {
  private bc: CanvasRenderingContext2D;
  private mc: CanvasRenderingContext2D;
  private projection: GeoProjection = geoMercator();
  private width = 1;
  private height = 1;
  private mpp = 1;
  constructor(
    private base: HTMLCanvasElement,
    private motion: HTMLCanvasElement,
    private data: SimulationNetwork,
    private profile: VehicleProfile,
  ) {
    const bc = base.getContext("2d"),
      mc = motion.getContext("2d");
    if (!bc || !mc) throw Error("Trình duyệt chưa hỗ trợ bản đồ mô phỏng.");
    this.bc = bc;
    this.mc = mc;
  }
  private lngLat = (p: number[]): XY => [
    this.data.origin[0] + p[0] / this.data.scale[0],
    this.data.origin[1] + p[1] / this.data.scale[1],
  ];
  private point = (p: number[]): XY => this.projection(this.lngLat(p)) as XY;
  private visible(p: XY, margin = 40) {
    return (
      p[0] > -margin &&
      p[0] < this.width + margin &&
      p[1] > -margin &&
      p[1] < this.height + margin
    );
  }
  private line(
    ctx: CanvasRenderingContext2D,
    coords: XY[],
    closed = false,
    encoded = true,
  ) {
    ctx.beginPath();
    coords.forEach((c, i) => {
      const p = this.point(encoded ? [c[0] / 10, c[1] / 10] : c);
      if (i) ctx.lineTo(p[0], p[1]);
      else ctx.moveTo(p[0], p[1]);
    });
    if (closed) ctx.closePath();
  }
  private inView(coords: XY[]) {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const c of coords) {
      const p = this.point([c[0] / 10, c[1] / 10]);
      minX = Math.min(minX, p[0]);
      maxX = Math.max(maxX, p[0]);
      minY = Math.min(minY, p[1]);
      maxY = Math.max(maxY, p[1]);
    }
    return (
      maxX > -50 &&
      minX < this.width + 50 &&
      maxY > -50 &&
      minY < this.height + 50
    );
  }
  private setProjection(view: MapView, replay: Replay) {
    const rect = this.base.parentElement!.getBoundingClientRect(),
      w = Math.max(1, rect.width),
      h = Math.max(1, rect.height),
      dpr = Math.min(2, window.devicePixelRatio || 1);
    if (
      this.width !== w ||
      this.height !== h ||
      this.base.width !== Math.round(w * dpr)
    ) {
      this.width = w;
      this.height = h;
      for (const c of [this.base, this.motion]) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
        c.getContext("2d")!.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    }
    const bus = samples(replay, view.time).find((v) => v[0] === 0);
    let centre: number[], span: number;
    if (view.camera === "follow") {
      centre = pose(this.data, bus?.[1] ?? this.data.length - 10);
      span = 105;
    } else if (view.camera === "corner") {
      centre = pose(
        this.data,
        samples(replay, replay.events.corner ?? 0).find(
          (v) => v[0] === 0,
        )?.[1] ?? this.data.length * 0.73,
      );
      span = 360;
    } else if (view.camera === "signals") {
      centre = pose(this.data, 340);
      span = 500;
    } else {
      centre = [820, 160];
      span = Math.max(2400, (1400 * w) / h);
    }
    const min = [centre[0] - span / 2, centre[1] - (span * h) / w / 2],
      max = [centre[0] + span / 2, centre[1] + (span * h) / w / 2];
    this.projection = geoMercator().fitExtent(
      [
        [14, 14],
        [w - 14, h - 14],
      ],
      { type: "LineString", coordinates: [this.lngLat(min), this.lngLat(max)] },
    );
    const t = this.projection.translate();
    this.projection
      .scale(this.projection.scale() * view.zoom)
      .translate([
        w / 2 + (t[0] - w / 2) * view.zoom + view.pan[0],
        h / 2 + (t[1] - h / 2) * view.zoom + view.pan[1],
      ]);
    const a = this.point(centre),
      b = this.point([centre[0] + 1, centre[1]]);
    this.mpp = 1 / Math.hypot(b[0] - a[0], b[1] - a[1]);
  }
  draw(view: MapView, replay: Replay, redrawBase = true) {
    this.setProjection(view, replay);
    if (redrawBase) this.drawBase(view, replay);
    const ctx = this.mc;
    ctx.clearRect(0, 0, this.width, this.height);
    if (view.signals)
      for (const s of this.data.signals) this.signal(s, view.time);
    for (const v of samples(replay, view.time).sort(
      (a, b) => Number(a[0] === 0) - Number(b[0] === 0),
    ))
      this.vehicle(v, replay);
    if (replay.scenarioId === "rain") {
      ctx.strokeStyle = "#72939e44";
      ctx.lineWidth = 0.8;
      for (let i = 0; i < 45; i++) {
        const x = (i * 97) % this.width,
          y = (i * 71 + view.time * 90) % this.height;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 3, y + 10);
        ctx.stroke();
      }
    }
  }
  private drawBase(view: MapView, replay: Replay) {
    const ctx = this.bc,
      { mpp } = this;
    ctx.clearRect(0, 0, this.width, this.height);
    ctx.fillStyle = C.land;
    ctx.fillRect(0, 0, this.width, this.height);
    for (const [type, coords] of this.data.water) {
      this.line(ctx, coords, type === "area");
      if (type === "area") {
        ctx.fillStyle = C.water;
        ctx.fill();
      } else {
        ctx.strokeStyle = C.water;
        ctx.lineWidth = (type === "river" ? 25 : 4) / mpp;
        ctx.stroke();
      }
    }
    if (view.buildings) {
      ctx.fillStyle = C.building;
      ctx.strokeStyle = C.edge;
      ctx.lineWidth = 0.7;
      for (const [, coords] of this.data.buildings)
        if (this.inView(coords)) {
          this.line(ctx, coords, true);
          ctx.fill();
          if (mpp < 2) ctx.stroke();
        }
    }
    const roads = this.data.roads.filter((r) => this.inView(r[6]));
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const r of roads) {
      this.line(ctx, r[6]);
      ctx.strokeStyle = C.paving;
      ctx.lineWidth = (r[2] + 2) / mpp;
      ctx.stroke();
    }
    for (const r of roads) {
      this.line(ctx, r[6]);
      ctx.strokeStyle = C.road;
      ctx.lineWidth = r[2] / mpp;
      ctx.stroke();
    }
    if (view.lanes && mpp < 2) {
      ctx.strokeStyle = C.paint;
      ctx.lineWidth = Math.max(0.5, 0.12 / mpp);
      ctx.setLineDash([4 / mpp, 5 / mpp]);
      for (const r of roads) {
        const n = r[4] ? r[3] : r[3] * 2;
        for (let j = 1; j < n; j++) {
          const offset = (j / n - 0.5) * r[2];
          const coords: XY[] = r[6].map((p, i, pts) => {
            const a = pts[Math.max(0, i - 1)],
              b = pts[Math.min(pts.length - 1, i + 1)],
              dx = b[0] - a[0],
              dy = b[1] - a[1],
              l = Math.hypot(dx, dy) || 1;
            return [
              p[0] / 10 + (dy / l) * offset,
              p[1] / 10 - (dx / l) * offset,
            ];
          });
          this.line(ctx, coords, false, false);
          ctx.stroke();
        }
      }
      ctx.setLineDash([]);
      for (const c of this.data.crossings) {
        const p = this.point([c[1], c[2]]);
        if (!this.visible(p)) continue;
        ctx.save();
        ctx.translate(...p);
        ctx.rotate(-c[3]);
        ctx.fillStyle = C.paint;
        for (let x = -2.7; x <= 2.7; x += 1.2)
          ctx.fillRect(x / mpp, -c[4] / 2 / mpp, 0.5 / mpp, c[4] / mpp);
        ctx.restore();
      }
    }
    this.line(ctx, this.data.path, false, false);
    ctx.lineWidth = Math.max(1.5, 1.4 / mpp);
    ctx.strokeStyle = this.profile.vehicle.paint;
    ctx.globalAlpha = 0.45;
    ctx.stroke();
    ctx.globalAlpha = 1;
    for (const g of this.data.gates) {
      const a = pose(this.data, g.s),
        p = this.point(a);
      if (!this.visible(p)) continue;
      ctx.save();
      ctx.translate(...p);
      ctx.rotate(-a[2]);
      ctx.strokeStyle = C.paint;
      ctx.lineWidth = 0.35 / mpp;
      ctx.beginPath();
      ctx.moveTo(0, -4 / mpp);
      ctx.lineTo(0, 4 / mpp);
      ctx.stroke();
      ctx.restore();
    }
    const stop = pose(this.data, this.data.stop.s),
      sp = this.point(stop);
    if (this.visible(sp)) {
      ctx.save();
      ctx.translate(...sp);
      ctx.rotate(-stop[2]);
      ctx.strokeStyle = C.yellow;
      ctx.setLineDash([3, 3]);
      ctx.lineWidth = 1.2;
      ctx.strokeRect(-16 / mpp, -5 / mpp, 16 / mpp, 4 / mpp);
      ctx.restore();
      if (mpp < 2)
        this.label(
          `Bến kịch bản · ${replay.passengers.dwellSeconds} s`,
          [sp[0] + 20, sp[1] + 28],
          C.text,
        );
    }
    if (view.gps)
      for (const p of this.data.rawPoints) {
        const x = this.projection(p.coord) as XY;
        if (!this.visible(x)) continue;
        ctx.beginPath();
        ctx.arc(...x, 5, 0, Math.PI * 2);
        ctx.fillStyle = C.panel;
        ctx.fill();
        ctx.strokeStyle = C.gps;
        ctx.lineWidth = 2;
        ctx.stroke();
        this.label(p.name, [x[0], x[1] - 13], C.gps);
      }
    if (
      view.envelope &&
      this.data.clearance.maxOutsideEstimatedAsphaltM > 0.1
    ) {
      const p = this.point(this.data.clearance.worst.point);
      ctx.beginPath();
      ctx.arc(...p, Math.max(11, 10 / mpp), 0, Math.PI * 2);
      ctx.fillStyle = "#e0a25033";
      ctx.fill();
      ctx.strokeStyle = C.amber;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
      if (this.visible(p))
        this.label("Cần xác minh mép đường", [p[0], p[1] - 23], C.amber);
    }
    const seen = new Set<string>(),
      labels: XY[] = [];
    if (mpp < 6)
      for (const r of roads) {
        if (!r[1] || seen.has(r[1])) continue;
        const a = r[6][Math.floor(r[6].length / 2)],
          p = this.point([a[0] / 10, a[1] / 10]);
        if (
          p[0] < 90 ||
          p[0] > this.width - 100 ||
          p[1] < 150 ||
          p[1] > this.height - 115 ||
          labels.some(
            (q) => Math.abs(p[0] - q[0]) < 130 && Math.abs(p[1] - q[1]) < 34,
          )
        )
          continue;
        seen.add(r[1]);
        labels.push(p);
        this.label(r[1], p, C.muted);
      }
    // A metric scale responds to camera zoom instead of a decorative fixed bar.
    const metres = mpp < 0.4 ? 10 : mpp < 1 ? 25 : mpp < 3 ? 50 : 200,
      x = 18,
      y = this.height - 27;
    ctx.strokeStyle = C.text;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y - 4);
    ctx.lineTo(x, y);
    ctx.lineTo(x + metres / mpp, y);
    ctx.lineTo(x + metres / mpp, y - 4);
    ctx.stroke();
    ctx.font = "10px system-ui";
    ctx.fillStyle = C.text;
    ctx.fillText(`${metres} m`, x, y - 8);
  }
  private label(text: string, p: XY, color: string) {
    const c = this.bc;
    c.font = "11px system-ui";
    c.textAlign = "center";
    c.lineWidth = 3.5;
    c.strokeStyle = C.land;
    c.strokeText(text, ...p);
    c.fillStyle = color;
    c.fillText(text, ...p);
    c.textAlign = "start";
  }
  private signal(s: [string, number, number], time: number) {
    const p = this.point([s[1], s[2]]);
    if (!this.visible(p)) return;
    const ctx = this.mc,
      assigned = this.data.gates.some((g) => g.id === s[0]),
      ph = phase(time).color;
    ctx.fillStyle = "#253d42";
    ctx.beginPath();
    ctx.roundRect(p[0] - 4.5, p[1] - 26, 9, 24, 3);
    ctx.fill();
    ctx.fillRect(p[0] - 0.7, p[1] - 2, 1.4, 7);
    for (const [i, color] of ["red", "yellow", "green"].entries()) {
      ctx.beginPath();
      ctx.arc(p[0], p[1] - 21 + i * 7.2, 2.5, 0, Math.PI * 2);
      ctx.fillStyle =
        assigned && ph === color
          ? C[color as "red" | "yellow" | "green"]
          : "#6e7a79";
      ctx.fill();
    }
  }
  private vehicle(v: VehicleFrame, replay: Replay) {
    const spec = replay.specs.find((x) => x.id === v[0])!;
    const front = pose(this.data, v[1]),
      p = this.point([
        front[0] - (Math.cos(v[3]) * spec.length) / 2,
        front[1] - (Math.sin(v[3]) * spec.length) / 2,
      ]);
    if (!this.visible(p, 70)) return;
    const ctx = this.mc,
      isBus = spec.type === "bus",
      L = spec.length / this.mpp,
      B = spec.width / this.mpp;
    ctx.save();
    ctx.translate(...p);
    ctx.rotate(-v[3]);
    const frontAxle = isBus
      ? spec.length / 2 - spec.frontOverhang!
      : spec.length * 0.28;
    const rearAxle = isBus ? frontAxle - spec.wheelbase! : -spec.length * 0.28;
    ctx.fillStyle = "#24363b";
    for (const [i, axle] of [rearAxle, frontAxle].entries())
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.translate(axle / this.mpp, side * B * 0.51);
        if (i === 1) ctx.rotate(-v[4]);
        ctx.fillRect(
          -0.4 / this.mpp,
          -0.14 / this.mpp,
          0.8 / this.mpp,
          0.28 / this.mpp,
        );
        ctx.restore();
      }
    ctx.shadowColor = "#18333235";
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 2;
    ctx.fillStyle = isBus
      ? this.profile.vehicle.paint
      : ["#eee9db", "#a5b0b2", "#385b69"][v[0] % 3];
    ctx.strokeStyle = "#ffffffbb";
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.roundRect(-L / 2, -B / 2, L, B, Math.min(0.45 / this.mpp, B * 0.2));
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    if (this.mpp < 1) {
      ctx.fillStyle = "#23414b";
      ctx.fillRect(L * 0.3, -B * 0.39, L * 0.1, B * 0.78);
      if (isBus) {
        ctx.fillStyle = "#dae9e8";
        ctx.fillRect(-L * 0.23, -B * 0.21, L * 0.18, B * 0.42);
        ctx.fillRect(L * 0.02, -B * 0.18, L * 0.12, B * 0.36);
        ctx.fillStyle = this.profile.vehicle.stripeColors[0];
        ctx.fillRect(-L * 0.45, -B * 0.45, L * 0.75, B * 0.08);
        ctx.fillRect(-L * 0.45, B * 0.37, L * 0.75, B * 0.08);
        if (v[5] === 2) {
          ctx.strokeStyle = C.panel;
          ctx.lineWidth = 1.4;
          for (const x of [L * 0.27, -L * 0.15]) {
            ctx.beginPath();
            ctx.moveTo(x, B / 2);
            ctx.lineTo(x + 0.6 / this.mpp, B / 2 + 1 / this.mpp);
            ctx.stroke();
          }
        }
      }
      ctx.fillStyle = "#fff5c1";
      ctx.fillRect(
        L / 2 - 0.15 / this.mpp,
        -B * 0.38,
        0.15 / this.mpp,
        B * 0.16,
      );
      ctx.fillRect(
        L / 2 - 0.15 / this.mpp,
        B * 0.22,
        0.15 / this.mpp,
        B * 0.16,
      );
      ctx.fillStyle = v[5] ? "#fc5f4d" : "#b85c55";
      ctx.fillRect(-L / 2, -B * 0.4, 0.15 / this.mpp, B * 0.8);
    }
    ctx.restore();
    if (isBus) {
      ctx.fillStyle = C.panel;
      ctx.strokeStyle = this.profile.vehicle.paint;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.roundRect(p[0] - 19, p[1] - B / 2 - 30, 38, 21, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#176282";
      ctx.font = "700 11px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("06 EV", p[0], p[1] - B / 2 - 16);
      ctx.textAlign = "start";
    }
  }
  hitSignal(x: number, y: number) {
    return this.data.signals
      .map((s) => ({
        id: s[0],
        distance: Math.hypot(
          this.point([s[1], s[2]])[0] - x,
          this.point([s[1], s[2]])[1] - 13 - y,
        ),
      }))
      .sort((a, b) => a.distance - b.distance)
      .find((s) => s.distance < 22)?.id;
  }
}
