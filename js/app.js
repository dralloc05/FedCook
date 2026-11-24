// Point d'entrée : chargement des données, navigation entre les écrans.

import { lire } from './db.js';
import { normaliser } from './texte.js';
import { etat, CLES_SAUVEES, MODELE_GEMINI_DEFAUT, aller } from './etat.js';

import * as accueil from './ecrans/accueil.js';
import * as installation from './ecrans/installation.js';
import * as planning from './ecrans/planning.js';
import * as stock from './ecrans/stock.js';
import * as ajoutStock from './ecrans/ajout-stock.js';
import * as scan from './ecrans/scan.js';
import * as ticket from './ecrans/ticket.js';
import * as frigo from './ecrans/frigo.js';
import * as courses from './ecrans/courses.js';
import * as recettes from './ecrans/recettes.js';
import * as recette from './ecrans/recette.js';
import * as cuisine from './ecrans/cuisine.js';
import * as plus from './ecrans/plus.js';
import * as historique from './ecrans/historique.js';
import * as reglages from './ecrans/reglages.js';

const ECRANS = {
  accueil, installation, planning, stock, 'ajout-stock': ajoutStock, scan, ticket, frigo,
  courses, recettes, recette, cuisine, plus, historique, reglages,
};
const ONGLETS = { accueil: 'accueil', planning: 'planning', stock: 'stock', courses: 'courses', plus: 'plus' };

async function chargerJSON(url, parDefaut) {
  try {
    const rep = await fetch(url, { cache: 'no-cache' });
    if (!rep.ok) throw new Error(`HTTP ${rep.status}`);
    return await rep.json();
  } catch (e) {
    console.warn('Chargement impossible', url, e);
    return parDefaut;
  }
}

async function demarrer() {
  for (const cle of CLES_SAUVEES) {
    const valeur = await lire(cle, null);
    if (valeur !== null) etat[cle] = valeur;
  }
  etat.reglages = { cleGemini: '', modeleGemini: MODELE_GEMINI_DEFAUT, ...etat.reglages };
  etat.historique = { depenses: [], plats: [], ...etat.historique };

  const [recettesData, prixData] = await Promise.all([
    chargerJSON('data/recettes.json', []),
    chargerJSON('data/prix.json', null),
  ]);
  etat.recettes = Array.isArray(recettesData) ? recettesData.filter((r) => r && r.id && r.titre) : [];
  etat.parId = new Map(etat.recettes.map((r) => [r.id, r]));
  if (prixData && prixData.ingredients) etat.prixData = prixData;

  const noms = new Map();
  for (const r of etat.recettes) {
    for (const ing of r.ingredients || []) {
      const n = normaliser(ing.nom);
      if (!noms.has(n)) noms.set(n, ing.nom);
    }
  }
  etat.ingredientsConnus = [...noms.values()].sort((a, b) => a.localeCompare(b, 'fr'));

  window.addEventListener('hashchange', afficher);
  document.getElementById('bouton-retour').addEventListener('click', () => history.back());
  afficher();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service worker', e));
  }
}

let ecranCourant = null;

async function afficher() {
  const [nom, ...params] = (location.hash.replace(/^#\/?/, '') || 'accueil').split('/').map(decodeURIComponent);
  if (!etat.profil && nom !== 'installation') {
    aller('installation');
    return;
  }
  const ecran = ECRANS[nom] || accueil;
  if (ecranCourant && ecranCourant.quitter) {
    try { ecranCourant.quitter(); } catch (e) { console.warn(e); }
  }
  ecranCourant = ecran;

  const onglet = ONGLETS[nom];
  document.querySelectorAll('#barre-bas a').forEach((a) => a.classList.toggle('actif', a.dataset.onglet === onglet));
  document.getElementById('barre-bas').hidden = nom === 'installation' || nom === 'cuisine';
  document.getElementById('bouton-retour').hidden = Boolean(onglet) || (nom === 'installation' && !etat.profil);

  const conteneur = document.getElementById('contenu');
  conteneur.innerHTML = '<p class="chargement">Chargement…</p>';
  window.scrollTo(0, 0);
  try {
    await ecran.afficher(conteneur, params);
  } catch (e) {
    console.error(e);
    conteneur.innerHTML = `<div class="alerte rouge">Une erreur est survenue : ${String(e.message || e)}</div>`;
  }
}

demarrer();
