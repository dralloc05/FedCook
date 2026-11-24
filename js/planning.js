// Choix des repas et calcul de la liste de courses. Fonctions sans effet de bord,
// testables hors du navigateur.

import { normaliser, memeNormalise } from './texte.js';
import { convertir, ajouterJours, joursEntre } from './unites.js';
import { retirer, disponible, ajouter, nouvelId } from './stock.js';
import { estimerAchat } from './prix.js';
import { peremptionParDefaut, rayonDe, RAYONS } from './peremption.js';

export const RESTRICTIONS = [
  ['vegetarien', 'Végétarien'],
  ['vegan', 'Végétalien'],
  ['sans_lactose', 'Sans lactose'],
  ['sans_gluten', 'Sans gluten'],
  ['sans_porc', 'Sans porc'],
];

export const MATERIEL = [
  ['plaques', 'Plaques de cuisson'],
  ['four', 'Four'],
  ['micro_ondes', 'Micro-ondes'],
  ['airfryer', 'Airfryer'],
  ['mixeur', 'Mixeur'],
  ['cocotte_minute', 'Cocotte-minute'],
  ['robot', 'Robot pâtissier / cuiseur'],
  ['barbecue', 'Barbecue / plancha'],
];

export const BASES_PROPOSEES = ['sel', 'poivre', 'huile d\'olive', 'huile', 'vinaigre', 'sucre', 'farine', 'moutarde', 'herbes de Provence'];

const TYPES_REPAS = new Set(['plat']);
const POOL_MAX = 700;

// ---------- Compatibilité avec le profil ----------

export function recettesCompatibles(recettes, profil) {
  const restrictions = profil?.restrictions || [];
  const materiel = new Set(profil?.materiel || []);
  const interdits = [...(profil?.detestes || []), ...(profil?.allergies || [])]
    .map(normaliser)
    .filter(Boolean);
  return recettes.filter((r) => {
    if (!TYPES_REPAS.has(r.type || 'plat')) return false;
    const regimes = new Set(r.regimes || []);
    if (restrictions.some((x) => !regimes.has(x))) return false;
    if ((r.materiel || []).some((m) => !materiel.has(m))) return false;
    if (interdits.length) {
      for (const ing of r.ingredients || []) {
        const n = normaliser(ing.nom);
        if (interdits.some((x) => n === x || ` ${n} `.includes(` ${x} `))) return false;
      }
    }
    return true;
  });
}

export function estProduitDeBase(nom, profil) {
  const n = normaliser(nom);
  if (n === 'eau') return true;
  return (profil?.base || []).some((b) => memeNormalise(normaliser(b), n));
}

export function besoins(recette, personnes) {
  const facteur = personnes / (recette.portions || 4);
  return (recette.ingredients || []).map((ing) => ({
    nom: ing.nom,
    qte: (Number(ing.qte) || 0) * facteur,
    unite: ing.unite || 'g',
    g: ing.g || null,
  }));
}

function idsRecents(historique, aujourdhuiISO, jours) {
  const ids = new Set();
  for (const p of historique?.plats || []) {
    if (p.date && joursEntre(p.date, aujourdhuiISO) <= jours) ids.add(p.recetteId);
  }
  return ids;
}

// ---------- Stock virtuel (pendant la construction du planning) ----------

function indexer(stock) {
  return stock.filter((it) => it.qte > 0).map((it) => ({ it, n: normaliser(it.ingredient || it.nom) }));
}

function dispoRapide(index, nNom, unite, g) {
  let total = 0;
  for (const e of index) {
    if (!memeNormalise(e.n, nNom)) continue;
    const q = convertir(e.it.qte, e.it.unite, unite, g || e.it.gParPiece);
    if (q !== null) total += q;
  }
  return total;
}

function urgenceRapide(index, nNom, aujourdhuiISO) {
  let min = Infinity;
  for (const e of index) {
    if (!e.it.peremption || !memeNormalise(e.n, nNom)) continue;
    min = Math.min(min, joursEntre(aujourdhuiISO, e.it.peremption));
  }
  return min;
}

