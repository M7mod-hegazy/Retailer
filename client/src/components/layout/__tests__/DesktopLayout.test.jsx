import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import DesktopLayout from "../DesktopLayout";

const mockUseAuthStore = vi.hoisted(() => {
  const store = { user: { name: "Admin", role: "admin" }, permissions: {}, token: "x", logout: vi.fn() };
  const hook = (selector) => selector ? selector(store) : store;
  hook.getState = () => store;
  return hook;
});
const mockUseUpdateStore = vi.hoisted(() => {
  const store = { available: false, downloaded: false };
  const hook = (selector) => selector ? selector(store) : store;
  return hook;
});
const mockUseNotificationStore = vi.hoisted(() => {
  const store = { unreadCount: 0, items: [], fetchNotifications: vi.fn(), markAsRead: vi.fn(), markAllAsRead: vi.fn() };
  const hook = (selector) => selector ? selector(store) : store;
  return hook;
});
const mockUseUiStore = vi.hoisted(() => {
  const store = { openGlobalSearch: vi.fn() };
  const hook = (selector) => selector ? selector(store) : store;
  return hook;
});
const mockUseAppSettingsStore = vi.hoisted(() => {
  const store = { settings: { currency_symbol: "ج.م" }, applySettings: vi.fn() };
  const hook = (selector) => selector ? selector(store) : store;
  return hook;
});

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useNavigate: () => vi.fn(), useLocation: () => ({ pathname: "/dashboard" }) };
});

vi.mock("../../../stores/authStore", () => ({ useAuthStore: mockUseAuthStore }));
vi.mock("../../../stores/updateStore", () => ({ useUpdateStore: mockUseUpdateStore }));
vi.mock("../../../stores/notificationStore", () => ({ useNotificationStore: mockUseNotificationStore }));
vi.mock("../../../stores/uiStore", () => ({ useUiStore: mockUseUiStore }));
vi.mock("../../../stores/appSettingsStore", () => ({ useAppSettingsStore: mockUseAppSettingsStore }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k) => k }) }));
vi.mock("../../../services/offlineSync", () => ({ syncOfflineData: vi.fn() }));

describe("DesktopLayout", () => {
  it("renders children", () => {
    render(<MemoryRouter><DesktopLayout branding={{ title: "Test" }}><div>Page Content</div></DesktopLayout></MemoryRouter>);
    expect(screen.getByText("Page Content")).toBeInTheDocument();
  });

  it("renders sidebar navigation", () => {
    render(<MemoryRouter><DesktopLayout branding={{ title: "Test" }}><div>Content</div></DesktopLayout></MemoryRouter>);
    expect(screen.getByText("مساحة العمل")).toBeInTheDocument();
  });
});
