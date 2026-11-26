// Service worker : l'appli s'ouvre même sans réseau.
// Change VERSION à chaque mise à jour du code pour forcer le rechargement.
const VERSION = 'v5';
const CACHE = `appli-repas-${VERSION}`;
const COQUILLE = [
  './',
  "./css/style.css",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./index.html",
  "./js/app.js",
  "./js/catalogue.js",
  "./js/db.js",
  "./js/ecrans/accueil.js",
  "./js/ecrans/ajout-stock.js",
  "./js/ecrans/courses.js",
  "./js/ecrans/cuisine.js",
  "./js/ecrans/frigo.js",
  "./js/ecrans/historique.js",
  "./js/ecrans/installation.js",
  "./js/ecrans/planning.js",
  "./js/ecrans/plus.js",
  "./js/ecrans/recette.js",
  "./js/ecrans/recettes.js",
  "./js/ecrans/reglages.js",
  "./js/ecrans/revue.js",
  "./js/ecrans/scan.js",
  "./js/ecrans/stock.js",
  "./js/ecrans/ticket.js",
  "./js/etat.js",
  "./js/gemini.js",
  "./js/icones.js",
  "./js/peremption.js",
  "./js/planning.js",
  "./js/popularite.js",
  "./js/prix.js",
  "./js/stock.js",
  "./js/texte.js",
  "./js/ticket-texte.js",
  "./js/unites.js",
  "./manifest.webmanifest",
];

self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(CACHE).then((c) => c.addAll(COQUILLE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (ev) => {
  ev.waitUntil(
    caches.keys()
      .then((cles) => Promise.all(cles.filter((k) => k.startsWith('appli-repas-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (ev) => {
  const req = ev.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Gemini, Open Food Facts, Tesseract : pas de cache ici

  // Données (recettes, prix) : d'abord le réseau pour avoir la dernière version.
  if (url.pathname.includes('/data/')) {
    ev.respondWith(
      fetch(req)
        .then((rep) => {
          const copie = rep.clone();
          caches.open(CACHE).then((c) => c.put(req, copie));
          return rep;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Code de l'appli : le cache d'abord, mis à jour en arrière-plan.
  ev.respondWith(
    caches.match(req).then((enCache) => {
      const reseau = fetch(req)
        .then((rep) => {
          if (rep.ok) {
            const copie = rep.clone();
            caches.open(CACHE).then((c) => c.put(req, copie));
          }
          return rep;
        })
        .catch(() => enCache);
      return enCache || reseau;
    })
  );
});
