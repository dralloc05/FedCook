// Catalogue complet du magasin (data/prix.json au format « produits ») :
// trouve, pour un ingrédient de recette, les produits qui y correspondent.

import { normaliser } from './texte.js';

const MOTS_VIDES = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'l', 'd', 'a', 'au', 'aux', 'en', 'et', 'pour', 'avec',
  'sans', 'sur', 'un', 'une', 'type', 'environ', 'facultatif', 'gros', 'grosse', 'petit', 'petite', 'moyen', 'moyenne', 'bon', 'bonne']);

// Rayons qui ne contiennent pas d'ingrédients de cuisine.
const RAYONS_EXCLUS = ['animal', 'bebe', 'hygiene', 'beaute', 'entretien', 'droguerie', 'maison', 'bazar', 'parapharmacie',
  'papeterie', 'jardin', 'textile', 'electro', 'loisir', 'jouet', 'nettoyage', 'anti gaspi', 'sante'];

// Mots qui montrent qu'un produit n'est qu'« au goût de » l'ingrédient.
const MOTS_AROMES = new Set(['saveur', 'gout', 'arome', 'aromatise', 'parfum', 'facon']);

// Le produit est une autre forme de l'ingrédient (ail en semoule, purée de tomate, gingembre moulu…).
// Pénalisé seulement si la recette ne le demande pas elle-même.
const MOTS_TRANSFORMES = new Set(['poudre', 'moulu', 'semoule', 'deshydrate', 'lyophilise', 'seche', 'puree', 'jus', 'soupe',
  'veloute', 'chip', 'sirop', 'confiture', 'compote', 'bonbon', 'biscuit', 'gateau'].map(normaliser));

// Parfums : « lait chocolaté » n'est pas du lait.
const PARFUMS = new Set(['chocolat', 'chocolate', 'fraise', 'vanille', 'banane', 'caramel', 'cacao', 'framboise', 'peche',
  'abricot', 'cerise', 'coco', 'menthe', 'miel', 'noisette', 'pistache', 'mangue', 'ananas', 'myrtille'].map(normaliser));

// Viandes et poissons : pas de « jarret de porc » pour « jarret de bœuf ».
const VIANDES = new Set(['poulet', 'boeuf', 'porc', 'dinde', 'veau', 'agneau', 'canard', 'lapin', 'saumon', 'thon',
  'cabillaud', 'colin', 'crevette', 'merlu', 'sardine', 'maquereau'].map(normaliser));

// Familles de produits déjà cuisinés : à éviter quand on cherche un ingrédient brut.
const FAMILLES_PREPAREES = ['plat cuisine', 'traiteur', 'aperitif', 'snacking', 'pause dejeuner'];

// Noms sous lesquels le Drive vend souvent un ingrédient de recette.
const SYNONYMES = new Map([
  ['blanc de poulet', ['filet de poulet', 'escalope de poulet']],
  ['poitrine de poulet', ['filet de poulet', 'escalope de poulet']],
  ['escalope de poulet', ['filet de poulet']],
  ['viande hachée', ['steak haché', 'haché de boeuf']],
  ['boeuf haché', ['viande hachée', 'steak haché']],
  ['steak haché', ['viande hachée']],
  ['crème liquide', ['crème fluide', 'crème entière liquide']],
  ['crème fraîche', ['crème épaisse']],
  ['fromage râpé', ['emmental râpé']],
  ['frites', ['frites surgelées']],
  ['tortilla', ['wrap']],
  ['gousse d\'ail', ['ail']],
  ['huile', ['huile de tournesol']],
  ['huile végétale', ['huile de tournesol', 'huile de colza']],
  ['oignon vert', ['oignon nouveau', 'cébette', 'ciboule']],
  ['oignon nouveau', ['oignon blanc', 'cébette']],
  ['ciboule', ['cébette', 'oignon nouveau', 'ciboulette']],
  ['rumsteck', ['rumsteak', 'pavé de boeuf']],
  ['jarret de boeuf', ['boeuf à bouillir', 'pot au feu', 'boeuf bourguignon']],
].map(([k, v]) => [normaliser(k), v]));

// Viande crue : la version charcuterie (« blanc de poulet » en tranches) n'est pas la bonne.
const VIANDES_CRUES = new Set(['poulet', 'boeuf', 'porc', 'dinde', 'veau', 'agneau', 'canard', 'viande'].map(normaliser));

const LIAISONS = new Set(['de', 'd', 'a', 'au', 'aux', 'en']);

// Au-delà, un mot est trop courant pour identifier un produit à lui seul (« sauce », « bœuf »…).
const MOT_TROP_COURANT = 80;

function mots(texte) {
  return normaliser(texte).split(' ').filter((m) => m && !MOTS_VIDES.has(m));
}

const cacheIndex = new WeakMap();

