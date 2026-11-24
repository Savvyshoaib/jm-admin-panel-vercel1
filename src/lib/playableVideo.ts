import { fetchMediaBlob, getConfiguredApiOrigin } from "@/lib/apiClient";
import { convertToPlayableMp4, type PlayableMp4 } from "@/lib/compressVideo";

const files = new Map<string, Promise<File>>();
const outputs = new Map<string, Promise<PlayableMp4 & { url: string }>>();
let workerReady: Promise<ServiceWorker> | null = null;

async function loadBlob(src: string): Promise<Blob> {
  if (src.startsWith("blob:") || src.startsWith("data:")) {
    const response = await fetch(src);
    if (!response.ok) throw new Error("Couldn't read this video.");
    return response.blob();
  }
  try {
    return await fetchMediaBlob(src);
  } catch (error) {
    try {
      const response = await fetch(src);
      if (!response.ok) throw error;
      return response.blob();
    } catch {
      throw error;
    }
  }
}

function sourceFile(src: string, name: string): Promise<File> {
  const existing = files.get(src);
  if (existing) return existing;
  const job = loadBlob(src)
    .then(
      (blob) =>
        new File([blob], name || "video", {
          type: blob.type || "video/mp4",
        }),
    )
    .catch((error: unknown) => {
      files.delete(src);
      throw error;
    });
  files.set(src, job);
  return job;
}

/** Real file URL. Same-origin `/storage` is the SPA HTML page on the live host. */
export function backendStorageUrl(src: string): string {
  if (/^https?:\/\//i.test(src)) return src;
  const origin = getConfiguredApiOrigin().replace(/\/$/, "");
  if (src.startsWith("/storage/") && origin) return `${origin}${src}`;
  return src;
}

export function browserCanPlayHevc(): boolean {
  if (typeof document === "undefined") return false;
  const support = document.createElement("video").canPlayType(
    'video/mp4; codecs="hvc1.1.6.L93.B0,mp4a.40.2"',
  );
  return support === "probably" || support === "maybe";
}

export function isMovSource(src: string, fileType?: string): boolean {
  const type = fileType?.toLowerCase();
  if (type === "mov" || type === "qt") return true;
  return /\.mov($|\?)/i.test(src);
}

/** Registers the same-origin media worker before a video request. */
export function ensurePlaybackWorker(): Promise<ServiceWorker> {
  return playbackWorker();
}

async function playbackWorker(): Promise<ServiceWorker> {
  if (!("serviceWorker" in navigator)) {
    throw new Error("This browser can't prepare this video.");
  }
  if (!workerReady) {
    workerReady = navigator.serviceWorker
      .register("/media-sw.js?v=2")
      .then(async (registration) => {
        const incoming = registration.installing || registration.waiting;
        if (incoming && incoming.state !== "activated") {
          await new Promise<void>((resolve) => {
            incoming.addEventListener("statechange", () => {
              if (incoming.state === "activated") resolve();
            });
          });
        }
        await navigator.serviceWorker.ready;
        if (!navigator.serviceWorker.controller) {
          await new Promise<void>((resolve) => {
            navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), {
              once: true,
            });
          });
        }
        const controller = navigator.serviceWorker.controller;
        if (!controller) throw new Error("This browser can't prepare this video.");
        return controller;
      })
      .catch((error: unknown) => {
        workerReady = null;
        throw error;
      });
  }
  return workerReady;
}

/** Same-origin URL. Blob URLs are blocked by the admin Content-Security-Policy. */
async function publishMp4(blob: Blob): Promise<string> {
  const id = crypto.randomUUID();
  const buffer = await blob.arrayBuffer();
  const worker = await playbackWorker();
  await new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel();
    const timer = window.setTimeout(() => reject(new Error("Couldn't prepare this video.")), 15000);
    channel.port1.onmessage = () => {
      window.clearTimeout(timer);
      resolve();
    };
    worker.postMessage({ type: "store", id, buffer }, [buffer, channel.port2]);
  });
  return `/play/${id}.mp4`;
}

/** Session cache. The first open of a MOV pays for the convert; the next open plays immediately. */
export function playableVideoUrl(
  src: string,
  name: string,
  mode: "remux" | "avc",
  onProgress?: (percent: number) => void,
): Promise<PlayableMp4 & { url: string }> {
  const key = `${mode}:${src}`;
  const existing = outputs.get(key);
  if (existing) return existing;
  const job = sourceFile(src, name)
    .then((file) => convertToPlayableMp4(file, mode, { onProgress }))
    .then((result) => publishMp4(result.blob).then((url) => ({ ...result, url })))
    .catch((error: unknown) => {
      outputs.delete(key);
      throw error;
    });
  outputs.set(key, job);
  return job;
}

/**
 * URL this browser can play. H.264 is published as-is.
 * HEVC MOV is re-encoded when this browser cannot decode it.
 */
export function browserPlayableUrl(
  src: string,
  name: string,
  fileType?: string,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const absolute = backendStorageUrl(src);
  if (isMovSource(absolute, fileType) && !browserCanPlayHevc()) {
    return playableVideoUrl(absolute, name, "avc", onProgress).then((result) => result.url);
  }
  return sourceFile(absolute, name).then((file) => publishMp4(file));
}