// Applique une recette au stock virtuel : retire ce qui est utilisé,
// achète les paquets manquants et garde le reste des paquets en stock.
function appliquer(stock, recette, personnes, p, dateISO) {
  let s = stock;
  let cout = 0;
  for (const ing of besoins(recette, personnes)) {
    if (ing.qte <= 0 || estProduitDeBase(ing.nom, p.profil)) continue;
    const res = retirer(s, ing.nom, ing.qte, ing.unite, ing.g);
    s = res.stock;
    if (res.manque > 1e-9) {
      const achat = estimerAchat(p.ctxPrix, ing.nom, res.manque, ing.unite, ing.g);
      cout += achat.cout;
      const manqueConverti = convertir(res.manque, ing.unite, achat.uniteAchat, ing.g);
      const reste = manqueConverti !== null ? achat.qteAchetee - manqueConverti : 0;
      if (achat.source === 'drive' && reste > 1e-6) {
        s = ajouter(s, {
          id: nouvelId(),
          nom: ing.nom,
          ingredient: ing.nom,
          qte: reste,
          unite: achat.uniteAchat,
          gParPiece: ing.g,
          peremption: peremptionParDefaut(ing.nom, dateISO),
          virtuel: true,
        });
      }
    }
  }
  return { stock: s, cout };
}

function evaluer(recette, personnes, index, p, caches) {
  let usage = 0;
  let cout = 0;
  let inconnus = 0;
  for (const ing of besoins(recette, personnes)) {
    if (ing.qte <= 0 || estProduitDeBase(ing.nom, p.profil)) continue;
    const n = normaliser(ing.nom);
    const cleDispo = `${n}|${ing.unite}`;
    let dispo = caches.dispo.get(cleDispo);
    if (dispo === undefined) {
      dispo = dispoRapide(index, n, ing.unite, ing.g);
      caches.dispo.set(cleDispo, dispo);
    }
    if (dispo > 0) {
      let urg = caches.urgence.get(n);
      if (urg === undefined) {
        urg = urgenceRapide(index, n, p.aujourdhui);
        caches.urgence.set(n, urg);
      }
      const poids = urg <= 2 ? 4 : urg <= 5 ? 2 : 1;
      usage += Math.min(1, dispo / ing.qte) * poids;
    }
    const manque = ing.qte - dispo;
    if (manque > 1e-9) {
      const achat = estimerAchat(p.ctxPrix, ing.nom, manque, ing.unite, ing.g);
      cout += achat.cout;
      if (achat.source === 'inconnu') inconnus += 1;
    }
  }
  return { usage, cout, inconnus };
}

// Recettes candidates : celles qui utilisent le stock + un tirage au hasard.
function choisirPool(compat, index, deja, rng, nomsNorm) {
  const libres = compat.filter((r) => !deja.has(r.id));
  if (libres.length <= POOL_MAX) return libres;
  const enStock = new Map();
  const estEnStock = (n) => {
    let v = enStock.get(n);
    if (v === undefined) {
      v = index.some((e) => memeNormalise(e.n, n));
      enStock.set(n, v);
    }
    return v;
  };
  const avecStock = [];
  const autres = [];
  for (const r of libres) {
    const utiliseStock = (nomsNorm.get(r.id) || []).some(estEnStock);
    (utiliseStock ? avecStock : autres).push(r);
  }
  melanger(avecStock, rng);
  melanger(autres, rng);
  const pool = avecStock.slice(0, Math.floor(POOL_MAX / 2));
  return pool.concat(autres.slice(0, POOL_MAX - pool.length));
}

function melanger(tab, rng) {
  for (let i = tab.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [tab[i], tab[j]] = [tab[j], tab[i]];
  }
  return tab;
}

/**
 * Construit un planning.
 * p = { recettes, profil, stock, ctxPrix, jours, personnes, budget, debut, aujourdhui,
 *       historique, favoris, aleatoire, fixes: Map(index -> recetteId), exclure: Set, mode }
 */