/** Prépare la recherche dans le catalogue (une seule fois par fichier). */
export function indexerCatalogue(produitsBruts) {
  if (!Array.isArray(produitsBruts)) return null;
  const deja = cacheIndex.get(produitsBruts);
  if (deja) return deja;
  const produits = [];
  const parMot = new Map();
  const parMotFamille = new Map();
  const ajouterA = (carte, m, i) => {
    let liste = carte.get(m);
    if (!liste) carte.set(m, (liste = []));
    liste.push(i);
  };
  for (const p of produitsBruts) {
    if (!p || typeof p.prix !== 'number' || !(p.prix > 0) || !p.nom) continue;
    const rayon = ` ${normaliser(`${p.rayon || ''}`)} `;
    if (RAYONS_EXCLUS.some((x) => rayon.includes(` ${x}`))) continue; // début de mot : « animal » -> « animalerie »
    const motsNom = mots(p.nom);
    if (!motsNom.length) continue;
    const i = produits.length;
    const famille = normaliser(`${p.famille || ''} ${p.sousFamille || ''}`);
    const parties = [normaliser(p.famille || ''), normaliser(p.sousFamille || '')].filter(Boolean);
    produits.push({ p, motsNom, ensemble: new Set(motsNom), nomNorm: motsNom.join(' '), nomBrut: normaliser(p.nom), famille, parties, rayon: rayon.trim() });
    for (const m of new Set(motsNom)) ajouterA(parMot, m, i);
    for (const m of new Set(mots(famille))) ajouterA(parMotFamille, m, i);
  }
  const index = { produits, parMot, parMotFamille, cache: new Map() };
  cacheIndex.set(produitsBruts, index);
  return index;
}

// Contenance donnée par le catalogue (contenance + uniteContenance), en dernier recours.
function contenanceCatalogue(p) {
  const q = Number(p.contenance);
  if (!(q > 0)) return null;
  // « 1 unité » = une botte, un filet, un sachet… : on ne sait pas combien il y a dedans.
  if (q === 1 && ['U', 'PCE', 'PC', 'PIECE'].includes(String(p.uniteContenance || '').toUpperCase())) return null;
  switch (String(p.uniteContenance || '').toUpperCase()) {
    case 'GR': case 'G': return { qte: q, unite: 'g' };
    case 'KG': return { qte: q * 1000, unite: 'g' };
    case 'ML': return { qte: q, unite: 'ml' };
    case 'CL': return { qte: q * 10, unite: 'ml' };
    case 'L': return { qte: q * 1000, unite: 'ml' };
    case 'U': case 'PCE': case 'PC': case 'PIECE': return { qte: q, unite: 'piece' };
    default: return null;
  }
}

// Produit du catalogue -> format utilisé par le reste de l'appli (comme le relevé Apify).
function versProduit(p, approx) {
  return {
    id: p.id,
    nom: p.nom,
    // Le format contient la contenance (« Pêche - 6x25cl ») que l'appli sait lire.
    format: p.format || p.nomComplet || '',
    nomComplet: p.nomComplet || '',
    contenanceCatalogue: contenanceCatalogue(p),
    prix: p.prix,
    prixPromo: typeof p.prixPromo === 'number' && p.prixPromo > 0 ? p.prixPromo : null,
    prixUnite: typeof p.prixUnite === 'number' ? p.prixUnite : null,
    unite: p.unite || null,
    enStock: p.enStock !== false,
    maj: p.maj || null,
    image: p.image || null,
    approx: !!approx,
  };
}

function candidats(index, motsIng, carte = index.parMot) {
  // Intersection des listes, en partant de la plus courte.
  const listes = motsIng.map((m) => carte.get(m) || []);
  if (!listes.length || listes.some((l) => !l.length)) return [];
  listes.sort((a, b) => a.length - b.length);
  let res = new Set(listes[0]);
  for (const l of listes.slice(1)) {
    const s = new Set(l);
    res = new Set([...res].filter((i) => s.has(i)));
    if (!res.size) break;
  }
  return [...res];
}

function pertinence(e, motsIng, brut) {
  const phrase = motsIng.join(' ');
  const avec = new Set(motsIng);
  let score = 0;
  if (e.nomNorm.startsWith(phrase)) score += 4;
  else if (` ${e.nomNorm} `.includes(` ${phrase} `)) score += 2;
  else if (e.motsNom[0] === motsIng[0]) score += 2.5; // « Crevettes cuites décortiquées » pour « crevettes décortiquées »
  // L'ingrédient est la famille du produit (« Beurres », « Pâtes », « Lardons »…).
  if (motsIng.some((m) => ` ${e.famille} `.includes(` ${m} `))) score += 2;
  // Les mots en plus du nom de l'ingrédient (marque, variété) comptent peu, mais trop c'est suspect.
  score -= Math.min(3, Math.max(0, e.motsNom.length - motsIng.length - 2) * 0.4);
  const enTrop = (liste) => e.motsNom.some((m) => liste.has(m) && !avec.has(m));
  if (e.motsNom.some((m) => MOTS_AROMES.has(m)) && !motsIng.some((m) => MOTS_AROMES.has(m))) score -= 4;
  if (enTrop(MOTS_TRANSFORMES)) score -= 3;
  if (enTrop(PARFUMS)) score -= 3;
  const viandesIng = motsIng.filter((m) => VIANDES.has(m));
  const viandesProd = e.motsNom.filter((m) => VIANDES.has(m));
  if (viandesIng.length && viandesProd.length && !viandesProd.some((m) => viandesIng.includes(m))) score -= 5;
  if (FAMILLES_PREPAREES.some((f) => e.famille.includes(f))) score -= 3;
  if (motsIng.some((m) => VIANDES_CRUES.has(m)) && !motsIng.some((m) => ['jambon', 'lardon', 'bacon', 'saucisse'].includes(m))
      && /charcuterie|traiteur|jambon/.test(`${e.rayon} ${e.famille}`)) score -= 3;
  if (e.p.enStock === false) score -= 0.5;
  // « Beurre de cacahuète » pour « beurre », « lait de coco » pour « lait » : un autre produit.
  if (brut && e.nomBrut.startsWith(`${brut} `) && LIAISONS.has(e.nomBrut.slice(brut.length + 1).split(' ')[0])) score -= 2.5;
  return score;
}

