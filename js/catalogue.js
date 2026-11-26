// Catalogue complet du magasin (data/prix.json au format « produits ») :
// trouve, pour un ingrédient de recette, les produits qui y correspondent.

import { normaliser } from './texte.js';

const MOTS_VIDES = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'l', 'd', 'a', 'au', 'aux', 'en', 'et', 'pour', 'avec', 'sans', 'sur', 'un', 'une']);

// Rayons qui ne contiennent pas d'ingrédients de cuisine.
const RAYONS_EXCLUS = ['animal', 'bebe', 'hygiene', 'beaute', 'entretien', 'droguerie', 'maison', 'bazar', 'parapharmacie',
  'papeterie', 'jardin', 'textile', 'electro', 'loisir', 'jouet', 'nettoyage', 'anti gaspi', 'sante'];

// Mots qui montrent qu'un produit n'est qu'« au goût de » l'ingrédient.
const MOTS_AROMES = new Set(['saveur', 'gout', 'arome', 'aromatise', 'parfum', 'facon']);

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
].map(([k, v]) => [normaliser(k), v]));

// Viande crue : la version charcuterie (« blanc de poulet » en tranches) n'est pas la bonne.
const VIANDES_CRUES = new Set(['poulet', 'boeuf', 'porc', 'dinde', 'veau', 'agneau', 'canard', 'viande'].map(normaliser));

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
    produits.push({ p, motsNom, nomNorm: motsNom.join(' '), nomBrut: normaliser(p.nom), famille, parties, rayon: rayon.trim() });
    for (const m of new Set(motsNom)) ajouterA(parMot, m, i);
    for (const m of new Set(mots(famille))) ajouterA(parMotFamille, m, i);
  }
  const index = { produits, parMot, parMotFamille, cache: new Map() };
  cacheIndex.set(produitsBruts, index);
  return index;
}

// Produit du catalogue -> format utilisé par le reste de l'appli (comme le relevé Apify).
function versProduit(p) {
  return {
    id: p.id,
    nom: p.nom,
    // Le format contient la contenance (« Pêche - 6x25cl ») que l'appli sait lire.
    format: p.format || p.nomComplet || '',
    prix: p.prix,
    prixPromo: typeof p.prixPromo === 'number' && p.prixPromo > 0 ? p.prixPromo : null,
    prixUnite: typeof p.prixUnite === 'number' ? p.prixUnite : null,
    unite: p.unite || null,
    enStock: p.enStock !== false,
    maj: p.maj || null,
    image: p.image || null,
  };
}

function candidats(index, motsIng, carte = index.parMot) {
  // Intersection des listes, en partant de la plus courte.
  const listes = motsIng.map((m) => carte.get(m) || []);
  if (listes.some((l) => !l.length)) return [];
  listes.sort((a, b) => a.length - b.length);
  let res = new Set(listes[0]);
  for (const l of listes.slice(1)) {
    const s = new Set(l);
    res = new Set([...res].filter((i) => s.has(i)));
    if (!res.size) break;
  }
  return [...res];
}

const LIAISONS = new Set(['de', 'd', 'a', 'au', 'aux', 'en']);

function pertinence(e, motsIng, phrase, brut) {
  let score = 0;
  if (e.nomNorm.startsWith(phrase)) score += 4;
  else if (` ${e.nomNorm} `.includes(` ${phrase} `)) score += 2;
  // L'ingrédient est la famille du produit (« Beurres », « Pâtes », « Lardons »…).
  if (motsIng.some((m) => ` ${e.famille} `.includes(` ${m} `))) score += 2;
  // Les mots en plus du nom de l'ingrédient (marque, variété) comptent peu, mais trop c'est suspect.
  score -= Math.min(3, Math.max(0, e.motsNom.length - motsIng.length - 2) * 0.4);
  if (e.motsNom.some((m) => MOTS_AROMES.has(m)) && !motsIng.some((m) => MOTS_AROMES.has(m))) score -= 4;
  if (FAMILLES_PREPAREES.some((f) => e.famille.includes(f))) score -= 3;
  if (motsIng.some((m) => VIANDES_CRUES.has(m)) && !motsIng.some((m) => ['jambon', 'lardon', 'bacon', 'saucisse'].includes(m))
      && /charcuterie|traiteur|jambon/.test(`${e.rayon} ${e.famille}`)) score -= 3;
  if (e.p.enStock === false) score -= 1;
  // « Beurre de cacahuète » pour « beurre », « lait de coco » pour « lait » : un autre produit.
  if (e.nomBrut.startsWith(`${brut} `) && LIAISONS.has(e.nomBrut.slice(brut.length + 1).split(' ')[0])) score -= 2.5;
  return score;
}

/**
 * Produits du catalogue qui correspondent à un ingrédient (« beurre », « pommes de terre »…).
 * Garde les plus pertinents (au plus 5) ; l'appli choisit ensuite le moins cher au kilo parmi eux.
 */
export function chercherDansCatalogue(index, nomIngredient, max = 5) {
  if (!index) return [];
  const motsIng = mots(nomIngredient);
  if (!motsIng.length) return [];
  const brut = normaliser(nomIngredient);
  const cle = motsIng.join(' ');
  if (index.cache.has(cle)) return index.cache.get(cle);

  // Meilleure note de chaque produit, toutes recherches confondues.
  const notes = new Map();
  const noter = (indices, mIng, b, malus) => {
    for (const i of indices) {
      const e = index.produits[i];
      const score = pertinence(e, mIng, mIng.join(' '), b) - malus;
      if (!notes.has(i) || notes.get(i).score < score) notes.set(i, { e, score });
    }
  };

  noter(candidats(index, motsIng), motsIng, brut, 0);
  for (const syn of SYNONYMES.get(brut) || []) {
    const m = mots(syn);
    noter(candidats(index, m), m, normaliser(syn), 0);
  }
  // Rien avec tous les mots : on tolère qu'il en manque un (« poitrine de porc fumée » -> « poitrine fumée »).
  if (!notes.size && motsIng.length >= 2) {
    for (let k = 0; k < motsIng.length; k++) {
      noter(candidats(index, motsIng.filter((_, j) => j !== k)), motsIng, brut, 2);
    }
  }
  // Toujours rien : l'ingrédient est peut-être un rayon (« pâtes » -> famille « Pâtes » : spaghetti, penne…),
  // mais pas « Pâtes à tartiner ».
  if (!notes.size) {
    const rayonExact = candidats(index, motsIng, index.parMotFamille).filter((i) =>
      index.produits[i].parties.some((part) => part === brut
        || (part.startsWith(`${brut} `) && !LIAISONS.has(part.slice(brut.length + 1).split(' ')[0]))));
    noter(rayonExact, motsIng, brut, 1);
  }

  const triees = [...notes.values()].sort((a, b) => b.score - a.score);
  let res = [];
  // Un produit trop peu pertinent (ex. « biscuits au beurre » pour « beurre ») est écarté.
  if (triees.length && triees[0].score > -2) {
    const meilleur = triees[0].score;
    res = triees.filter((n) => n.score >= meilleur - 1.5).slice(0, max).map((n) => versProduit(n.e.p));
  }
  index.cache.set(cle, res);
  return res;
}
