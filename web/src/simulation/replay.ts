import type { Replay, SimulationNetwork, VehicleFrame } from "./types";

export function pose(
  network: Pick<SimulationNetwork, "path" | "prefix">,
  s: number,
): [number, number, number] {
  const { path, prefix } = network;
  let lo = 0,
    hi = prefix.length - 2;
  while (lo < hi) {
    const m = (lo + hi + 1) >> 1;
    if (prefix[m] <= s) lo = m;
    else hi = m - 1;
  }
  const a = path[lo],
    b = path[lo + 1],
    u = Math.max(
      0,
      Math.min(1, (s - prefix[lo]) / (prefix[lo + 1] - prefix[lo] || 1)),
    );
  return [
    a[0] + (b[0] - a[0]) * u,
    a[1] + (b[1] - a[1]) * u,
    Math.atan2(b[1] - a[1], b[0] - a[0]),
  ];
}
export function samples(replay: Replay, time: number): VehicleFrame[] {
  const t = Math.max(0, Math.min(replay.duration, time)),
    i = Math.min(replay.frames.length - 1, Math.floor(t / replay.period));
  const a = replay.frames[i],
    b = replay.frames[Math.min(i + 1, replay.frames.length - 1)],
    u = (t - i * replay.period) / replay.period;
  return a.flatMap((v) => {
    const w = b.find((x) => x[0] === v[0]);
    if (!w) return u > 0.5 ? [] : [v];
    return [
      [
        v[0],
        v[1] + (w[1] - v[1]) * u,
        v[2] + (w[2] - v[2]) * u,
        v[3] + Math.atan2(Math.sin(w[3] - v[3]), Math.cos(w[3] - v[3])) * u,
        v[4] + (w[4] - v[4]) * u,
        u < 0.5 ? v[5] : w[5],
      ] as VehicleFrame,
    ];
  });
}
export function phase(time: number) {
  const t = ((time % 80) + 80) % 80;
  return t < 30
    ? { color: "red", label: "Đèn đỏ", remaining: 30 - t }
    : t < 67
      ? { color: "green", label: "Đèn xanh", remaining: 67 - t }
      : t < 71
        ? { color: "yellow", label: "Đèn vàng", remaining: 71 - t }
        : { color: "red", label: "Đỏ toàn nút", remaining: 80 - t };
}
export const clock = (time: number) =>
  `${Math.floor(time / 60)}:${String(Math.floor(time % 60)).padStart(2, "0")}`;
export function busStatus(
  bus: VehicleFrame | undefined,
  network: SimulationNetwork,
  time: number,
) {
  if (!bus) return "Đã đi hết đoạn mô phỏng";
  if (bus[5] === 2) return "Mở cửa · đón và trả khách";
  if (
    bus[2] < 0.2 &&
    network.gates.some((g) => g.s > bus[1] && g.s - bus[1] < 130) &&
    phase(time).color === "red"
  )
    return "Xếp hàng · chờ đèn xanh";
  if (bus[2] < 0.2) return "Đang dừng";
  if (Math.abs(bus[4]) > 0.1) return "Giảm tốc · ôm cua";
  return "Đang di chuyển";
}
