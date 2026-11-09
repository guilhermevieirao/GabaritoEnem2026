// Funciona offline depois da primeira visita.
// Arquivos de dados (gabarito) usam "rede primeiro" para pegar atualizações assim que saem;
// o resto usa cache primeiro. Mude VERSAO a cada publicação para renovar o cache.
const VERSAO = 'gabarito-2026-v1';
const ESSENCIAIS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/css/app.css',
  './assets/js/app.js',
  './assets/js/core.js',
  './assets/js/icones.js',
  './assets/js/som.js',
  './assets/js/pdf.js',
  './assets/vendor/jspdf.umd.min.js',
  './assets/fonts/atkinson-next-latin.woff2',
  './assets/fonts/atkinson-mono-latin.woff2',
  './assets/img/icone.svg',
  './data/enem2026.js',
  './data/gabarito-2026-dia1.js',
  './data/gabarito-2026-dia2.js',
  './data/tri.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSAO).then((c) => c.addAll(ESSENCIAIS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(chaves.filter((k) => k !== VERSAO).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  const ehDado = url.pathname.includes('/data/');
  if (ehDado || e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          const copia = r.clone();
          caches.open(VERSAO).then((c) => c.put(e.request, copia));
          return r;
        })
        .catch(() => caches.match(e.request).then((r) => r || caches.match('./index.html'))),
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then((r) => r || fetch(e.request).then((resp) => {
      if (resp.ok) { const copia = resp.clone(); caches.open(VERSAO).then((c) => c.put(e.request, copia)); }
      return resp;
    })),
  );
});
