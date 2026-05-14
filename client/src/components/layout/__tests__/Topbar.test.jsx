import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Topbar from "../Topbar";

const mockUseNotificationStore = vi.hoisted(() => {
  const store = { unreadCount: 0, items: [], fetchNotifications: vi.fn(), markAsRead: vi.fn(), markAllAsRead: vi.fn() };
  const hook = (selector) => selector ? selector(store) : store;
  hook.getState = () => store;
  return hook;
});
const mockUseUiStore = vi.hoisted(() => {
  const store = { openGlobalSearch: vi.fn(), closeGlobalSearch: vi.fn(), globalSearchOpen: false };
  const hook = (selector) => selector ? selector(store) : store;
  return hook;
});
const mockUseAppSettingsStore = vi.hoisted(() => {
  const store = { settings: { currency_symbol: "ر.س" }, applySettings: vi.fn() };
  const hook = (selector) => selector ? selector(store) : store;
  return hook;
});
const mockUseLocation = vi.hoisted(() => vi.fn());

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return { ...actual, useLocation: () => mockUseLocation() };
});

vi.mock("../../../stores/notificationStore", () => ({ useNotificationStore: mockUseNotificationStore }));
vi.mock("../../../stores/uiStore", () => ({ useUiStore: mockUseUiStore }));
vi.mock("../../../stores/appSettingsStore", () => ({ useAppSettingsStore: mockUseAppSettingsStore }));

describe("Topbar", () => {
  beforeEach(() => {
    mockUseLocation.mockReturnValue({ pathname: "/dashboard" });
    mockUseNotificationStore().fetchNotifications = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders current page label based on pathname", () => {
    mockUseLocation.mockReturnValue({ pathname: "/pos" });
    render(<MemoryRouter><Topbar /></MemoryRouter>);
    expect(screen.getByText("نقطة البيع")).toBeInTheDocument();
  });

  it("renders dashboard label by default", () => {
    render(<MemoryRouter><Topbar /></MemoryRouter>);
    expect(screen.getByText("لوحة التحكم")).toBeInTheDocument();
  });

  it("shows unread count badge", () => {
    mockUseNotificationStore().unreadCount = 3;
    render(<MemoryRouter><Topbar /></MemoryRouter>);
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("fetches notifications on mount", () => {
    const fn = vi.fn();
    mockUseNotificationStore().fetchNotifications = fn;
    render(<MemoryRouter><Topbar /></MemoryRouter>);
    expect(fn).toHaveBeenCalled();
  });

  it("calls openGlobalSearch when Ctrl+K is pressed", () => {
    const fn = vi.fn();
    mockUseUiStore().openGlobalSearch = fn;
    render(<MemoryRouter><Topbar /></MemoryRouter>);
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(fn).toHaveBeenCalled();
  });

  it("renders currency symbol from settings", () => {
    render(<MemoryRouter><Topbar /></MemoryRouter>);
    expect(screen.getByText("ر.س")).toBeInTheDocument();
  });
});
