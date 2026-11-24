import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import videojs from "video.js";
import "video.js/dist/video-js.css";
import {
  browserPlayableUrl,
  ensurePlaybackWorker,
  isMovSource,
  browserCanPlayHevc,
} from "@/lib/playableVideo";

type VideoJsInstance = {
  pause: () => void;
  dispose: () => void;
  src: (source: { src: string; type?: string }) => void;
  on: (event: string, handler: () => void) => void;
};

function sourceType(fileType: string | undefined, src: string) {
  const type = fileType?.toLowerCase();
  if (type === "mov" || type === "qt" || /\.mov($|\?)/i.test(src)) return undefined;
  if (type === "webm") return "video/webm";
  if (type === "ogg" || type === "ogv") return "video/ogg";
  return "video/mp4";
}

async function storageRespondsWithMedia(src: string): Promise<boolean> {
  if (!src.startsWith("/storage/")) return true;
  try {
    const response = await fetch(src, {
      cache: "no-store",
      headers: { Range: "bytes=0-31" },
    });
    const type = (response.headers.get("content-type") || "").toLowerCase();
    if (type.includes("html") || type.startsWith("text/")) return false;
    const head = new TextDecoder().decode(await response.arrayBuffer());
    return !head.trimStart().startsWith("<");
  } catch {
    return false;
  }
}

export function VideoJsPlayer({
  src,
  title,
  fileType,
}: {
  src: string;
  title: string;
  fileType?: string;
}) {
  const holderRef = useRef<HTMLDivElement | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    const holder = holderRef.current;
    if (!holder || !src) return;

    let cancelled = false;
    let player: VideoJsInstance | null = null;
    let retried = false;
    let disposing = false;

    const stop = () => {
      disposing = true;
      const media = holder.querySelector("video");
      try {
        player?.pause();
      } catch {
        /* player already disposed */
      }
      if (media) {
        media.pause();
        media.currentTime = 0;
        media.removeAttribute("src");
        media.load();
      }
      try {
        player?.dispose();
      } catch {
        /* player already disposed */
      }
      player = null;
      holder.textContent = "";
      disposing = false;
    };

    const mount = (playSrc: string, type?: string) => {
      stop();
      const node = document.createElement("video-js");
      node.classList.add("vjs-big-play-centered");
      node.setAttribute("playsinline", "true");
      node.setAttribute("title", title);
      holder.append(node);
      const instance = videojs(node, {
        controls: true,
        fill: true,
        responsive: true,
        preload: "auto",
        sources: [type ? { src: playSrc, type } : { src: playSrc }],
      }) as unknown as VideoJsInstance;
      player = instance;
      const tech = holder.querySelector("video");
      if (tech instanceof HTMLVideoElement) tech.style.objectFit = "contain";
      instance.on("error", () => {
        if (disposing || player !== instance) return;
        if (retried) {
          setNotice("This video couldn't be played.");
          return;
        }
        void fallback();
      });
    };

    const fallback = async () => {
      if (cancelled || retried) return;
      retried = true;
      setNotice("Preparing this video…");
      try {
        const url = await browserPlayableUrl(src, title, fileType, (percent) => {
          if (!cancelled) setNotice(`Preparing this video… ${percent}%`);
        });
        if (cancelled) return;
        setNotice(null);
        mount(url, "video/mp4");
      } catch {
        if (!cancelled) setNotice("This video couldn't be played.");
      }
    };

    const start = async () => {
      setNotice(null);
      try {
        await ensurePlaybackWorker();
      } catch {
        /* Direct playback still works when /storage is a real file. */
      }
      if (cancelled) return;

      const directOk = await storageRespondsWithMedia(src);
      if (cancelled) return;
      const needsConvert = isMovSource(src, fileType) && !browserCanPlayHevc();
      if (directOk && !needsConvert) {
        mount(src, sourceType(fileType, src));
        return;
      }
      await fallback();
    };

    void start();

    return () => {
      cancelled = true;
      stop();
    };
  }, [src, title, fileType]);

  return (
    <div className="relative h-[min(72dvh,calc(100dvh-8.5rem))] w-full">
      <div
        ref={holderRef}
        data-vjs-player
        className="h-full w-full overflow-hidden rounded-lg bg-black"
      />
      {notice ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-lg bg-black px-6 text-center text-sm text-white">
          <Loader2 className="size-6 animate-spin text-white/85" aria-hidden />
          <p>{notice}</p>
        </div>
      ) : null}
    </div>
  );
}
