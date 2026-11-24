// État partagé de l'appli et petits outils d'interface communs à tous les écrans.

import { ecrire } from './db.js';
import { creerContextePrix } from './prix.js';

export const MODELE_GEMINI_DEFAUT = 'gemini-3.5-flash-lite';

export const etat = {
  recettes: [],
  parId: new Map(),
  ingredientsConnus: [],
  prixData: { maj: null, magasin: null, ingredients: {} },
  profil: null,
  stock: [],
  planning: null,
  coches: [],
  historique: { depenses: [], plats: [] },
  favoris: [],
  choix: {},
  prixTickets: {},
  reglages: { cleGemini: '', modeleGemini: MODELE_GEMINI_DEFAUT },
};

export const CLES_SAUVEES = ['profil', 'stock', 'planning', 'coches', 'historique', 'favoris', 'choix', 'prixTickets', 'reglages'];

export async function sauver(...cles) {
  for (const cle of cles) await ecrire(cle, etat[cle]);
}

export function contextePrix() {
  return creerContextePrix(etat.prixData, etat.choix, etat.prixTickets);
}

export function aller(chemin) {
  location.hash = `#/${chemin}`;
}

export function toast(message, duree = 2600) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  el.onclick = () => { el.hidden = true; };
  clearTimeout(toast.minuteur);
  toast.minuteur = setTimeout(() => { el.hidden = true; }, duree);
}

// Titre de l'écran, avec une petite ligne au-dessus et des boutons à droite si besoin.
export function titre(texte, options = {}) {
  document.getElementById('titre-page').textContent = texte;
  document.title = `${texte} · FedCook`;
  const sous = document.getElementById('sous-titre');
  sous.textContent = options.sousTitre || '';
  sous.hidden = !options.sousTitre;
  document.getElementById('actions-haut').innerHTML = options.actions || '';
}

// Liste des ingrédients connus pour l'autocomplétion des champs "ingrédient".
export function datalistIngredients(id = 'liste-ingredients') {
  const options = etat.ingredientsConnus.map((n) => `<option value="${n.replace(/"/g, '&quot;')}"></option>`).join('');
  return `<datalist id="${id}">${options}</datalist>`;
}
