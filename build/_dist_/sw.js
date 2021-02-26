import { registerRoute, setDefaultHandler } from "../_snowpack/pkg/workbox-routing.js";
import {
  NetworkFirst,
  StaleWhileRevalidate,
  CacheFirst,
} from "../_snowpack/pkg/workbox-strategies.js";
import { ExpirationPlugin } from "../_snowpack/pkg/workbox-expiration.js";
import { CacheableResponsePlugin } from "../_snowpack/pkg/workbox-cacheable-response.js";
import * as googleAnalytics from "../_snowpack/pkg/workbox-google-analytics.js";
import { BackgroundSyncPlugin } from "../_snowpack/pkg/workbox-background-sync.js";

googleAnalytics.initialize({
  cacheName: "analytics",
});

const bySyncPlugin = new BackgroundSyncPlugin("background-sync", {
  maxRetentionTime: 60 * 24,
});

registerRoute(
  ({ request }) => request.mode === "navigate",
  new NetworkFirst({
    cacheName: "pages",
    plugins: [
      new CacheableResponsePlugin({
        statuses: [200],
      }),
      bySyncPlugin,
    ],
  })
);

registerRoute(
  ({ request }) =>
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "worker",

  new StaleWhileRevalidate({
    cacheName: "assets",
    plugins: [
      new CacheableResponsePlugin({
        statuses: [200],
      }),
      bySyncPlugin,
    ],
  })
);

registerRoute(
  ({ request }) => request.destination === "image",
  new CacheFirst({
    cacheName: "images",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 50,
        maxAgeSeconds: 60 * 60 * 24 * 30,
      }),
      bySyncPlugin,
    ],
  })
);

const pageFallback = "offline.html";
const imageFallback = false;
const fontFallback = false;

self.addEventListener("install", (event) => {
  const files = [pageFallback];
  if (imageFallback) {
    files.push(imageFallback);
  }
  if (fontFallback) {
    files.push(fontFallback);
  }

  event.waitUntil(
    self.caches
      .open("workbox-offline-fallbacks")
      .then((cache) => cache.addAll(files))
  );
});

const handler = async (options) => {
  const dest = options.request.destination;
  const cache = await self.caches.open("workbox-offline-fallbacks");

  if (dest === "document") {
    return (await cache.match(pageFallback)) || Response.error();
  }

  if (dest === "image" && imageFallback !== false) {
    return (await cache.match(imageFallback)) || Response.error();
  }

  if (dest === "font" && fontFallback !== false) {
    return (await cache.match(fontFallback)) || Response.error();
  }

  return Response.error();
};

setCatchHandler(handler);
