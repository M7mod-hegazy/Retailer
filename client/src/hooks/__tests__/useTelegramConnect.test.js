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
    mockApiGet.mockReset().mockImplementation((url) => {
      if (url === "/api/telegram/recipients") return Promise.resolve({ data: { data: [] } });
      return Promise.resolve({ data: { data: {} } });
    });
    mockApiPost.mockReset();
    mockApiPut.mockReset().mockResolvedValue({});
    mockToast.success.mockReset();
    mockToast.error.mockReset();
  });

  it("loads camelCase recipients from GET /api/telegram/recipients", async () => {
    mockApiGet.mockImplementation((url) => {
      if (url === "/api/settings") return Promise.resolve({ data: { data: { telegram_enabled: true, telegram_bot_token: "tok" } } });
      if (url === "/api/telegram/recipients") {
        return Promise.resolve({
          data: {
            data: [{
              id: 1,
              chatId: "987654321",
              enabled: true,
              notifyNewInvoice: true,
              notifyDailyClose: false,
              notifyPurchasesPayments: true,
            }],
          },
        });
      }
      return Promise.resolve({ data: { data: {} } });
    });
    const { result } = renderHook(() => useTelegramConnect());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.recipients[0].chatId).toBe("987654321");
    expect(result.current.recipients[0].notifyNewInvoice).toBe(true);
    expect(result.current.recipients[0].notifyDailyClose).toBe(false);
    expect(result.current.recipients[0].notifyPurchasesPayments).toBe(true);
    expect(result.current.saved).toBe(true);
  });

  it("loads snake_case recipients on mount and marks saved when configured", async () => {
    mockApiGet.mockImplementation((url) => {
      if (url === "/api/settings") return Promise.resolve({ data: { data: { telegram_enabled: true, telegram_bot_token: "tok" } } });
      if (url === "/api/telegram/recipients") return Promise.resolve({ data: { data: [{ id: 1, chat_id: "123", enabled: true, notify_new_invoice: true }] } });
      return Promise.resolve({ data: { data: {} } });
    });
    const { result } = renderHook(() => useTelegramConnect());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.config.telegram_bot_token).toBe("tok");
    expect(result.current.recipients).toHaveLength(1);
    expect(result.current.saved).toBe(true);
  });

  it("does not synthesize an id-less recipient from legacy telegram_chat_id", async () => {
    mockApiGet.mockImplementation((url) => {
      if (url === "/api/settings") return Promise.resolve({ data: { data: { telegram_enabled: true, telegram_bot_token: "tok", telegram_chat_id: "999" } } });
      if (url === "/api/telegram/recipients") return Promise.resolve({ data: { data: [] } });
      return Promise.resolve({ data: { data: {} } });
    });
    const { result } = renderHook(() => useTelegramConnect());
    await waitFor(() => expect(result.current.loading).toBe(false));
    // The server-side legacy migration owns this case; a client-side synthetic
    // row had no id, so every save POSTed a duplicate.
    expect(result.current.recipients).toHaveLength(0);
  });

  it("addRecipient replaces an existing recipient with the same chat id (server upsert)", async () => {
    mockApiGet.mockImplementation((url) => {
      if (url === "/api/settings") return Promise.resolve({ data: { data: { telegram_enabled: true, telegram_bot_token: "tok" } } });
      if (url === "/api/telegram/recipients") return Promise.resolve({ data: { data: [{ id: 7, chat_id: "555", enabled: true }] } });
      return Promise.resolve({ data: { data: {} } });
    });
    mockApiPost.mockResolvedValue({ data: { data: { id: 7, chat_id: "555", enabled: true, name: "Owner" } } });
    const { result } = renderHook(() => useTelegramConnect());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.addRecipient({ chatId: "555", name: "Owner" }); });
    expect(result.current.recipients).toHaveLength(1);
    expect(result.current.recipients[0].name).toBe("Owner");
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

  it("save rejects enabling without a token and recipients", async () => {
    const { result } = renderHook(() => useTelegramConnect());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { result.current.setConfig((c) => ({ ...c, telegram_enabled: true })); });
    await act(async () => { await result.current.save(); });
    expect(mockApiPut).not.toHaveBeenCalled();
  });

  it("save persists bot settings and marks saved when fully configured", async () => {
    const { result } = renderHook(() => useTelegramConnect());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { result.current.setConfig((c) => ({ ...c, telegram_enabled: true, telegram_bot_token: "tok" })); });
    act(() => { result.current.setRecipients([{ id: 1, chatId: "1", enabled: true, notifyNewInvoice: true }]); });
    await act(async () => { await result.current.save(); });
    expect(result.current.saved).toBe(true);
    expect(mockApiPut).toHaveBeenCalledWith("/api/settings", expect.objectContaining({ telegram_enabled: true, telegram_bot_token: "tok" }));
  });

  it("calls the onSaved callback after a successful save", async () => {
    const onSaved = vi.fn();
    const { result } = renderHook(() => useTelegramConnect(onSaved));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { result.current.setConfig((c) => ({ ...c, telegram_enabled: true, telegram_bot_token: "tok" })); });
    act(() => { result.current.setRecipients([{ id: 1, chatId: "1", enabled: true, notifyNewInvoice: true }]); });
    await act(async () => { await result.current.save(); });
    expect(onSaved).toHaveBeenCalled();
  });

  it("sendTest calls the telegram test endpoint with chat_id", async () => {
    const { result } = renderHook(() => useTelegramConnect());
    await waitFor(() => expect(result.current.loading).toBe(false));
    mockApiPost.mockResolvedValue({});
    await act(async () => { await result.current.sendTest("123"); });
    expect(mockApiPost).toHaveBeenCalledWith("/api/telegram/test", { chat_id: "123" });
    expect(mockToast.success).toHaveBeenCalledWith("telegram.testSuccess");
  });

  it("startPairing creates a pairing session", async () => {
    const { result } = renderHook(() => useTelegramConnect());
    await waitFor(() => expect(result.current.loading).toBe(false));
    mockApiPost.mockResolvedValue({ data: { data: { code: "ABC123", url: "http://x/pairing/ABC123", qr: "data:image/png;base64,x" } } });
    await act(async () => { await result.current.startPairing(); });
    expect(mockApiPost).toHaveBeenCalledWith("/api/telegram/pairing/start");
    expect(result.current.pairing?.code).toBe("ABC123");
  });

  it("receives token from pairing poll and fills config", async () => {
    const { result } = renderHook(() => useTelegramConnect());
    await waitFor(() => expect(result.current.loading).toBe(false));
    mockApiPost.mockResolvedValueOnce({ data: { data: { code: "ABC123", url: "http://x/pairing/ABC123", qr: "data:image/png;base64,x" } } });
    await act(async () => { await result.current.startPairing(); });
    mockApiGet.mockResolvedValue({ data: { found: true, data: { token: "tok-from-phone" } } });
    await act(async () => {
      await new Promise(r => setTimeout(r, 2200));
    });
    expect(result.current.config.telegram_bot_token).toBe("tok-from-phone");
  });
});
