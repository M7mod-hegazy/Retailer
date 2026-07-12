import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useSmsConnect } from "../useSmsConnect";

const mockApiGet = vi.hoisted(() => vi.fn());
const mockApiPost = vi.hoisted(() => vi.fn());
const mockApiPut = vi.hoisted(() => vi.fn());
vi.mock("../../services/api", () => ({ default: { get: mockApiGet, post: mockApiPost, put: mockApiPut } }));

const mockToast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("react-hot-toast", () => ({ default: mockToast }));

describe("useSmsConnect", () => {
  beforeEach(() => {
    mockApiGet.mockReset().mockResolvedValue({ data: { data: {} } });
    mockApiPost.mockReset();
    mockApiPut.mockReset().mockResolvedValue({});
    mockToast.success.mockReset();
    mockToast.error.mockReset();
  });

  it("loads settings on mount and marks saved when already configured", async () => {
    mockApiGet.mockResolvedValue({ data: { data: { sms_enabled: true, sms_api_url: "https://provider.test" } } });
    const { result } = renderHook(() => useSmsConnect());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.sms.sms_api_url).toBe("https://provider.test");
    expect(result.current.saved).toBe(true);
  });

  it("flags loadError when settings fail to load", async () => {
    mockApiGet.mockRejectedValue(new Error("no perms"));
    const { result } = renderHook(() => useSmsConnect());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.loadError).toBe(true);
  });

  it("save rejects enabling without an API URL", async () => {
    const { result } = renderHook(() => useSmsConnect());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { result.current.setSms((s) => ({ ...s, sms_enabled: true })); });
    await act(async () => { await result.current.save(); });
    expect(mockApiPut).not.toHaveBeenCalled();
    expect(mockToast.error).toHaveBeenCalled();
  });

  it("save persists the current state and returns to saved=true", async () => {
    const { result } = renderHook(() => useSmsConnect());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { result.current.setSms((s) => ({ ...s, sms_enabled: true, sms_api_url: "https://provider.test" })); });
    await act(async () => { await result.current.save(); });
    expect(result.current.saved).toBe(true);
    expect(mockApiPut).toHaveBeenCalledWith("/api/settings", expect.objectContaining({ sms_enabled: true, sms_api_url: "https://provider.test" }));
  });

  it("save accepts an override object so a fresh value can be persisted without waiting for a re-render", async () => {
    const { result } = renderHook(() => useSmsConnect());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const fresh = { sms_enabled: true, sms_api_url: "https://provider.test", sms_api_key: "", sms_sender: "", sms_body_template: "" };
    await act(async () => { await result.current.save(fresh); });
    expect(mockApiPut).toHaveBeenCalledWith("/api/settings", fresh);
    expect(result.current.saved).toBe(true);
  });

  it("calls the onSaved callback after a successful save", async () => {
    const onSaved = vi.fn();
    const { result } = renderHook(() => useSmsConnect(onSaved));
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { result.current.setSms((s) => ({ ...s, sms_enabled: true, sms_api_url: "https://provider.test" })); });
    await act(async () => { await result.current.save(); });
    expect(onSaved).toHaveBeenCalled();
  });

  it("sendTest does nothing without a phone number", async () => {
    const { result } = renderHook(() => useSmsConnect());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.sendTest(); });
    expect(mockApiPost).not.toHaveBeenCalled();
  });

  it("sendTest posts to the sms-test endpoint with the entered phone", async () => {
    const { result } = renderHook(() => useSmsConnect());
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => { result.current.setTestPhone("0100000000"); });
    mockApiPost.mockResolvedValue({});
    await act(async () => { await result.current.sendTest(); });
    expect(mockApiPost).toHaveBeenCalledWith("/api/whatsapp/sms-test", { phone: "0100000000" });
  });
});
