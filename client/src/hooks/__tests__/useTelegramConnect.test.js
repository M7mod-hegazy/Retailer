import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useTelegramConnect } from "../useTelegramConnect";

const mockApiGet = vi.hoisted(() => vi.fn());
const mockApiPost = vi.hoisted(() => vi.fn());
const mockApiPut = vi.hoisted(() => vi.fn());
vi.mock("../../services/api", () => ({ default: { get: mockApiGet, post: mockApiPost, put: mockApiPut } }));

const mockToast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("react-hot-toast", () => ({ default: mockToast }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (k) => k }) }));

describe("useTelegramConnect", () => {
  beforeEach(() => {
    mockApiGet.mockReset().mockResolvedValue({ data: { data: {} } });
    mockApiPost.mockReset();
    mockApiPut.mockReset().mockResolvedValue({});
    mockToast.success.mockReset();
    mockToast.error.mockReset();
  });

  it("loads settings on mount and marks saved when already configured", async () => {
    mockApiGet.mockResolvedValue({ data: { data: { telegram_enabled: true, telegram_bot_token: "tok", telegram_chat_id: "123" } } });
    const { result } = renderHook(() => useTelegramConnect());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.config.telegram_bot_token).toBe("tok");
    expect(result.current.saved).toBe(true);
  });

  it("flags loadError when settings fail to load", async () => {
    mockApiGet.mockRejectedValue(new Error("no perms"));
    const { result } = renderHook(() => useTelegramConnect());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.loadError).toBe(true);
  });

  it("detectChatId requires a token first", async () => {
    const { result } = renderHook(() => useTelegramConnect());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.detectChatId(); });
    expect(mockApiPost).not.toHaveBeenCalled();
    expect(mockToast.error).toHaveBeenCalledWith("telegram.detectNeedsToken");
  });

  it("detectChatId fills the chat id on success", async () => {
    const { result } = renderHook(() => useTelegramConnect());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { result.current.setConfig((c) => ({ ...c, telegram_bot_token: "tok" })); });
    mockApiPost.mockResolvedValue({ data: { data: { chatId: "555", chatName: "Owner" } } });
    await act(async () => { await result.current.detectChatId(); });
    expect(result.current.config.telegram_chat_id).toBe("555");
    expect(mockToast.success).toHaveBeenCalled();
  });

  it("generateDeepLink stores the returned QR payload", async () => {
    const { result } = renderHook(() => useTelegramConnect());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { result.current.setConfig((c) => ({ ...c, telegram_bot_token: "tok" })); });
    mockApiPost.mockResolvedValue({ data: { data: { qr: "data:image/png;base64,x", url: "https://t.me/x" } } });
    await act(async () => { await result.current.generateDeepLink(); });
    expect(result.current.qrData).toEqual({ qr: "data:image/png;base64,x", url: "https://t.me/x" });
  });

  it("save rejects enabling without a token and chat id", async () => {
    const { result } = renderHook(() => useTelegramConnect());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { result.current.setConfig((c) => ({ ...c, telegram_enabled: true })); });
    await act(async () => { await result.current.save(); });
    expect(mockApiPut).not.toHaveBeenCalled();
  });

  it("save persists settings and marks saved when fully configured", async () => {
    const { result } = renderHook(() => useTelegramConnect());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { result.current.setConfig((c) => ({ ...c, telegram_enabled: true, telegram_bot_token: "tok", telegram_chat_id: "1" })); });
    await act(async () => { await result.current.save(); });
    expect(result.current.saved).toBe(true);
    expect(mockApiPut).toHaveBeenCalledWith("/api/settings", expect.objectContaining({ telegram_enabled: true, telegram_bot_token: "tok", telegram_chat_id: "1" }));
  });

  it("calls the onSaved callback after a successful save", async () => {
    const onSaved = vi.fn();
    const { result } = renderHook(() => useTelegramConnect(onSaved));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { result.current.setConfig((c) => ({ ...c, telegram_enabled: true, telegram_bot_token: "tok", telegram_chat_id: "1" })); });
    await act(async () => { await result.current.save(); });
    expect(onSaved).toHaveBeenCalled();
  });

  it("sendTest calls the telegram test endpoint", async () => {
    const { result } = renderHook(() => useTelegramConnect());
    await waitFor(() => expect(result.current.loading).toBe(false));
    mockApiPost.mockResolvedValue({});
    await act(async () => { await result.current.sendTest(); });
    expect(mockApiPost).toHaveBeenCalledWith("/api/telegram/test");
    expect(mockToast.success).toHaveBeenCalledWith("telegram.testSuccess");
  });
});
