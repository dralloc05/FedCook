// Ce qui fait un « vrai repas », et quels plats sont populaires ou tendance.
// Fonctions sans effet de bord, testables hors du navigateur.

import { normaliser } from './texte.js';

// ---------- Ce qui n'est pas un repas ----------

// Minuscules, sans accents, sans ponctuation, mais en gardant les pluriels
// (« pâte à pizza » n'est pas un repas, « pâtes à la carbonara » oui).
function simplifier(texte) {
  return String(texte || '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

// Titres de préparations de base ou d'accompagnements seuls.
const DEBUTS_NON_REPAS = [
  /^pate\b/, // pâte à pizza, pâte brisée, pâte à crêpes… (et pâté)
  /^(sauce|sauces|vinaigrette|marinade|bouillon|fumet|glacage|coulis|mayonnaise|aioli|pesto|ketchup|chapelure|garniture|assaisonnement|roux|confiture|gelee|sirop|caramel|ganache|levain|pickles?|condiment|condiments|tapenade|houmous|hummus|guacamole|salsa|tzatziki|croutons?|meringue|chantilly|vinaigre|huile|epices?|melange|base|beurre aromatise|beurre compose|beurre clarifie)\b/,
  /^creme (patissiere|anglaise|fouettee|chantilly)\b/,
  /^fond (blanc|brun|de volaille|de veau|de sauce)\b/,
  /^pains? (de mie|maison|blanc|complet|naan|pita|burger|a burger|hamburger|a hamburger|hot dog|brioche|au levain|de campagne|sans gluten|aux cereales|plat|pour)\b/,
  /^(brioche|focaccia|naan|pita|baguette|bagels?|muffins anglais)\b/,
  /^(tortillas?|galettes?|wraps?) (de ble|de mais|maison|a la farine|de farine)\b/,
];

// Accompagnements quand le titre ne dit rien d'autre (« Riz basmati », « Purée maison »).
const ACCOMPAGNEMENTS_SEULS = [
  /^puree( de (pommes? de terre|patates? douces?|carottes?|celeri|potiron|legumes|brocolis?|pois|panais))?( maison| cremeuse| onctueuse| facile| rapide)?$/,
  /^riz( blanc| basmati| thai| pilaf| nature| parfume| cuit| a la vapeur| au cumin| jaune| gluant| complet)*( parfait| simple| maison| facile| rapide)?$/,
  /^(semoule|quinoa|boulgour|ble|lentilles|pois chiches)( nature| cuite?s?| simple| maison)?$/,
  /^(frites?|potatoes|chips)( maison| croustillantes?| faciles?| au four| a l airfryer)?$/,
  /^(haricots verts|legumes (rotis|vapeur|sautes|grilles)|salade verte|pommes de terre (sautees|rissolees|roties|au four|vapeur|grenaille))( maison| faciles?| croustillantes?)?$/,
];

// Si une recette n'a que ces ingrédients, c'est une pâte ou une pâte à crêpes, pas un repas.
const INGREDIENTS_DE_PATE = new Set([
  'farine', 'farine de ble', 'eau', 'levure', 'levure boulangere', 'levure de boulanger', 'levure chimique',
  'levure seche', 'sel', 'sucre', 'huile', 'huile d olive', 'beurre', 'oeuf', 'lait', 'semoule', 'maizena',
  'fécule de maïs', 'sucre vanillé', 'eau tiède',
].map(normaliser));

export function estUnRepas(recette) {
  if (!recette) return false;
  const titre = simplifier(recette.titre);
  if (DEBUTS_NON_REPAS.some((re) => re.test(titre))) return false;
  if (ACCOMPAGNEMENTS_SEULS.some((re) => re.test(titre))) return false;
  const ingredients = (recette.ingredients || []).map((i) => normaliser(i.nom)).filter(Boolean);
  if (ingredients.length < 3) return false;
  if (ingredients.every((n) => INGREDIENTS_DE_PATE.has(n))) return false;
  return true;
}

// ---------- Plats populaires et tendance ----------

// Familles de plats, de la plus précise à la plus large : la première qui correspond gagne.
// poids : 1 = incontournable, 0.5 = classique moins demandé. Les mots sont comparés
// au titre « normalisé » (sans accents, au singulier).
export const FAMILLES = [
  ['french-tacos', 1, ['french taco', 'taco francai', 'o taco', 'tacos lyonnai']],
  ['smash-burger', 1, ['smash burger', 'smashburger']],
  ['burger', 1, ['burger', 'hamburger', 'cheeseburger', 'bacon burger']],
  ['kebab', 0.95, ['kebab', 'doner', 'gyro', 'shawarma', 'chawarma', 'souvlaki']],
  ['carbonara', 1, ['carbonara']],
  ['bolognaise', 1, ['bolognaise', 'bolognese']],
  ['lasagne', 1, ['lasagne']],
  ['pates-feta', 0.9, ['pate a la feta', 'feta au four', 'pate feta']],
  ['pizza', 0.9, ['pizza', 'calzone']],
  ['birria', 0.85, ['birria']],
  ['burrito', 0.85, ['burrito']],
  ['fajitas', 0.85, ['fajita']],
  ['quesadilla', 0.8, ['quesadilla']],
  ['enchiladas', 0.75, ['enchilada']],
  ['nachos', 0.7, ['nacho']],
  ['tacos', 0.85, ['taco']],
  ['chili', 0.9, ['chili con carne', 'chili sin carne', 'chili']],
  ['butter-chicken', 0.95, ['butter chicken', 'poulet au beurre', 'tikka masala', 'tikka']],
  ['curry', 0.85, ['curry', 'korma', 'massaman', 'vindaloo']],
  ['dahl', 0.6, ['dahl', 'dal', 'dhal']],
  ['poke', 0.85, ['poke', 'poke bowl', 'bibimbap', 'buddha bowl', 'bowl']],
  ['ramen', 0.85, ['ramen', 'udon', 'pho']],
  ['wok', 0.85, ['wok', 'nouille saute', 'nouille chinoise', 'pad thai', 'yakisoba', 'chow mein', 'lo mein', 'riz cantonai', 'riz frit', 'riz saute', 'nasi goreng']],
  ['poulet-asiatique', 0.8, ['general tso', 'teriyaki', 'poulet aigre doux', 'aigre doux', 'katsu', 'tonkatsu', 'karaage', 'poulet coreen', 'gochujang']],
  ['bao-gyoza', 0.7, ['bao', 'gyoza', 'dumpling', 'nem', 'rouleau de printemp']],
  ['sushi', 0.6, ['sushi', 'maki', 'california roll']],
  ['nuggets', 0.85, ['nugget', 'tender', 'poulet croustillant', 'poulet frit', 'poulet pane', 'fried chicken', 'pop corn chicken', 'popcorn chicken', 'wing']],
  ['cordon-bleu', 0.8, ['cordon bleu', 'escalope milanaise', 'escalope panee', 'schnitzel']],
  ['croque', 0.8, ['croque monsieur', 'croque madame', 'croque']],
  ['hot-dog', 0.7, ['hot dog', 'hotdog']],
  ['wrap', 0.7, ['wrap', 'panini', 'sandwich', 'club sandwich', 'bagel']],
  ['hachis', 0.95, ['hachi parmentier', 'parmentier', 'shepherd pie', 'cottage pie']],
  ['tartiflette', 0.9, ['tartiflette', 'croziflette', 'raclette', 'reblochonnade', 'fondue savoyarde', 'fondue au fromage']],
  ['gratin-pates', 0.85, ['gratin de pate', 'mac and cheese', 'mac n cheese', 'macaroni au fromage', 'macaroni cheese', 'coquillette jambon']],
  ['gratin', 0.75, ['gratin dauphinoi', 'gratin']],
  ['risotto', 0.8, ['risotto']],
  ['gnocchi', 0.8, ['gnocchi']],
  ['one-pot', 0.75, ['one pot']],
  ['paella', 0.8, ['paella', 'jambalaya']],
  ['couscous', 0.85, ['couscou']],
  ['tajine', 0.75, ['tajine', 'tagine']],
  ['mafe-yassa', 0.7, ['mafe', 'yassa', 'thieboudienne']],
  ['quiche', 0.8, ['quiche', 'tarte salee', 'tarte au thon', 'tarte a la tomate', 'tarte aux poireaux']],
  ['galette', 0.7, ['galette complete', 'galette de sarrasin', 'crepe salee', 'crepe jambon']],
  ['steak', 0.85, ['steak', 'entrecote', 'bavette', 'cote de boeuf', 'onglet']],
  ['poulet-roti', 0.85, ['poulet roti', 'poulet au four', 'cuisse de poulet', 'pilon']],
  ['poulet-plat', 0.75, ['poulet basquaise', 'poulet a la creme', 'poulet moutarde', 'poulet au citron', 'poulet marengo', 'poulet vallee d auge', 'poulet']],
  ['bourguignon', 0.8, ['boeuf bourguignon', 'bourguignon', 'daube', 'carbonnade', 'boeuf carotte']],
  ['blanquette', 0.8, ['blanquette']],
  ['pot-au-feu', 0.65, ['pot au feu', 'potee', 'choucroute', 'cassoulet']],
  ['saucisse', 0.7, ['saucisse', 'merguez', 'chipolata', 'rougail']],
  ['boulettes', 0.8, ['boulette', 'kefta', 'kofta', 'polpette', 'meatball']],
  ['moussaka', 0.7, ['moussaka', 'aubergine farcie', 'tomate farcie', 'legume farci', 'courgette farcie']],
  ['saumon', 0.75, ['saumon']],
  ['poisson', 0.6, ['fish and chip', 'cabillaud', 'colin', 'crevette', 'moule', 'thon']],
  ['shakshuka', 0.7, ['shakshuka', 'chakchouka', 'oeuf cocotte', 'oeufs brouille']],
  ['omelette', 0.6, ['omelette', 'frittata', 'tortilla espagnole']],
  ['falafel', 0.7, ['falafel']],
  ['salade-repas', 0.6, ['salade cesar', 'salade nicoise', 'salade de pate', 'salade de riz', 'taboule']],
  ['pates', 0.65, ['pate', 'spaghetti', 'tagliatelle', 'penne', 'fusilli', 'linguine', 'macaroni', 'ravioli', 'tortellini']],
  ['soupe', 0.4, ['soupe', 'veloute', 'potage', 'minestrone']],
];

const FAMILLES_NORMALISEES = FAMILLES.map(([id, poids, mots]) => [id, poids, mots.map((m) => ` ${normaliser(m)} `)]);

/** Famille de plat reconnue dans le titre : { id, poids } ou null. */
export function familleDe(recette) {
  const titre = ` ${normaliser(recette?.titre || '')} `;
  for (const [id, poids, mots] of FAMILLES_NORMALISEES) {
    if (mots.some((m) => titre.includes(m))) return { id, poids };
  }
  return null;
}

// Ingrédients les plus utilisés dans toutes les recettes : un plat fait d'ingrédients
// courants est plus « classique » (et plus facile à trouver au Leclerc) qu'un plat exotique.
const cacheCourants = new WeakMap();

function ingredientsCourants(recettes, combien = 250) {
  let courants = cacheCourants.get(recettes);
  if (courants) return courants;
  const compte = new Map();
  for (const r of recettes) {
    for (const ing of r.ingredients || []) {
      const n = normaliser(ing.nom);
      if (n) compte.set(n, (compte.get(n) || 0) + 1);
    }
  }
  courants = new Set([...compte.entries()].sort((a, b) => b[1] - a[1]).slice(0, combien).map(([n]) => n));
  cacheCourants.set(recettes, courants);
  return courants;
}

const cachePopularite = new WeakMap();

/**
 * Popularité de chaque recette, entre 0 et 1, et sa famille.
 * 65 % : la famille du plat (populaire ou tendance) ; 35 % : la part d'ingrédients courants.
 * Renvoie une Map id -> { score, famille, tendance }.
 */
export function popularites(recettes) {
  let res = cachePopularite.get(recettes);
  if (res) return res;
  const courants = ingredientsCourants(recettes);
  res = new Map();
  for (const r of recettes) {
    const famille = familleDe(r);
    const ings = (r.ingredients || []).map((i) => normaliser(i.nom)).filter(Boolean);
    const partCourants = ings.length ? ings.filter((n) => courants.has(n)).length / ings.length : 0;
    // Les recettes ajoutées à la main sont celles qu'on a voulues : petit bonus.
    const bonus = r.source === 'maison' ? 0.1 : 0;
    const score = Math.min(1, 0.65 * (famille ? famille.poids : 0) + 0.35 * partCourants + bonus);
    res.set(r.id, { score, famille: famille ? famille.id : null, tendance: !!famille && famille.poids >= 0.85 });
  }
  cachePopularite.set(recettes, res);
  return res;
}
