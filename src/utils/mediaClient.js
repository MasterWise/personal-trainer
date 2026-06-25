const IMAGE_MAX_DIMENSION = 1280;
const IMAGE_QUALITY = 0.82;
export const AUDIO_MAX_DURATION_MS = 60_000;

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Falha ao ler arquivo"));
    reader.readAsDataURL(blob);
  });
}

function loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Nao foi possivel abrir a imagem"));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas, mimeType, quality) {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), mimeType, quality);
  });
}

export async function prepareImageFile(file) {
  if (!file?.type?.startsWith("image/")) {
    throw new Error("Selecione uma imagem valida");
  }
  if (file.type === "image/svg+xml") {
    throw new Error("SVG nao e aceito como anexo de imagem");
  }

  const { img, url } = await loadImageFromFile(file);
  try {
    const ratio = Math.min(1, IMAGE_MAX_DIMENSION / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
    const width = Math.max(1, Math.round((img.naturalWidth || img.width) * ratio));
    const height = Math.max(1, Math.round((img.naturalHeight || img.height) * ratio));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: false });
    ctx.drawImage(img, 0, 0, width, height);

    let mimeType = "image/webp";
    let blob = await canvasToBlob(canvas, mimeType, IMAGE_QUALITY);
    if (!blob || blob.size === 0) {
      mimeType = "image/jpeg";
      blob = await canvasToBlob(canvas, mimeType, IMAGE_QUALITY);
    }
    if (!blob || blob.size === 0) {
      throw new Error("Nao foi possivel processar a imagem");
    }

    return {
      kind: "image",
      blob,
      mimeType,
      width,
      height,
      sizeBytes: blob.size,
      previewUrl: URL.createObjectURL(blob),
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function mergeAudioChunks(chunks) {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const merged = new Float32Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  return merged;
}

function writeString(view, offset, value) {
  for (let i = 0; i < value.length; i += 1) {
    view.setUint8(offset + i, value.charCodeAt(i));
  }
}

function encodeWav(samples, sampleRate) {
  const bytesPerSample = 2;
  const buffer = new ArrayBuffer(44 + samples.length * bytesPerSample);
  const view = new DataView(buffer);
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * bytesPerSample, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * bytesPerSample, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i += 1, offset += 2) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return new Blob([view], { type: "audio/wav" });
}

export async function startWavRecorder() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Gravacao de audio indisponivel neste navegador");
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
  const audioContext = new AudioContextCtor();
  const source = audioContext.createMediaStreamSource(stream);
  const processor = audioContext.createScriptProcessor(4096, 1, 1);
  const silentGain = audioContext.createGain();
  silentGain.gain.value = 0;

  const chunks = [];
  const startedAt = performance.now();
  let latestLevel = 0;
  processor.onaudioprocess = (event) => {
    const input = event.inputBuffer.getChannelData(0);
    chunks.push(new Float32Array(input));
    let sum = 0;
    for (let i = 0; i < input.length; i += 1) {
      sum += input[i] * input[i];
    }
    const rms = Math.sqrt(sum / Math.max(1, input.length));
    latestLevel = Math.min(1, rms * 8);
  };

  source.connect(processor);
  processor.connect(silentGain);
  silentGain.connect(audioContext.destination);

  let stopped = false;
  return {
    getLevel: () => latestLevel,
    stop: async () => {
      if (stopped) return null;
      stopped = true;
      processor.disconnect();
      source.disconnect();
      silentGain.disconnect();
      stream.getTracks().forEach((track) => track.stop());
      await audioContext.close().catch(() => {});
      const durationMs = Math.min(AUDIO_MAX_DURATION_MS, Math.round(performance.now() - startedAt));
      const samples = mergeAudioChunks(chunks);
      const blob = encodeWav(samples, audioContext.sampleRate || 48000);
      return {
        kind: "audio",
        blob,
        mimeType: "audio/wav",
        durationMs,
        sizeBytes: blob.size,
        previewUrl: URL.createObjectURL(blob),
      };
    },
  };
}
