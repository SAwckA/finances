const STATIC_CACHE = "finances-static-v2";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(STATIC_CACHE));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheKeys = await caches.keys();
      await Promise.all(
        cacheKeys
          .filter((key) => key !== STATIC_CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  const isStaticAsset =
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "font" ||
    request.destination === "image";

  if (!isStaticAsset) {
    return;
  }

  if (
    requestUrl.pathname.startsWith("/icon-") ||
    requestUrl.pathname === "/apple-touch-icon.png" ||
    requestUrl.pathname.startsWith("/favicon")
  ) {
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cachedResponse = await cache.match(request);

      if (cachedResponse) {
        event.waitUntil(
          (async () => {
            const freshResponse = await fetch(request);
            await cache.put(request, freshResponse.clone());
          })(),
        );
        return cachedResponse;
      }

      const networkResponse = await fetch(request);
      await cache.put(request, networkResponse.clone());

      return networkResponse;
    })(),
  );
});
