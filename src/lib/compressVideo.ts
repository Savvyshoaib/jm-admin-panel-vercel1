import {
    ALL_FORMATS,
    BlobSource,
    BufferTarget,
    Conversion,
    ConversionCanceledError,
    Input,
    Mp4OutputFormat,
    Output,
    Quality,
  } from "mediabunny";
  
  /** Cloudflare rejects request bodies over 100 MB. */
  export const VIDEO_UPLOAD_LIMIT_BYTES = 100 * 1024 * 1024;
  
  /** Target for one compressed file so the multipart publish stays under the cap. */
  const TARGET_BYTES = 90 * 1024 * 1024;
  const ACCEPT_BYTES = 99 * 1024 * 1024;
  
  export type CompressVideoOptions = {
    signal?: AbortSignal;
    /** 0–100. */
    onProgress?: (percent: number) => void;
    onStatus?: (message: string) => void;
  };
  
  export class VideoCompressError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "VideoCompressError";
    }
  }
  
  function outputName(name: string): string {
    const trimmed = name.trim() || "video";
    const base = trimmed.replace(/\.[^.]+$/, "") || "video";
    return `${base}.mp4`;
  }
  
  function even(value: number): number {
    const rounded = Math.max(2, Math.round(value));
    return rounded % 2 === 0 ? rounded : rounded - 1;
  }
  
  function scaledWidth(sourceWidth: number, videoBitrate: number): number | undefined {
    if (!Number.isFinite(sourceWidth) || sourceWidth < 2) return undefined;
    let width = sourceWidth;
    if (width > 1920) width = 1920;
    if (videoBitrate < 1_500_000 && width > 1280) width = 1280;
    if (videoBitrate < 800_000 && width > 854) width = 854;
    if (videoBitrate < 400_000 && width > 640) width = 640;
    return even(Math.min(width, sourceWidth));
  }
  
  function videoBitrateFor(durationSec: number, hasAudio: boolean, targetBytes: number): number {
    const duration = Number.isFinite(durationSec) && durationSec > 0.5 ? durationSec : 1;
    const audioBits = hasAudio ? 96_000 * duration : 0;
    const bits = targetBytes * 8 - audioBits;
    return Math.max(80_000, Math.floor(bits / duration));
  }
  
  type VideoProbe = {
    duration: number;
    width: number;
    videoCodec: string | null;
    audioCodec: string | null;
  };
  
  async function probeVideo(file: Blob): Promise<VideoProbe> {
    const input = new Input({ formats: ALL_FORMATS, source: new BlobSource(file) });
    try {
      const video = await input.getPrimaryVideoTrack();
      if (!video) throw new VideoCompressError("This file has no video track.");
      const audio = await input.getPrimaryAudioTrack();
      return {
        duration: await input.computeDuration(),
        width: await video.getDisplayWidth(),
        videoCodec: video.codec,
        audioCodec: audio?.codec ?? null,
      };
    } catch (error) {
      if (error instanceof VideoCompressError) throw error;
      throw new VideoCompressError("Couldn't read this video.");
    } finally {
      input.dispose();
    }
  }
  
  /** H.264 + AAC in an MP4 is the only combination every phone browser can play. */
  function isUniversalMp4(file: File, probe: VideoProbe): boolean {
    const name = file.name.toLowerCase();
    const mp4 = file.type === "video/mp4" || name.endsWith(".mp4");
    const audioOk = probe.audioCodec == null || probe.audioCodec === "aac";
    return mp4 && probe.videoCodec === "avc" && audioOk;
  }
  
  type EncodeOptions = {
    file: Blob;
    /** Re-encode picture. False copies packets into a fast-start MP4. */
    forceVideoTranscode: boolean;
    forceAudioTranscode: boolean;
    /** Packet copy can keep HEVC. A re-encode is always H.264. */
    videoCodec?: "avc" | "hevc";
    videoBitrate?: number;
    width?: number;
    onProgress?: (ratio: number) => void;
    signal?: AbortSignal;
    invalidMessage?: string;
  };
  
  async function encodeMp4(options: EncodeOptions): Promise<Blob> {
    const input = new Input({
      formats: ALL_FORMATS,
      source: new BlobSource(options.file),
    });
    const target = new BufferTarget();
    const output = new Output({
      format: new Mp4OutputFormat({ fastStart: "in-memory" }),
      target,
    });
  
    try {
      const audioTrack = await input.getPrimaryAudioTrack();
      const conversion = await Conversion.init({
        input,
        output,
        tracks: "primary",
        showWarnings: false,
        video: {
          codec: options.forceVideoTranscode ? "avc" : (options.videoCodec ?? "avc"),
          forceTranscode: options.forceVideoTranscode,
          hardwareAcceleration: "prefer-hardware",
          ...(options.forceVideoTranscode && options.width ? { width: options.width } : {}),
          ...(options.forceVideoTranscode && options.videoBitrate
            ? { quality: new Quality({ bitrate: options.videoBitrate, bitrateMode: "constant" }) }
            : {}),
        },
        audio: audioTrack
          ? {
              codec: "aac",
              forceTranscode: options.forceAudioTranscode,
              ...(options.forceAudioTranscode
                ? { quality: new Quality({ bitrate: 96_000, bitrateMode: "constant" }) }
                : {}),
            }
          : { discard: true },
      });
  
      if (!conversion.isValid) {
        throw new VideoCompressError(
          options.invalidMessage ??
            "This video can't be converted in this browser.",
        );
      }
  
      if (options.onProgress) {
        const report = options.onProgress;
        conversion.onProgress = (progress) => {
          report(Math.min(1, Math.max(0, progress)));
        };
      }
  
      let settled = false;
      const cancel = () => {
        if (!settled) void conversion.cancel();
      };
      if (options.signal?.aborted) {
        throw new DOMException("Compression cancelled.", "AbortError");
      }
      options.signal?.addEventListener("abort", cancel);
  
      try {
        await conversion.execute();
      } finally {
        settled = true;
        options.signal?.removeEventListener("abort", cancel);
      }
  
      const buffer = target.buffer;
      if (!buffer || buffer.byteLength === 0) {
        throw new VideoCompressError("Compression produced an empty file.");
      }
      return new Blob([buffer], { type: "video/mp4" });
    } catch (error) {
      if (options.signal?.aborted || error instanceof ConversionCanceledError) {
        throw new DOMException("Compression cancelled.", "AbortError");
      }
      if (error instanceof VideoCompressError || error instanceof DOMException) throw error;
      throw new VideoCompressError(
        "Couldn't convert this video. Try a shorter file, or upload an H.264 MP4.",
      );
    } finally {
      input.dispose();
    }
  }
  
  function mp4File(blob: Blob, name: string): File {
    return new File([blob], outputName(name), {
      type: "video/mp4",
      lastModified: Date.now(),
    });
  }
  
  function throwIfAborted(signal?: AbortSignal) {
    if (signal?.aborted) {
      throw new DOMException("Compression cancelled.", "AbortError");
    }
  }
  
  /**
   * Keeps an H.264/AAC MP4 that is already under the upload cap.
   * Anything else (MOV, HEVC, odd audio, or over 100 MB) becomes a fast-start H.264 MP4.
   */
  export async function prepareVideoForUpload(
    file: File,
    options: CompressVideoOptions = {},
  ): Promise<File> {
    const { signal, onProgress, onStatus } = options;
    onStatus?.("Reading video…");
    onProgress?.(0);
    const probe = await probeVideo(file);
    throwIfAborted(signal);
  
    if (isUniversalMp4(file, probe) && file.size <= VIDEO_UPLOAD_LIMIT_BYTES) {
      onProgress?.(100);
      return file;
    }
  
    const needsVideoEncode = probe.videoCodec !== "avc";
    if (needsVideoEncode && !("VideoEncoder" in globalThis)) {
      throw new VideoCompressError(
        "This browser can't convert this video. Use Chrome or Edge, or upload an H.264 MP4 under 100 MB.",
      );
    }
  
    onStatus?.(
      needsVideoEncode
        ? "Converting to MP4 so it plays on every phone…"
        : file.size > VIDEO_UPLOAD_LIMIT_BYTES
          ? "Compressing to under 100 MB…"
          : "Saving as MP4…",
    );
  
    const hasAudio = probe.audioCodec != null;
    const needsAudioEncode = hasAudio && probe.audioCodec !== "aac";
    let bitrate = Math.min(
      4_000_000,
      videoBitrateFor(probe.duration, hasAudio, TARGET_BYTES),
    );
    let width = needsVideoEncode ? scaledWidth(probe.width, bitrate) : undefined;
    let blob = await encodeMp4({
      file,
      forceVideoTranscode: needsVideoEncode,
      forceAudioTranscode: needsAudioEncode || needsVideoEncode,
      videoCodec: probe.videoCodec === "hevc" ? "hevc" : "avc",
      videoBitrate: bitrate,
      width,
      signal,
      onProgress: onProgress
        ? (ratio) => onProgress(Math.round(ratio * 85))
        : undefined,
      invalidMessage:
        "This browser can't read this video. Upload an H.264 MP4 under 100 MB.",
    });
  
    if (blob.size > ACCEPT_BYTES) {
      onStatus?.("Still over 100 MB. Compressing again…");
      bitrate = Math.max(80_000, Math.floor(bitrate * (TARGET_BYTES / blob.size) * 0.85));
      width = scaledWidth(Math.min(probe.width || 854, 854), bitrate);
      blob = await encodeMp4({
        file,
        forceVideoTranscode: true,
        forceAudioTranscode: true,
        videoBitrate: bitrate,
        width,
        signal,
        onProgress: onProgress
          ? (ratio) => onProgress(85 + Math.round(ratio * 15))
          : undefined,
      });
    }
  
    if (blob.size > VIDEO_UPLOAD_LIMIT_BYTES) {
      throw new VideoCompressError(
        "Couldn't get this video under 100 MB. Trim it and try again.",
      );
    }
  
    onProgress?.(100);
    return mp4File(blob, file.name);
  }
  
  export type PlayableMp4 = {
    blob: Blob;
    /** Codec of the source picture, used to decide a second pass. */
    sourceCodec: string | null;
  };
  
  /**
   * Makes a file the current browser can hand to <video>.
   * `remux` only moves H.264 or HEVC into a fast-start MP4.
   * `avc` re-encodes to H.264 so Chrome, Firefox, and Android can play iPhone HEVC.
   */
  export async function convertToPlayableMp4(
    file: Blob,
    mode: "remux" | "avc",
    options: CompressVideoOptions = {},
  ): Promise<PlayableMp4> {
    const { signal, onProgress, onStatus } = options;
    const probe = await probeVideo(file);
    throwIfAborted(signal);
  
    const canRemux = probe.videoCodec === "avc" || probe.videoCodec === "hevc";
    const encode = mode === "avc" || !canRemux;
    if (encode && !("VideoEncoder" in globalThis)) {
      throw new VideoCompressError(
        "This browser can't convert this video. It will play on iPhone and Safari.",
      );
    }
  
    onStatus?.(encode ? "Converting for this browser…" : "Preparing video…");
    const hasAudio = probe.audioCodec != null;
    const bitrate = Math.min(
      2_500_000,
      videoBitrateFor(probe.duration, hasAudio, 36 * 1024 * 1024),
    );
    const blob = await encodeMp4({
      file,
      forceVideoTranscode: encode,
      forceAudioTranscode: encode || (hasAudio && probe.audioCodec !== "aac"),
      videoCodec: !encode && probe.videoCodec === "hevc" ? "hevc" : "avc",
      videoBitrate: bitrate,
      width: encode ? scaledWidth(Math.min(probe.width || 1280, 1280), bitrate) : undefined,
      signal,
      onProgress: onProgress ? (ratio) => onProgress(Math.round(ratio * 100)) : undefined,
      invalidMessage: encode
        ? "This browser can't convert this video. It will play on iPhone and Safari."
        : "Couldn't prepare this video.",
    });
    return { blob, sourceCodec: probe.videoCodec };
  }
  
  /** Shrinks a file that is already over the upload cap. Compatible small files pass through. */
  export async function compressVideoUnderLimit(
    file: File,
    options: CompressVideoOptions = {},
  ): Promise<File> {
    if (file.size <= VIDEO_UPLOAD_LIMIT_BYTES) return file;
    return prepareVideoForUpload(file, options);
  }
  
  