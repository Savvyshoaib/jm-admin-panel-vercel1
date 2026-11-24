import { useEffect, useRef, useState, type RefObject } from "react";
import {
  getDocument,
  GlobalWorkerOptions,
  type PDFDocumentProxy,
  type RenderTask,
} from "pdfjs-dist/legacy/build/pdf.mjs";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerUrl;

/**
 * iOS Safari blanks a canvas past ~16 megapixels and will kill the tab if
 * every page of a long brochure stays in memory. Keep each bitmap small and
 * only paint pages near the viewport.
 */
const MAX_CANVAS_SIDE = 2048;
const MAX_CANVAS_PIXELS = 2_500_000;

function renderScale(pageWidth: number, pageHeight: number, containerWidth: number) {
  const cssWidth = Math.max(1, containerWidth - 24);
  const cssScale = cssWidth / pageWidth;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const sideCap = MAX_CANVAS_SIDE / Math.max(pageWidth, pageHeight);
  const areaCap = Math.sqrt(MAX_CANVAS_PIXELS / (pageWidth * pageHeight));
  return Math.max(0.2, Math.min(cssScale * dpr, sideCap, areaCap, 2));
}

function isCancelError(error: unknown) {
  const name = error instanceof Error ? error.name : "";
  return (
    name === "RenderingCancelledException" ||
    name === "AbortException" ||
    (error instanceof Error && /aborted|destroyed|cancel/i.test(error.message))
  );
}

function PdfPage({
  pdf,
  pageNumber,
  aspect,
  title,
  layoutWidth,
  rootRef,
}: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  aspect: number;
  title: string;
  layoutWidth: number;
  rootRef: RefObject<HTMLDivElement | null>;
}) {
  const holderRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(pageNumber === 1);

  useEffect(() => {
    const node = holderRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setActive(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => setActive(entry.isIntersecting),
      { root: rootRef.current, rootMargin: "700px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [rootRef, pageNumber]);

  useEffect(() => {
    const node = holderRef.current;
    if (!node || !active || layoutWidth <= 0) return;

    let cancelled = false;
    let renderTask: RenderTask | null = null;

    void (async () => {
      const page = await pdf.getPage(pageNumber);
      if (cancelled) {
        page.cleanup();
        return;
      }
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({
        scale: renderScale(base.width, base.height, layoutWidth),
      });
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.floor(viewport.width));
      canvas.height = Math.max(1, Math.floor(viewport.height));
      const context = canvas.getContext("2d", { alpha: false });
      if (!context) {
        page.cleanup();
        return;
      }
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      canvas.style.position = "absolute";
      canvas.style.inset = "0";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      canvas.setAttribute("aria-label", `${title}, page ${pageNumber}`);
      node.replaceChildren(canvas);
      renderTask = page.render({ canvasContext: context, viewport });
      await renderTask.promise;
      page.cleanup();
    })().catch((error: unknown) => {
      if (cancelled || isCancelError(error)) return;
      const node = holderRef.current;
      if (!node) return;
      node.replaceChildren();
      const message = document.createElement("p");
      message.className =
        "absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-muted-foreground";
      message.textContent = "This page couldn’t be drawn.";
      node.appendChild(message);
    });

    return () => {
      cancelled = true;
      renderTask?.cancel();
      holderRef.current?.replaceChildren();
    };
  }, [active, layoutWidth, pageNumber, pdf, title]);

  return (
    <div
      ref={holderRef}
      className="relative mb-3 w-full bg-white shadow-sm"
      style={{ aspectRatio: String(aspect) }}
    />
  );
}

export function PdfCanvasPreview({
  data,
  title,
  onError,
}: {
  data: ArrayBuffer;
  title: string;
  onError: () => void;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [aspects, setAspects] = useState<number[]>([]);
  const [layoutWidth, setLayoutWidth] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const loadingTask = getDocument({
      data: data.slice(0),
      isEvalSupported: false,
      useSystemFonts: true,
      isOffscreenCanvasSupported: false,
      isImageDecoderSupported: false,
    });

    loadingTask.promise
      .then(async (document) => {
        if (cancelled) return;
        const next: number[] = [];
        for (let index = 1; index <= document.numPages; index += 1) {
          const page = await document.getPage(index);
          const viewport = page.getViewport({ scale: 1 });
          next.push(viewport.width / viewport.height);
          page.cleanup();
          if (cancelled) return;
        }
        if (!cancelled) {
          setPdf(document);
          setAspects(next);
        }
      })
      .catch((error: unknown) => {
        if (!cancelled && !isCancelError(error)) onErrorRef.current();
      });

    return () => {
      cancelled = true;
      setPdf(null);
      setAspects([]);
      void loadingTask.destroy();
    };
  }, [data]);

  useEffect(() => {
    const element = scrollerRef.current;
    if (!element) return;
    const measure = () => setLayoutWidth(element.clientWidth);
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [aspects.length]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollerRef}
        className="min-h-[60dvh] flex-1 touch-pan-y overflow-y-auto overscroll-contain bg-muted/40 p-3 sm:min-h-[38rem]"
      >
        {pdf && aspects.length > 0 ? (
          aspects.map((aspect, index) => (
            <PdfPage
              key={`${title}-${index + 1}`}
              pdf={pdf}
              pageNumber={index + 1}
              aspect={aspect}
              title={title}
              layoutWidth={layoutWidth}
              rootRef={scrollerRef}
            />
          ))
        ) : (
          <p className="px-4 py-16 text-center text-sm text-muted-foreground">
            Preparing preview…
          </p>
        )}
      </div>
      {aspects.length > 0 ? (
        <p className="shrink-0 border-t border-border/70 px-3 py-2 text-center text-xs text-muted-foreground">
          {aspects.length} {aspects.length === 1 ? "page" : "pages"}. Scroll to load more.
        </p>
      ) : null}
    </div>
  );
}