export function genererPlanning(p) {
  const rng = p.aleatoire || Math.random;
  const parId = new Map(p.recettes.map((r) => [r.id, r]));
  const compat = recettesCompatibles(p.recettes, p.profil).filter((r) => !(p.exclure && p.exclure.has(r.id)));
  const recents = idsRecents(p.historique, p.aujourdhui, 10);
  const favoris = new Set(p.favoris || []);
  const fixes = p.fixes || new Map();
  const nbRepas = p.jours * 2;
  const budget = Number(p.budget) > 0 ? Number(p.budget) : null;
  const moinsCher = p.mode === 'moinsCher';
  const nomsNorm = new Map(compat.map((r) => [r.id, (r.ingredients || []).map((ing) => normaliser(ing.nom))]));

  let stock = p.stock.map((it) => ({ ...it }));
  const choisis = new Set(fixes.values());
  const repas = [];
  let cout = 0;
  let depasse = false;

  for (let i = 0; i < nbRepas; i++) {
    const date = ajouterJours(p.debut, Math.floor(i / 2));
    const moment = i % 2 === 0 ? 'midi' : 'soir';
    let recette = fixes.has(i) ? parId.get(fixes.get(i)) : null;

    if (!recette) {
      const index = indexer(stock);
      const caches = { dispo: new Map(), urgence: new Map() };
      const pool = choisirPool(compat, index, choisis, rng, nomsNorm);
      const evals = pool.map((r) => {
        const e = evaluer(r, p.personnes, index, p, caches);
        let score;
        if (moinsCher) {
          score = -e.cout * 10 + e.usage + rng() * 0.5;
        } else {
          score = e.usage * 3 - e.cout - e.inconnus * 0.5 + rng() * 1.5;
          if (favoris.has(r.id)) score += 2;
          if (recents.has(r.id)) score -= 4;
          if (moment === 'midi' && (r.temps || 99) <= 30) score += 0.5;
        }
        return { r, ...e, score };
      });
      if (evals.length === 0) break;
      evals.sort((a, b) => b.score - a.score);

      let choix = evals[0];
      if (budget !== null && !moinsCher) {
        const restant = budget - cout;
        const allocation = restant > 0 ? (restant / (nbRepas - i)) * 1.6 : 0;
        choix = evals.find((e) => e.cout <= allocation + 0.01);
        if (!choix) {
          choix = evals.reduce((m, e) => (e.cout < m.cout || (e.cout === m.cout && e.score > m.score) ? e : m), evals[0]);
        }
      }
      recette = choix.r;
    }
    if (!recette) continue;

    choisis.add(recette.id);
    const res = appliquer(stock, recette, p.personnes, p, date);
    stock = res.stock;
    cout += res.cout;
    repas.push({ date, moment, recetteId: recette.id, personnes: p.personnes, fait: false });
  }

  if (budget !== null && cout > budget + 0.01) depasse = true;
  return { repas, coutEstime: cout, depasse };
}

// ---------- Liste de courses ----------

export function calculerCourses(p, repas) {
  const parId = new Map(p.recettes.map((r) => [r.id, r]));
  const totaux = new Map();
  for (const r of repas) {
    if (r.fait) continue;
    const recette = parId.get(r.recetteId);
    if (!recette) continue;
    for (const ing of besoins(recette, r.personnes)) {
      if (ing.qte <= 0 || estProduitDeBase(ing.nom, p.profil)) continue;
      const n = normaliser(ing.nom);
      let cle = n;
      let existant = totaux.get(cle);
      if (existant) {
        const q = convertir(ing.qte, ing.unite, existant.unite, ing.g || existant.g);
        if (q === null) {
          cle = `${n}|${ing.unite}`;
          existant = totaux.get(cle);
        } else {
          existant.qte += q;
          existant.g = existant.g || ing.g;
          continue;
        }
      }
      if (existant) existant.qte += ing.qte;
      else totaux.set(cle, { nom: ing.nom, qte: ing.qte, unite: ing.unite, g: ing.g });
    }
  }

  const lignes = [];
  const dejaEnStock = [];
  for (const b of totaux.values()) {
    const dispo = disponible(p.stock, b.nom, b.unite, b.g);
    let manque = b.qte - dispo;
    if (b.unite === 'piece' && manque > 0.05) manque = Math.ceil(manque - 0.05);
    if (manque <= Math.max(1e-6, b.qte * 0.02)) {
      dejaEnStock.push({ ...b, dispo });
      continue;
    }
    const achat = estimerAchat(p.ctxPrix, b.nom, manque, b.unite, b.g);
    lignes.push({ ...b, manque, rayon: rayonDe(b.nom), ...achat });
  }
  lignes.sort((a, b) => RAYONS.indexOf(a.rayon) - RAYONS.indexOf(b.rayon) || a.nom.localeCompare(b.nom, 'fr'));
  const total = lignes.reduce((s, l) => s + (l.cout || 0), 0);
  const inconnus = lignes.filter((l) => l.source === 'inconnu').length;
  return { lignes, dejaEnStock, total, inconnus };
}
