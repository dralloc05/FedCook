// Prix des produits Leclerc (fichier data/prix.json) et prix relevés sur les tickets.
// data/prix.json peut être un relevé par ingrédient (« ingredients ») ou le catalogue complet (« produits »).

import { normaliser, memeIngredient } from './texte.js';
import { parserFormat, convertir } from './unites.js';
import { indexerCatalogue, chercherDansCatalogue } from './catalogue.js';

export function creerContextePrix(prixData, choix = {}, prixTickets = {}) {
  const parNom = new Map();
  const ingredients = (prixData && prixData.ingredients) || {};
  for (const [nom, produits] of Object.entries(ingredients)) {
    if (Array.isArray(produits) && produits.length) parNom.set(normaliser(nom), produits);
  }
  const tickets = new Map();
  for (const [nom, info] of Object.entries(prixTickets || {})) tickets.set(normaliser(nom), info);
  const catalogue = prixData && Array.isArray(prixData.produits) ? indexerCatalogue(prixData.produits) : null;
  return { parNom, catalogue, choix: choix || {}, tickets, cache: new Map() };
}

export function produitsPour(ctx, nom) {
  const n = normaliser(nom);
  if (ctx.parNom.has(n)) return ctx.parNom.get(n);
  for (const [cle, produits] of ctx.parNom) {
    if (memeIngredient(cle, n)) return produits;
  }
  return ctx.catalogue ? chercherDansCatalogue(ctx.catalogue, nom) : [];
}

export function prixEffectif(p) {
  if (!p) return null;
  return typeof p.prixPromo === 'number' && p.prixPromo > 0 ? p.prixPromo : p.prix;
}

export function contenance(p) {
  if (!p) return null;
  const lu = parserFormat(p.format) || parserFormat(p.nom) || parserFormat(p.nomComplet);
  if (lu && lu.qte > 0) return lu;
  // Sinon, on la déduit du prix et du prix au kilo / au litre.
  if (typeof p.prix === 'number' && typeof p.prixUnite === 'number' && p.prixUnite > 0) {
    const u = String(p.unite || '').toLowerCase();
    if (u === 'kg') return { qte: (p.prix / p.prixUnite) * 1000, unite: 'g' };
    if (u === 'l') return { qte: (p.prix / p.prixUnite) * 1000, unite: 'ml' };
    if (['pce', 'piece', 'pièce', 'u', 'unite', 'unité'].includes(u)) return { qte: Math.round(p.prix / p.prixUnite), unite: 'piece' };
  }
  return null;
}

// Le produit retenu pour un ingrédient : celui choisi par l'utilisateur, sinon le moins cher au kilo.
export function choisirProduit(ctx, nom) {
  const n = normaliser(nom);
  if (ctx.cache.has(n)) return ctx.cache.get(n);
  const produits = produitsPour(ctx, nom).filter((p) => p && typeof p.prix === 'number' && p.prix > 0);
  let retenu = null;
  const idChoisi = ctx.choix[n];
  if (idChoisi) retenu = produits.find((p) => String(p.id) === String(idChoisi)) || null;
  if (!retenu) {
    let meilleur = Infinity;
    for (const p of produits) {
      if (p.enStock === false) continue;
      const c = contenance(p);
      if (!c) continue;
      const parUnite = prixEffectif(p) / c.qte;
      if (parUnite < meilleur) {
        meilleur = parUnite;
        retenu = p;
      }
    }
  }
  ctx.cache.set(n, retenu);
  return retenu;
}

// Combien coûte l'achat de "qte unite" de cet ingrédient ?
// Avec un produit du Drive : on achète des paquets entiers.
// Sinon, avec un prix relevé sur un ticket : prix proportionnel.
export function estimerAchat(ctx, nom, qte, unite, gParPiece = null) {
  if (!(qte > 0)) return { cout: 0, source: 'rien' };
  const produit = choisirProduit(ctx, nom);
  if (produit) {
    const c = contenance(produit);
    const besoin = c ? convertir(qte, unite, c.unite, gParPiece) : null;
    if (c && besoin !== null) {
      const paquets = Math.max(1, Math.ceil(besoin / c.qte - 1e-9));
      return {
        cout: paquets * prixEffectif(produit),
        paquets,
        produit,
        qteAchetee: paquets * c.qte,
        uniteAchat: c.unite,
        source: 'drive',
      };
    }
  }
  const ticket = ctx.tickets.get(normaliser(nom));
  if (ticket && ticket.prixParUnite > 0) {
    const besoin = convertir(qte, unite, ticket.unite, gParPiece);
    if (besoin !== null) {
      return {
        cout: besoin * ticket.prixParUnite,
        paquets: null,
        produit: null,
        qteAchetee: besoin,
        uniteAchat: ticket.unite,
        source: 'ticket',
      };
    }
  }
  return { cout: 0, paquets: null, produit: null, qteAchetee: qte, uniteAchat: unite, source: 'inconnu' };
}
