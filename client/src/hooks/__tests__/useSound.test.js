import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useSound } from "../useSound";

describe("useSound", () => {
  let oscillatorMock;
  let audioContextMock;

  beforeEach(() => {
    oscillatorMock = {
      frequency: { value: 0 },
      connect: vi.fn().mockReturnThis(),
      start: vi.fn(),
      stop: vi.fn(),
    };
    audioContextMock = {
      createOscillator: vi.fn().mockReturnValue(oscillatorMock),
      destination: "dest",
      currentTime: 100,
    };
    globalThis.AudioContext = vi.fn().mockImplementation(function mockAudioCtx() { return audioContextMock; });
    globalThis.webkitAudioContext = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns a playBeep function", () => {
    const { playBeep } = useSound();
    expect(typeof playBeep).toBe("function");
  });

  it("creates an AudioContext on playBeep", () => {
    const { playBeep } = useSound();
    playBeep();
    expect(globalThis.AudioContext).toHaveBeenCalledOnce();
  });

  it("creates an oscillator with frequency 880", () => {
    const { playBeep } = useSound();
    playBeep();
    expect(audioContextMock.createOscillator).toHaveBeenCalledOnce();
    expect(oscillatorMock.frequency.value).toBe(880);
  });

  it("connects oscillator to destination", () => {
    const { playBeep } = useSound();
    playBeep();
    expect(oscillatorMock.connect).toHaveBeenCalledWith("dest");
  });

  it("starts oscillator immediately", () => {
    const { playBeep } = useSound();
    playBeep();
    expect(oscillatorMock.start).toHaveBeenCalledOnce();
  });

  it("stops oscillator after 80ms", () => {
    const { playBeep } = useSound();
    playBeep();
    expect(oscillatorMock.stop).toHaveBeenCalledWith(100.08);
  });

  it("falls back to webkitAudioContext when AudioContext is not available", () => {
    delete globalThis.AudioContext;
    globalThis.webkitAudioContext = vi.fn().mockImplementation(function mockWebkitCtx() { return audioContextMock; });
    const { playBeep } = useSound();
    playBeep();
    expect(globalThis.webkitAudioContext).toHaveBeenCalledOnce();
  });

  it("creates a new AudioContext each call", () => {
    const { playBeep } = useSound();
    playBeep();
    playBeep();
    expect(globalThis.AudioContext).toHaveBeenCalledTimes(2);
    expect(audioContextMock.createOscillator).toHaveBeenCalledTimes(2);
  });
});