/** « Steak de bœuf (rumsteck ou bavette) » -> « Steak de bœuf », « rumsteck », « bavette ». */
export function variantes(nom) {
  const texte = String(nom || '');
  const dansParentheses = [...texte.matchAll(/\(([^)]*)\)/g)].map((m) => m[1]);
  const morceaux = [texte.replace(/\([^)]*\)/g, ' '), ...dansParentheses];
  const res = [];
  for (const morceau of morceaux) {
    for (const v of morceau.split(/\s+ou\s+|,|\//)) {
      const t = v.trim();
      if (t && mots(t).length && !res.includes(t)) res.push(t);
    }
  }
  return res.length ? res : [texte];
}

/**
 * Produits du catalogue qui correspondent à un ingrédient (« beurre », « pommes de terre »…).
 * Garde les plus pertinents (au plus 5) ; l'appli choisit ensuite le moins cher au kilo parmi eux.
 * Quand aucun produit ne correspond exactement, un produit proche peut servir d'estimation : il est
 * alors marqué « approx ».
 */
export function chercherDansCatalogue(index, nomIngredient, max = 5) {
  if (!index) return [];
  const cle = normaliser(nomIngredient);
  if (!cle) return [];
  if (index.cache.has(cle)) return index.cache.get(cle);

  const formes = variantes(nomIngredient).map((v) => ({ mots: mots(v), brut: normaliser(v) })).filter((f) => f.mots.length);
  const notes = new Map();
  const noter = (indices, mIng, brut, malus, approx) => {
    for (const i of indices) {
      const e = index.produits[i];
      const score = pertinence(e, mIng, brut) - malus;
      const ancien = notes.get(i);
      if (!ancien || ancien.score < score) notes.set(i, { e, score, approx });
    }
  };

  // 1. Tous les mots de l'ingrédient (ou d'un de ses synonymes) sont dans le nom du produit.
  for (const f of formes) {
    noter(candidats(index, f.mots), f.mots, f.brut, 0, false);
    for (const syn of SYNONYMES.get(f.brut) || []) noter(candidats(index, mots(syn)), mots(syn), normaliser(syn), 0, false);
  }

  // 2. Sinon, estimation avec un produit proche : on garde le mot le plus rare de l'ingrédient
  //    (« laurier » dans « feuille de laurier », « bouillon » dans « bouillon de poisson »).
  if (!notes.size) {
    for (const f of formes) {
      const frequence = (m) => (index.parMot.get(m) || []).length;
      const utiles = f.mots.filter((m) => frequence(m) > 0 && frequence(m) <= MOT_TROP_COURANT);
      if (!utiles.length) continue;
      const rare = utiles.reduce((a, b) => (frequence(b) < frequence(a) ? b : a));
      for (const i of index.parMot.get(rare)) {
        const e = index.produits[i];
        const presents = f.mots.filter((m) => e.ensemble.has(m));
        noter([i], presents, presents.join(' '), 1 + 1.5 * (f.mots.length - presents.length), true);
      }
    }
  }

  // 3. Toujours rien : l'ingrédient est peut-être un rayon (« pâtes » -> famille « Pâtes » : spaghetti, penne…),
  //    mais pas « Pâtes à tartiner ».
  if (!notes.size) {
    for (const f of formes) {
      const exact = candidats(index, f.mots, index.parMotFamille).filter((i) =>
        index.produits[i].parties.some((part) => part === f.brut
          || (part.startsWith(`${f.brut} `) && !LIAISONS.has(part.slice(f.brut.length + 1).split(' ')[0]))));
      noter(exact, f.mots, f.brut, 1, false);
    }
  }

  const triees = [...notes.values()].sort((a, b) => b.score - a.score);
  let res = [];
  if (triees.length) {
    const meilleur = triees[0];
    // Un produit trop peu pertinent (« biscuits au beurre » pour « beurre ») est écarté ;
    // une estimation doit être franchement plausible.
    const seuil = meilleur.approx ? 0 : -2;
    if (meilleur.score > seuil) {
      res = triees.filter((n) => n.score >= meilleur.score - 1.5).slice(0, max).map((n) => versProduit(n.e.p, n.approx));
    }
  }
  index.cache.set(cle, res);
  return res;
}
