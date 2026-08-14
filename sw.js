const CACHE_NAME = "dev-checklist-v14";
const ASSETS = [
  "./",
  "./index.html",
  // index.html은 이 둘이 없으면 성장 백분위·해열제 용량 계산이 통째로 죽는다.
  // 스크립트를 새로 나눌 때 여기 추가하는 걸 빠뜨리면 온라인에서는 멀쩡하고
  // 오프라인에서만 깨진다.
  "./lib/growth.js",
  "./lib/dosing.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  // 약국·응급실 데이터(data/*.json)는 매일 갱신되므로 신선도가 오프라인 지원보다
  // 중요하다. 캐시 우선으로 두면 어제 목록을 보여주고 조용히 갱신하게 된다.
  // 네트워크 우선 + 실패 시에만 캐시(비행기모드에서도 어제 목록은 보이도록).
  const url = new URL(event.request.url);
  if (url.origin === location.origin && url.pathname.includes("/data/")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
