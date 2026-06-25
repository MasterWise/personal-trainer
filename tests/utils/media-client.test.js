import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startWavRecorder } from "../../src/utils/mediaClient.js";

const ORIGINAL_NAVIGATOR = globalThis.navigator;
const ORIGINAL_WINDOW = globalThis.window;
const ORIGINAL_CREATE_OBJECT_URL = globalThis.URL.createObjectURL;

describe("mediaClient", () => {
  let processorNode;
  let sourceNode;
  let gainNode;
  let trackStop;

  beforeEach(() => {
    processorNode = null;
    sourceNode = { connect: vi.fn(), disconnect: vi.fn() };
    gainNode = { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() };
    trackStop = vi.fn();

    class FakeAudioContext {
      constructor() {
        this.sampleRate = 48000;
      }

      createMediaStreamSource() {
        return sourceNode;
      }

      createScriptProcessor() {
        processorNode = {
          connect: vi.fn(),
          disconnect: vi.fn(),
          onaudioprocess: null,
        };
        return processorNode;
      }

      createGain() {
        return gainNode;
      }

      close() {
        return Promise.resolve();
      }
    }

    Object.defineProperty(globalThis, "navigator", {
      value: {
        mediaDevices: {
          getUserMedia: vi.fn().mockResolvedValue({
            getTracks: () => [{ stop: trackStop }],
          }),
        },
      },
      configurable: true,
    });
    Object.defineProperty(globalThis, "window", {
      value: { AudioContext: FakeAudioContext },
      configurable: true,
    });
    globalThis.URL.createObjectURL = vi.fn(() => "blob:test-audio");
  });

  afterEach(() => {
    Object.defineProperty(globalThis, "navigator", {
      value: ORIGINAL_NAVIGATOR,
      configurable: true,
    });
    Object.defineProperty(globalThis, "window", {
      value: ORIGINAL_WINDOW,
      configurable: true,
    });
    globalThis.URL.createObjectURL = ORIGINAL_CREATE_OBJECT_URL;
    vi.restoreAllMocks();
  });

  it("expoe o nivel RMS mais recente para visualizacao de gravacao", async () => {
    const recorder = await startWavRecorder();

    expect(recorder.getLevel()).toBe(0);

    processorNode.onaudioprocess({
      inputBuffer: {
        getChannelData: () => Float32Array.from([0.4, -0.4, 0.2, -0.2]),
      },
    });

    expect(recorder.getLevel()).toBeGreaterThan(0);

    const prepared = await recorder.stop();

    expect(prepared).toMatchObject({
      kind: "audio",
      mimeType: "audio/wav",
      previewUrl: "blob:test-audio",
    });
    expect(trackStop).toHaveBeenCalledTimes(1);
  });
});
