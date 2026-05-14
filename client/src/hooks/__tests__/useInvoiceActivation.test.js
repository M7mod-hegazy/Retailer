import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useInvoiceActivation } from "../useInvoiceActivation";

const mockApiPost = vi.hoisted(() => vi.fn());
const mockApi = vi.hoisted(() => ({ post: mockApiPost }));
vi.mock("../../services/api", () => ({ default: mockApi }));

describe("useInvoiceActivation", () => {
  beforeEach(() => {
    mockApiPost.mockReset();
  });

  it("starts in inactive state with null docNo/createdAt", () => {
    const { result } = renderHook(() => useInvoiceActivation("pos_sale"));
    expect(result.current.isActive).toBe(false);
    expect(result.current.docNo).toBeNull();
    expect(result.current.createdAt).toBeNull();
  });

  it("starts active when editValues are provided", () => {
    const { result } = renderHook(() =>
      useInvoiceActivation("pos_sale", { docNo: "INV-001", createdAt: "2025-01-01T00:00:00Z" }),
    );
    expect(result.current.isActive).toBe(true);
    expect(result.current.docNo).toBe("INV-001");
    expect(result.current.createdAt).toBe("2025-01-01T00:00:00Z");
  });

  it("activate reserves doc number via API", async () => {
    mockApiPost.mockResolvedValue({ data: { data: { doc_no: "DOC-001" } } });
    const { result } = renderHook(() => useInvoiceActivation("pos_sale"));
    await act(async () => { await result.current.activate(); });
    expect(mockApiPost).toHaveBeenCalledWith("/api/documents/reserve", { type: "pos_sale" });
    expect(result.current.isActive).toBe(true);
    expect(result.current.docNo).toBe("DOC-001");
    expect(result.current.createdAt).toBeTruthy();
  });

  it("does not call API if already active", async () => {
    mockApiPost.mockResolvedValue({ data: { data: { doc_no: "DOC-001" } } });
    const { result } = renderHook(() =>
      useInvoiceActivation("pos_sale", { docNo: "INV-001", createdAt: "2025-01-01T00:00:00Z" }),
    );
    await act(async () => { await result.current.activate(); });
    expect(mockApiPost).not.toHaveBeenCalled();
    expect(result.current.isActive).toBe(true);
    expect(result.current.docNo).toBe("INV-001");
  });

  it("does not call API on multiple rapid activate calls", async () => {
    mockApiPost.mockResolvedValue({ data: { data: { doc_no: "DOC-001" } } });
    const { result } = renderHook(() => useInvoiceActivation("pos_sale"));
    await act(async () => {
      await Promise.all([result.current.activate(), result.current.activate(), result.current.activate()]);
    });
    expect(mockApiPost).toHaveBeenCalledTimes(1);
  });

  it("handles API failure gracefully without throwing", async () => {
    mockApiPost.mockRejectedValue(new Error("Network error"));
    const { result } = renderHook(() => useInvoiceActivation("pos_sale"));
    await act(async () => { await result.current.activate(); });
    expect(result.current.isActive).toBe(false);
    expect(result.current.docNo).toBeNull();
  });

  it("reset restores to inactive state", async () => {
    mockApiPost.mockResolvedValue({ data: { data: { doc_no: "DOC-001" } } });
    const { result } = renderHook(() => useInvoiceActivation("pos_sale"));
    await act(async () => { await result.current.activate(); });
    expect(result.current.isActive).toBe(true);
    act(() => { result.current.reset(); });
    expect(result.current.isActive).toBe(false);
    expect(result.current.docNo).toBeNull();
    expect(result.current.createdAt).toBeNull();
  });

  it("activate works again after reset", async () => {
    mockApiPost.mockResolvedValue({ data: { data: { doc_no: "DOC-001" } } });
    const { result } = renderHook(() => useInvoiceActivation("pos_sale"));
    await act(async () => { await result.current.activate(); });
    act(() => { result.current.reset(); });
    mockApiPost.mockResolvedValue({ data: { data: { doc_no: "DOC-002" } } });
    await act(async () => { await result.current.activate(); });
    expect(mockApiPost).toHaveBeenCalledTimes(2);
    expect(result.current.docNo).toBe("DOC-002");
  });

  it("supports different document types", async () => {
    mockApiPost.mockResolvedValue({ data: { data: { doc_no: "PR-001" } } });
    const { result } = renderHook(() => useInvoiceActivation("purchase_receipt"));
    await act(async () => { await result.current.activate(); });
    expect(mockApiPost).toHaveBeenCalledWith("/api/documents/reserve", { type: "purchase_receipt" });
    expect(result.current.docNo).toBe("PR-001");
  });

  it("isActive is true before API resolves (optimistic)", () => {
    mockApiPost.mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => useInvoiceActivation("pos_sale"));
    act(() => { result.current.activate(); });
    expect(result.current.isActive).toBe(false);
  });
});
