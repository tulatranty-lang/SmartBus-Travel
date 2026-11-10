import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { AppState, useApp, useResource } from "./state";
import { api, clearSession, saveSession } from "./api";
import { AuthDialog, DetailsDialogs } from "./components/Dialogs";
import Planner, { Itinerary } from "./pages/Planner";
import Admin from "./pages/Admin";
import { Favorites } from "./pages/PersonalPages";
import type { TripPlan } from "./types";
vi.mock("./api", async () => ({
  ...(await vi.importActual("./api")),
  api: vi.fn(),
}));
const mocked = vi.mocked(api),
  ok = (data: unknown) => ({ success: true, data, message: "OK" });
const account = {
  user: {
    id: 12,
    fullName: "Người kiểm thử",
    email: "ui@example.test",
    role: "user",
  },
  accessToken: "ui-test-token",
  refreshToken: "ui-test-refresh",
};
const plan: TripPlan = {
  title: "Lịch trình kiểm thử",
  items: [
    {
      id: 1,
      name: "Điểm đến kiểm thử",
      provinceCode: "DN",
      category: "culture",
      latitude: 16.05,
      longitude: 108.2,
      averageRating: 0,
      reviewCount: 0,
      suggestedDurationMinutes: 90,
    },
  ],
};
function mount(node: ReactNode) {
  return render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: {
            queries: { retry: false },
            mutations: { retry: false },
          },
        })
      }
    >
      <MemoryRouter>
        <AppState>{node}</AppState>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  clearSession();
  localStorage.clear();
  sessionStorage.clear();
  mocked.mockReset();
  mocked.mockImplementation(
    async (path) => ok(path === "/users/me" ? account.user : []) as never,
  );
});
afterEach(() => {
  cleanup();
  clearSession();
});
function LoginHarness() {
  const a = useApp();
  return (
    <>
      <button onClick={() => a.setAuthOpen(true)}>Mở đăng nhập</button>
      <AuthDialog />
    </>
  );
}
describe("Actual interface behavior with isolated API fixtures", () => {
  it("collapses and expands real itinerary content", async () => {
    mount(<Itinerary plan={plan} />);
    expect(screen.getByText("Điểm đến kiểm thử")).toBeVisible();
    await userEvent.click(
      screen.getByRole("button", { name: "Thu gọn lịch trình" }),
    );
    expect(
      screen.getByRole("button", { name: "Mở rộng lịch trình" }),
    ).toHaveAttribute("aria-expanded", "false");
    await waitFor(() =>
      expect(screen.queryByText("Điểm đến kiểm thử")).not.toBeInTheDocument(),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Mở rộng lịch trình" }),
    );
    expect(await screen.findByText("Điểm đến kiểm thử")).toBeVisible();
  });
  it("cancels a pending plan and ignores a late response", async () => {
    let finish: (v: unknown) => void = () => {};
    mocked.mockImplementation(
      () =>
        new Promise((r) => {
          finish = r as typeof finish;
        }),
    );
    mount(<Planner />);
    await userEvent.click(
      screen.getByRole("button", { name: "Tạo hành trình của tôi" }),
    );
    const signal = mocked.mock.calls[0][1]?.signal;
    await userEvent.click(screen.getByRole("button", { name: "Hủy chờ" }));
    expect(signal?.aborted).toBe(true);
    finish(ok(plan));
    await waitFor(() =>
      expect(screen.queryByText("Lịch trình kiểm thử")).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole("button", { name: "Tạo hành trình của tôi" }),
    ).toBeEnabled();
  });
  it("prevents duplicate planner submissions while pending", async () => {
    mocked.mockImplementation(() => new Promise(() => {}));
    mount(<Planner />);
    const button = screen.getByRole("button", {
      name: "Tạo hành trình của tôi",
    });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(mocked).toHaveBeenCalledTimes(1);
    expect(button).toBeDisabled();
  });
  it("keeps user filters after a failed plan request", async () => {
    mocked.mockRejectedValue(Error("Máy chủ đang bận"));
    mount(<Planner />);
    await userEvent.click(screen.getByRole("button", { name: "2 ngày" }));
    await userEvent.click(screen.getByRole("button", { name: "Biển" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Tạo hành trình của tôi" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Máy chủ đang bận",
    );
    expect(screen.getByRole("button", { name: "2 ngày" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Biển" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });
  it("explains an empty real candidate result", async () => {
    mocked.mockResolvedValue(ok({ ...plan, items: [] }) as never);
    mount(<Planner />);
    await userEvent.click(
      screen.getByRole("button", { name: "Tạo hành trình của tôi" }),
    );
    expect(await screen.findByText("Chưa đủ điểm đến phù hợp")).toBeVisible();
  });
  it("never labels a guest plan as saved", () => {
    mount(<Itinerary plan={plan} />);
    expect(
      screen.queryByText("Đã lưu vào hành trình của bạn"),
    ).not.toBeInTheDocument();
  });
  it("labels a confirmed persisted plan as saved", () => {
    mount(<Itinerary plan={{ ...plan, itineraryId: 8 }} />);
    expect(screen.getByText("Đã lưu vào hành trình của bạn")).toBeVisible();
  });
  it("provides labelled authentication controls and a working visibility toggle", async () => {
    mount(<LoginHarness />);
    await userEvent.click(screen.getByRole("button", { name: "Mở đăng nhập" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText("Email")).toHaveAttribute(
      "type",
      "email",
    );
    expect(
      within(dialog).getByLabelText("Mật khẩu", { exact: true }),
    ).toHaveAttribute("type", "password");
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Hiện mật khẩu" }),
    );
    expect(
      within(dialog).getByLabelText("Mật khẩu", { exact: true }),
    ).toHaveAttribute("type", "text");
  });
  it("rejects an invalid email before sending the form", async () => {
    mount(<LoginHarness />);
    await userEvent.click(screen.getByRole("button", { name: "Mở đăng nhập" }));
    await userEvent.type(screen.getByLabelText("Email"), "invalid");
    await userEvent.type(
      screen.getByLabelText("Mật khẩu", { exact: true }),
      "test-only-password",
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Tiếp tục hành trình" }),
    );
    expect(mocked).not.toHaveBeenCalled();
  });
  it("rejects a registration password exceeding bcrypt UTF-8 byte limits", async () => {
    mount(<LoginHarness />);
    await userEvent.click(screen.getByRole("button", { name: "Mở đăng nhập" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Tạo tài khoản" }),
    );
    await userEvent.type(
      screen.getByLabelText("Họ và tên"),
      "Tài khoản kiểm thử",
    );
    await userEvent.type(
      screen.getByLabelText("Email"),
      "fixture@example.test",
    );
    await userEvent.type(
      screen.getByLabelText("Mật khẩu", { exact: true }),
      "á".repeat(40),
    );
    await userEvent.click(
      screen.getAllByRole("button", { name: "Tạo tài khoản" }).at(-1)!,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("72 byte");
    expect(mocked).not.toHaveBeenCalled();
  });
  it("opens login before loading private favorites", async () => {
    mount(
      <>
        <Favorites />
        <AuthDialog />
      </>,
    );
    expect(screen.getByText("Những nơi bạn muốn trở lại.")).toBeVisible();
    expect(mocked).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Đăng nhập" }));
    expect(screen.getByRole("dialog")).toBeVisible();
  });
  it("blocks guests from admin without sending any admin request", () => {
    mount(<Admin />);
    expect(screen.getByText("Đăng nhập để tiếp tục quản trị")).toBeVisible();
    expect(mocked).not.toHaveBeenCalled();
  });
  it("blocks a normal user from admin even with a stored session", async () => {
    saveSession(account);
    mount(<Admin />);
    expect(screen.getByText("Khu vực dành cho quản trị viên")).toBeVisible();
    await waitFor(() => expect(mocked).toHaveBeenCalled());
    expect(mocked.mock.calls.some((c) => c[0].startsWith("/admin"))).toBe(
      false,
    );
  });
  it("uses the resource path in its cache identity", async () => {
    mocked.mockImplementation(async (path) => ok(path) as never);
    function Resource() {
      const [id, setId] = useState(1),
        q = useResource<string>("detail", "/item/" + id);
      return (
        <>
          <span>{q.data?.data}</span>
          <button onClick={() => setId(2)}>Địa điểm tiếp</button>
        </>
      );
    }
    mount(<Resource />);
    expect(await screen.findByText("/item/1")).toBeVisible();
    await userEvent.click(
      screen.getByRole("button", { name: "Địa điểm tiếp" }),
    );
    expect(await screen.findByText("/item/2")).toBeVisible();
  });
  it("opens different place dialogs without showing the previous cached record", async () => {
    mocked.mockImplementation(
      async (path) =>
        ok(
          path.includes("/1")
            ? plan.items[0]
            : { ...plan.items[0], id: 2, name: "Điểm tiếp theo" },
        ) as never,
    );
    function Switch() {
      const a = useApp();
      return (
        <>
          <button onClick={() => a.setPlaceId(1)}>Điểm một</button>
          <button onClick={() => a.setPlaceId(2)}>Điểm hai</button>
          <DetailsDialogs />
        </>
      );
    }
    mount(<Switch />);
    await userEvent.click(screen.getByRole("button", { name: "Điểm một" }));
    expect(
      await screen.findByRole("heading", { name: "Điểm đến kiểm thử" }),
    ).toBeVisible();
    await userEvent.click(
      screen.getByRole("button", { name: "Đóng hộp thoại" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Điểm hai" }));
    expect(
      await screen.findByRole("heading", { name: "Điểm tiếp theo" }),
    ).toBeVisible();
  });
});
