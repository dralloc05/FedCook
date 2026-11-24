// Unités de base : 'g' (grammes), 'ml' (millilitres), 'piece' (pièces).
// Approximation assumée : 1 ml ≈ 1 g pour passer de l'un à l'autre.

export const UNITES = ['g', 'ml', 'piece'];

export function convertir(qte, de, vers, gParPiece = null) {
  if (qte === null || qte === undefined || Number.isNaN(qte)) return null;
  if (de === vers) return qte;
  const masse = (u) => u === 'g' || u === 'ml';
  if (masse(de) && masse(vers)) return qte; // 1 ml ≈ 1 g
  if (de === 'piece' && masse(vers)) return gParPiece ? qte * gParPiece : null;
  if (masse(de) && vers === 'piece') return gParPiece ? qte / gParPiece : null;
  return null;
}

export function afficherQuantite(qte, unite) {
  if (qte === null || qte === undefined || Number.isNaN(qte)) return '';
  if (unite === 'piece') {
    const arrondi = Math.round(qte * 4) / 4;
    return `${formatNombre(arrondi)}`;
  }
  if (unite === 'g') {
    if (qte >= 1000) return `${formatNombre(qte / 1000, 2)} kg`;
    return `${formatNombre(arrondiDoux(qte))} g`;
  }
  if (unite === 'ml') {
    if (qte >= 1000) return `${formatNombre(qte / 1000, 2)} L`;
    if (qte < 30) return `${formatNombre(arrondiDoux(qte))} ml`;
    return `${formatNombre(arrondiDoux(qte) / 10, 1)} cl`;
  }
  return `${formatNombre(qte)} ${unite}`;
}

function arrondiDoux(q) {
  if (q < 10) return Math.round(q * 2) / 2;
  if (q < 100) return Math.round(q);
  return Math.round(q / 5) * 5;
}

export function formatNombre(n, decimales = 1) {
  return Number(n).toLocaleString('fr-FR', { maximumFractionDigits: decimales });
}

// Lit la contenance d'un produit dans un texte : "Lardons fumés 2x100g", "Lait 1L", "Oeufs x12".
export function parserFormat(texte) {
  if (!texte) return null;
  const t = String(texte).toLowerCase().replace(/,/g, '.').replace(/ /g, ' ');
  const versBase = (q, u) => {
    switch (u) {
      case 'kg': return { qte: q * 1000, unite: 'g' };
      case 'g': case 'gr': return { qte: q, unite: 'g' };
      case 'l': return { qte: q * 1000, unite: 'ml' };
      case 'cl': return { qte: q * 10, unite: 'ml' };
      case 'ml': return { qte: q, unite: 'ml' };
      default: return null;
    }
  };
  let m = t.match(/(\d+)\s*x\s*(\d+(?:\.\d+)?)\s*(kg|gr|g|ml|cl|l)\b/);
  if (m) return versBase(Number(m[1]) * Number(m[2]), m[3]);
  m = t.match(/(\d+(?:\.\d+)?)\s*(kg|gr|g|ml|cl|l)\s*x\s*(\d+)\b/);
  if (m) return versBase(Number(m[1]) * Number(m[3]), m[2]);
  const toutes = [...t.matchAll(/(\d+(?:\.\d+)?)\s*(kg|gr|g|ml|cl|l)\b/g)];
  if (toutes.length) {
    const d = toutes[toutes.length - 1];
    return versBase(Number(d[1]), d[2]);
  }
  m = t.match(/(?:^|\s)x\s*(\d+)\b/) || t.match(/\b(\d+)\s*(?:pieces?|pièces?|pcs|oeufs?|œufs?|unites?|unités?|tranches?)\b/);
  if (m) return { qte: Number(m[1]), unite: 'piece' };
  return null;
}

// Dates au format AAAA-MM-JJ, calculées en heure locale.
export function aujourdhui() {
  return dateISO(new Date());
}

export function dateISO(d) {
  const a = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const j = String(d.getDate()).padStart(2, '0');
  return `${a}-${m}-${j}`;
}

export function ajouterJours(iso, jours) {
  const [a, m, j] = iso.split('-').map(Number);
  const d = new Date(a, m - 1, j);
  d.setDate(d.getDate() + jours);
  return dateISO(d);
}

export function joursEntre(isoDebut, isoFin) {
  const [a1, m1, j1] = isoDebut.split('-').map(Number);
  const [a2, m2, j2] = isoFin.split('-').map(Number);
  const d1 = Date.UTC(a1, m1 - 1, j1);
  const d2 = Date.UTC(a2, m2 - 1, j2);
  return Math.round((d2 - d1) / 86400000);
}

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export function dateLisible(iso, avecJour = true) {
  if (!iso) return '';
  const [a, m, j] = iso.split('-').map(Number);
  const d = new Date(a, m - 1, j);
  const base = `${j} ${MOIS[m - 1]}`;
  return avecJour ? `${JOURS[d.getDay()]} ${base}` : base;
}
