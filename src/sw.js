import { registerRoute, setDefaultHandler } from "workbox-routing";
import {
  NetworkFirst,
  StaleWhileRevalidate,
  CacheFirst,
} from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";
import * as googleAnalytics from "workbox-google-analytics";
import { BackgroundSyncPlugin } from "workbox-background-sync";

//Offline Google Analytics
googleAnalytics.initialize({
  cacheName: "analytics",
});

// Background Sync
const bySyncPlugin = new BackgroundSyncPlugin("background-sync", {
  maxRetentionTime: 60 * 24,
});

// Preloading Navigation
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

// Caching for CSS,JS & Service Worker
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

// Image Caching
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

// Offline page fallback variable
const pageFallback = "../offline.html";
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
    async () => {
        const cache = await self.caches.open("workbox-offline-fallbacks")
        cache.addAll(files)
    }
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
