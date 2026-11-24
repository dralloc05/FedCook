// Analyse du texte d'un ticket de caisse lu par Tesseract.

import { devinerIngredient, majuscule } from './texte.js';
import { parserFormat } from './unites.js';

const A_IGNORER = /(sous.?total|t\.?v\.?a|^cb\b|\bcb\b|carte|paiement|rendu|esp[eè]ces?|merci|siret|t[eé]l[eé]?phone|\btel\b|caisse|h[oô]tesse|nombre d.?articles?|net a payer|montant|avoir|fid[eé]lit|cagnott|points?\b|ticket|leclerc|www\.|date|heure|magasin|rendez|bienvenue)/i;
const REMISE = /(remise|r[eé]duc|promo|bon de|coupon|avantage|offre)/i;
const MONTANT = /(-?\d{1,4}[.,]\d{2})\s*(?:€|eur)?\s*[a-z0-9]?\s*$/i;

function nombre(texte) {
  return Number(String(texte).replace(',', '.'));
}

export function analyserTicket(texte, ingredientsConnus = []) {
  const lignes = String(texte || '').split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const articles = [];
  let total = null;
  let quantiteEnAttente = null;

  for (const ligne of lignes) {
    const mTotal = ligne.match(/^(?!.*sous).*\btotal\b.*?(\d{1,4}[.,]\d{2})/i);
    if (mTotal) {
      if (total === null) total = nombre(mTotal[1]);
      continue;
    }
    const mQte = ligne.match(/^(\d{1,3})\s*[x*]\s*(\d{1,4}[.,]\d{2})/i);
    if (mQte) {
      const n = Number(mQte[1]);
      const pu = nombre(mQte[2]);
      const precedent = articles[articles.length - 1];
      if (precedent && Math.abs(precedent.prix - n * pu) < 0.02 && precedent.nb === 1) precedent.nb = n;
      else quantiteEnAttente = n;
      continue;
    }
    if (A_IGNORER.test(ligne)) continue;
    const m = ligne.match(MONTANT);
    if (!m) continue;
    const libelle = ligne.slice(0, m.index).trim();
    const prix = nombre(m[1]);
    if ((libelle.match(/[a-zà-ÿ]/gi) || []).length < 2) continue;
    if (prix < 0 || REMISE.test(libelle)) {
      const precedent = articles[articles.length - 1];
      if (precedent) precedent.prix = Math.max(0, precedent.prix - Math.abs(prix));
      continue;
    }
    articles.push({ libelle, prix, nb: quantiteEnAttente || 1 });
    quantiteEnAttente = null;
  }

  return {
    total,
    articles: articles.map((a) => {
      const format = parserFormat(a.libelle);
      const nomLisible = majuscule(a.libelle.toLowerCase());
      return {
        libelle: a.libelle,
        nom: nomLisible,
        ingredient: devinerIngredient(a.libelle, ingredientsConnus),
        prix: Math.round(a.prix * 100) / 100,
        qte: format ? format.qte * a.nb : a.nb,
        unite: format ? format.unite : 'piece',
      };
    }),
  };
}
