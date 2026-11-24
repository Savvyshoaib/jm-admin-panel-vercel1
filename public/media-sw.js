const files = new Map();

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  const data = event.data;
  if (!data || data.type !== "store" || typeof data.id !== "string") return;
  if (data.buffer instanceof ArrayBuffer) files.set(data.id, data.buffer);
  event.ports[0]?.postMessage({ ok: true });
});

function videoResponse(buffer, rangeHeader) {
  const total = buffer.byteLength;
  const headers = {
    "Content-Type": "video/mp4",
    "Accept-Ranges": "bytes",
  };
  if (!rangeHeader) {
    return new Response(buffer, {
      status: 200,
      headers: { ...headers, "Content-Length": String(total) },
    });
  }
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
  if (!match) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${total}` } });
  }
  const start = match[1] ? Number(match[1]) : 0;
  let end = match[2] ? Number(match[2]) : total - 1;
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= total || start > end) {
    return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${total}` } });
  }
  end = Math.min(end, total - 1);
  const body = buffer.slice(start, end + 1);
  return new Response(body, {
    status: 206,
    headers: {
      ...headers,
      "Content-Length": String(body.byteLength),
      "Content-Range": `bytes ${start}-${end}/${total}`,
    },
  });
}

const STORAGE_ORIGIN = "https://jm-backend.qiko.ai";

/**
 * The live admin host answers `/storage/...` with the SPA HTML page.
 * A <video> then fails with "format is not supported". Fetch the real file
 * from the API and hand those bytes back as a same-origin response.
 * A local dev proxy already returns the file, so an HTML body is the signal.
 */
async function proxyStorage(request, url) {
  const direct = await fetch(request);
  const type = (direct.headers.get("content-type") || "").toLowerCase();
  if (!type.includes("text/html") && !type.startsWith("text/")) return direct;

  const headers = new Headers();
  const range = request.headers.get("range");
  if (range) headers.set("Range", range);
  const remote = await fetch(`${STORAGE_ORIGIN}${url.pathname}${url.search}`, { headers });
  const responseHeaders = new Headers();
  for (const key of ["content-type", "content-length", "content-range", "accept-ranges"]) {
    const value = remote.headers.get(key);
    if (value) responseHeaders.set(key, value);
  }
  return new Response(remote.body, {
    status: remote.status,
    statusText: remote.statusText,
    headers: responseHeaders,
  });
}

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin === self.location.origin && url.pathname.startsWith("/storage/")) {
    event.respondWith(proxyStorage(event.request, url));
    return;
  }
  if (!url.pathname.startsWith("/play/")) return;
  const id = decodeURIComponent(url.pathname.slice("/play/".length).replace(/\.mp4$/, ""));
  const buffer = files.get(id);
  if (!buffer) {
    event.respondWith(new Response("Video is not ready.", { status: 404 }));
    return;
  }
  event.respondWith(videoResponse(buffer, event.request.headers.get("range")));
});
