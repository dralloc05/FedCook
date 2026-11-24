// Outils sur les noms d'ingrédients : normalisation et correspondances.

const MOTS_LIAISON = new Set(['de', 'd', 'du', 'des', 'a', 'au', 'aux', 'en', 'la', 'le', 'les', 'l']);
const MOTS_VIDES = new Set(['frais', 'fraiche', 'bio', 'gros', 'grosse', 'petit', 'petite', 'moyen', 'moyenne', 'entier', 'entiere', 'nature']);

// "Crème fraîche épaisse" -> "creme fraiche epaisse" (sans accents, au singulier simple)
const memo = new Map();

export function normaliser(texte) {
  if (!texte) return '';
  const cle = String(texte);
  const connu = memo.get(cle);
  if (connu !== undefined) return connu;
  const resultat = normaliserSansMemo(cle);
  if (memo.size > 50000) memo.clear();
  memo.set(cle, resultat);
  return resultat;
}

function normaliserSansMemo(texte) {
  return String(texte)
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map(singulier)
    .join(' ');
}

function singulier(mot) {
  if (mot.length > 3 && (mot.endsWith('s') || mot.endsWith('x')) && !/^\d+$/.test(mot)) {
    return mot.slice(0, -1);
  }
  return mot;
}

export function mots(texte) {
  return normaliser(texte).split(' ').filter(Boolean);
}

// Deux noms désignent-ils le même ingrédient ?
// "oignon" = "oignon rouge", "creme fraiche" = "creme fraiche epaisse",
// mais "lait" != "lait de coco" (un mot de liaison change le produit).
export function memeIngredient(a, b) {
  return memeNormalise(normaliser(a), normaliser(b));
}

// Même chose, pour deux noms déjà normalisés (plus rapide dans les boucles).
export function memeNormalise(na, nb) {
  if (!na || !nb) return false;
  if (na === nb) return true;
  const ma = na.split(' ');
  const mb = nb.split(' ');
  const [court, long] = ma.length <= mb.length ? [ma, mb] : [mb, ma];
  const ensembleLong = new Set(long);
  if (!court.every((m) => ensembleLong.has(m))) return false;
  const ensembleCourt = new Set(court);
  const enTrop = long.filter((m) => !ensembleCourt.has(m));
  return !enTrop.some((m) => MOTS_LIAISON.has(m));
}

// Devine l'ingrédient le plus proche d'un nom de produit ("Lardons fumés Herta 2x100g" -> "lardons").
export function devinerIngredient(nomProduit, ingredientsConnus) {
  const motsProduit = new Set(mots(nomProduit).filter((m) => !MOTS_LIAISON.has(m) && !MOTS_VIDES.has(m) && !/\d/.test(m)));
  if (motsProduit.size === 0) return '';
  let meilleur = '';
  let meilleurScore = 0;
  for (const nom of ingredientsConnus) {
    const motsNom = mots(nom).filter((m) => !MOTS_LIAISON.has(m));
    if (motsNom.length === 0) continue;
    const communs = motsNom.filter((m) => motsProduit.has(m));
    if (communs.length === 0) continue;
    // Tous les mots de l'ingrédient doivent être présents pour un bon score.
    const complet = communs.length === motsNom.length;
    const score = communs.reduce((s, m) => s + m.length, 0) * (complet ? 2 : 0.5);
    if (score > meilleurScore) {
      meilleurScore = score;
      meilleur = nom;
    }
  }
  return meilleurScore >= 8 ? meilleur : '';
}

export function echapper(texte) {
  return String(texte ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function euros(montant) {
  if (montant === null || montant === undefined || Number.isNaN(montant)) return '?';
  return montant.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

export function majuscule(texte) {
  if (!texte) return '';
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}
