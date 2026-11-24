// Stockage local dans le téléphone (IndexedDB), sous forme clé -> valeur.
// Toutes les données de l'appli restent sur l'appareil.

const NOM_BASE = 'appli-repas';
const MAGASIN = 'kv';
let promesseBase = null;

function ouvrirBase() {
  if (promesseBase) return promesseBase;
  promesseBase = new Promise((resolve, reject) => {
    const req = indexedDB.open(NOM_BASE, 1);
    req.onupgradeneeded = () => {
      const base = req.result;
      if (!base.objectStoreNames.contains(MAGASIN)) base.createObjectStore(MAGASIN);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return promesseBase;
}

export async function lire(cle, valeurParDefaut = null) {
  try {
    const base = await ouvrirBase();
    return await new Promise((resolve, reject) => {
      const tx = base.transaction(MAGASIN, 'readonly');
      const req = tx.objectStore(MAGASIN).get(cle);
      req.onsuccess = () => resolve(req.result === undefined ? valeurParDefaut : req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.error('Lecture impossible', cle, e);
    return valeurParDefaut;
  }
}

export async function ecrire(cle, valeur) {
  const base = await ouvrirBase();
  return new Promise((resolve, reject) => {
    const tx = base.transaction(MAGASIN, 'readwrite');
    tx.objectStore(MAGASIN).put(valeur, cle);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function toutLire() {
  const base = await ouvrirBase();
  return new Promise((resolve, reject) => {
    const resultat = {};
    const tx = base.transaction(MAGASIN, 'readonly');
    const req = tx.objectStore(MAGASIN).openCursor();
    req.onsuccess = () => {
      const curseur = req.result;
      if (curseur) {
        resultat[curseur.key] = curseur.value;
        curseur.continue();
      } else {
        resolve(resultat);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function toutRemplacer(donnees) {
  const base = await ouvrirBase();
  return new Promise((resolve, reject) => {
    const tx = base.transaction(MAGASIN, 'readwrite');
    const magasin = tx.objectStore(MAGASIN);
    magasin.clear();
    for (const [cle, valeur] of Object.entries(donnees)) magasin.put(valeur, cle);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
