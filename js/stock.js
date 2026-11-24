// Gestion du stock (frigo, congélateur, placards). Fonctions sans effet de bord.

import { memeIngredient, normaliser } from './texte.js';
import { convertir, joursEntre } from './unites.js';

export const EMPLACEMENTS = ['Frigo', 'Congélateur', 'Placard'];

export function nouvelId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function itemsPour(stock, nomIngredient) {
  return stock.filter((it) => it.qte > 0 && memeIngredient(it.ingredient || it.nom, nomIngredient));
}

export function disponible(stock, nomIngredient, unite, gParPiece = null) {
  let total = 0;
  for (const it of itemsPour(stock, nomIngredient)) {
    const q = convertir(it.qte, it.unite, unite, gParPiece || it.gParPiece);
    if (q !== null) total += q;
  }
  return total;
}

// Nombre de jours avant la première date de péremption parmi les produits correspondants.
export function joursAvantPeremption(stock, nomIngredient, aujourdhuiISO) {
  let min = Infinity;
  for (const it of itemsPour(stock, nomIngredient)) {
    if (!it.peremption) continue;
    min = Math.min(min, joursEntre(aujourdhuiISO, it.peremption));
  }
  return min;
}

// Retire une quantité du stock, en commençant par ce qui périme le plus tôt.
export function retirer(stock, nomIngredient, qte, unite, gParPiece = null) {
  const copie = stock.map((it) => ({ ...it }));
  const concernes = copie
    .filter((it) => it.qte > 0 && memeIngredient(it.ingredient || it.nom, nomIngredient))
    .sort((a, b) => (a.peremption || '9999') .localeCompare(b.peremption || '9999'));
  let reste = qte;
  for (const it of concernes) {
    if (reste <= 1e-9) break;
    const gp = gParPiece || it.gParPiece;
    const dispo = convertir(it.qte, it.unite, unite, gp);
    if (dispo === null || dispo <= 0) continue;
    const pris = Math.min(dispo, reste);
    const prisDansUniteItem = convertir(pris, unite, it.unite, gp);
    it.qte = Math.max(0, it.qte - prisDansUniteItem);
    reste -= pris;
  }
  return {
    stock: copie.filter((it) => it.qte > 1e-6),
    manque: Math.max(0, reste),
  };
}

// Ajoute un produit. Fusionne avec une ligne identique (même nom, unité et date).
export function ajouter(stock, item) {
  const copie = stock.map((it) => ({ ...it }));
  const pareil = copie.find(
    (it) =>
      normaliser(it.nom) === normaliser(item.nom) &&
      it.unite === item.unite &&
      (it.peremption || '') === (item.peremption || '') &&
      (it.emplacement || '') === (item.emplacement || '')
  );
  if (pareil) {
    pareil.qte += item.qte;
    return copie;
  }
  copie.push(item);
  return copie;
}

export function trierParPeremption(stock) {
  return [...stock].sort((a, b) => (a.peremption || '9999').localeCompare(b.peremption || '9999'));
}
