// Tests de la logique (sans navigateur) : node tests/tests.js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normaliser, memeIngredient, devinerIngredient } from '../js/texte.js';
import { parserFormat, convertir, ajouterJours, joursEntre } from '../js/unites.js';
import { rayonDe, dureeConservation } from '../js/peremption.js';
import { creerContextePrix, estimerAchat, contenance } from '../js/prix.js';
import { retirer, disponible } from '../js/stock.js';
import { genererPlanning, calculerCourses, recettesCompatibles, besoins } from '../js/planning.js';

let ok = 0;
function test(nom, fn) {
  try { fn(); ok++; console.log('  ok  ', nom); }
  catch (e) { console.log('  ÉCHEC', nom); console.log(e); process.exitCode = 1; }
}

test('normaliser', () => {
  assert.equal(normaliser('Crème fraîche épaisse'), 'creme fraiche epaisse');
  assert.equal(normaliser('Œufs'), 'oeuf');
  assert.equal(normaliser('Tomates concassées'), 'tomate concassee');
});
test('memeIngredient', () => {
  assert.ok(memeIngredient('oignon', 'Oignons rouges'));
  assert.ok(memeIngredient('crème fraîche', 'crème fraîche épaisse'));
  assert.ok(!memeIngredient('lait', 'lait de coco'));
  assert.ok(!memeIngredient('huile', "huile d'olive"));
  assert.ok(memeIngredient('oeuf', 'œufs'));
});
test('devinerIngredient', () => {
  const connus = ['lardons', 'oeuf', 'lait', 'lait de coco', 'crème fraîche', 'pâtes'];
  assert.equal(devinerIngredient('Lardons fumés Herta 2x100g', connus), 'lardons');
  assert.equal(devinerIngredient('Lait de coco Bio 400ml', connus), 'lait de coco');
});
test('parserFormat', () => {
  assert.deepEqual(parserFormat('Lardons fumés 2x100g'), { qte: 200, unite: 'g' });
  assert.deepEqual(parserFormat('Lait demi-écrémé 1L'), { qte: 1000, unite: 'ml' });
  assert.deepEqual(parserFormat('Crème 20 cl'), { qte: 200, unite: 'ml' });
  assert.deepEqual(parserFormat('Oeufs plein air x12'), { qte: 12, unite: 'piece' });
  assert.deepEqual(parserFormat('Pâtes 500 g'), { qte: 500, unite: 'g' });
  assert.deepEqual(parserFormat('Pommes de terre 2,5kg'), { qte: 2500, unite: 'g' });
});
test('convertir', () => {
  assert.equal(convertir(2, 'piece', 'g', 60), 120);
  assert.equal(convertir(100, 'ml', 'g'), 100);
  assert.equal(convertir(2, 'piece', 'g'), null);
});
test('dates', () => {
  assert.equal(ajouterJours('2026-11-30', 2), '2026-12-02');
  assert.equal(joursEntre('2026-11-24', '2026-12-01'), 7);
});
test('rayons', () => {
  assert.equal(rayonDe('lait de coco'), 'Épicerie');
  assert.equal(rayonDe('lait'), 'Crèmerie et œufs');
  assert.equal(rayonDe('pommes de terre'), 'Fruits et légumes');
  assert.equal(rayonDe('lardons'), 'Viandes et poissons');
  assert.equal(dureeConservation('viande hachée de bœuf'), 1);
});

const prixData = {
  maj: '2026-11-24', magasin: { id: '000000', nom: 'Test' },
  ingredients: {
    'lardons': [
      { id: 'a', nom: 'Lardons fumés', format: '2x100g', prix: 2.5, prixUnite: 12.5, unite: 'kg', enStock: true },
      { id: 'b', nom: 'Lardons nature', format: '400g', prix: 4.0, prixUnite: 10, unite: 'kg', enStock: true },
    ],
    'oeuf': [{ id: 'c', nom: 'Oeufs plein air x12', format: 'x12', prix: 3.6, enStock: true }],
    'pâtes': [{ id: 'd', nom: 'Spaghetti 1kg', format: '1kg', prix: 1.2, enStock: true }],
    'parmesan': [{ id: 'e', nom: 'Parmesan râpé', format: '', prix: 3, prixUnite: 30, unite: 'kg', enStock: true }],
  },
};

test('prix : contenance et choix du moins cher au kilo', () => {
  assert.deepEqual(contenance(prixData.ingredients.parmesan[0]), { qte: 100, unite: 'g' });
  const ctx = creerContextePrix(prixData);
  const achat = estimerAchat(ctx, 'lardons', 150, 'g');
  assert.equal(achat.produit.id, 'b');
  assert.equal(achat.paquets, 1);
  assert.equal(achat.cout, 4.0);
  const oeufs = estimerAchat(ctx, 'oeuf', 2, 'piece', 60);
  assert.equal(oeufs.cout, 3.6);
  const choix = creerContextePrix(prixData, { lardon: 'a' });
  assert.equal(estimerAchat(choix, 'lardons', 150, 'g').cout, 2.5);
});
test('prix : ticket quand pas de Drive', () => {
  const ctx = creerContextePrix({ ingredients: {} }, {}, { tomate: { prixParUnite: 0.003, unite: 'g' } });
  const a = estimerAchat(ctx, 'tomates', 2, 'piece', 120);
  assert.equal(a.source, 'ticket');
  assert.ok(Math.abs(a.cout - 0.72) < 1e-9);
});
test('stock : retirer en commençant par la date la plus proche', () => {
  const stock = [
    { id: 1, nom: 'Oeufs', ingredient: 'oeuf', qte: 6, unite: 'piece', peremption: '2026-12-10' },
    { id: 2, nom: 'Oeufs', ingredient: 'oeuf', qte: 2, unite: 'piece', peremption: '2026-11-26' },
  ];
  const r = retirer(stock, 'oeuf', 3, 'piece');
  assert.equal(r.manque, 0);
  assert.equal(r.stock.length, 1);
  assert.equal(r.stock[0].qte, 5);
  assert.equal(disponible(stock, 'œufs', 'piece'), 8);
});

const recettes = JSON.parse(readFileSync(new URL('../data/recettes.json', import.meta.url)));
const profil = { restrictions: [], materiel: ['plaques', 'four', 'mixeur'], base: ['sel', 'poivre', 'huile', "huile d'olive"], detestes: [], allergies: [] };

test('recettes d\'exemple valides', () => {
  const ids = new Set();
  for (const r of recettes) {
    assert.ok(r.id && !ids.has(r.id)); ids.add(r.id);
    assert.ok(r.titre && r.portions > 0 && r.ingredients.length && r.etapes.length);
    for (const i of r.ingredients) assert.ok(['g', 'ml', 'piece'].includes(i.unite), r.id + ' ' + i.nom);
  }
});
test('compatibilité : végétarien et matériel', () => {
  const vege = recettesCompatibles(recettes, { ...profil, restrictions: ['vegetarien'] });
  assert.ok(vege.length >= 8);
  assert.ok(vege.every((r) => r.regimes.includes('vegetarien')));
  const sansFour = recettesCompatibles(recettes, { ...profil, materiel: ['plaques'] });
  assert.ok(sansFour.every((r) => !r.materiel.includes('four')));
  const sansChampi = recettesCompatibles(recettes, { ...profil, detestes: ['champignons'] });
  assert.ok(sansChampi.every((r) => !r.ingredients.some((i) => normaliser(i.nom).includes('champignon'))));
});

function rngFixe(graine) {
  let s = graine;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

test('planning : 7 jours, midi et soir, sans doublon, utilise ce qui périme', () => {
  const stock = [{ id: 's1', nom: 'Lardons', ingredient: 'lardons', qte: 200, unite: 'g', peremption: '2026-11-25' }];
  const ctxPrix = creerContextePrix(prixData);
  const res = genererPlanning({
    recettes, profil, stock, ctxPrix, jours: 7, personnes: 2, budget: 0,
    debut: '2026-11-24', aujourdhui: '2026-11-24', historique: { plats: [] }, favoris: [], aleatoire: rngFixe(7),
  });
  assert.equal(res.repas.length, 14);
  assert.equal(new Set(res.repas.map((r) => r.recetteId)).size, 14);
  const premiers = res.repas.slice(0, 2).map((r) => recettes.find((x) => x.id === r.recetteId));
  assert.ok(premiers.some((r) => r.ingredients.some((i) => normaliser(i.nom) === 'lardon')), 'les lardons qui périment demain sont utilisés tout de suite');
  const courses = calculerCourses({ recettes, profil, stock, ctxPrix }, res.repas);
  assert.ok(courses.lignes.length > 5);
  assert.ok(!courses.lignes.some((l) => normaliser(l.nom) === 'sel'));
});
test('planning : budget respecté quand c\'est possible', () => {
  const ctxPrix = creerContextePrix(prixData);
  const res = genererPlanning({
    recettes: recettes.filter((r) => ['ex01', 'ex04', 'ex19', 'ex07'].includes(r.id)),
    profil, stock: [], ctxPrix, jours: 1, personnes: 2, budget: 10,
    debut: '2026-11-24', aujourdhui: '2026-11-24', historique: { plats: [] }, favoris: [], aleatoire: rngFixe(3),
  });
  assert.equal(res.repas.length, 2);
});
test('planning : performance avec 15 000 recettes', () => {
  const grosses = [];
  for (let i = 0; i < 15000; i++) {
    const base = recettes[i % recettes.length];
    grosses.push({ ...base, id: `g${i}`, ingredients: base.ingredients.map((ing, k) => (k === 0 ? { ...ing, nom: `${ing.nom} ${i % 400}` } : ing)) });
  }
  const stock = [{ id: 's1', nom: 'Lardons', ingredient: 'lardons', qte: 200, unite: 'g', peremption: '2026-11-25' }];
  const t0 = Date.now();
  const res = genererPlanning({
    recettes: grosses, profil, stock, ctxPrix: creerContextePrix(prixData), jours: 7, personnes: 2, budget: 60,
    debut: '2026-11-24', aujourdhui: '2026-11-24', historique: { plats: [] }, favoris: [], aleatoire: rngFixe(11),
  });
  const ms = Date.now() - t0;
  console.log(`        (15 000 recettes : ${ms} ms)`);
  assert.equal(res.repas.length, 14);
  assert.ok(ms < 8000);
});

import { estUnRepas, familleDe, popularites } from '../js/popularite.js';
import { indexerCatalogue, chercherDansCatalogue } from '../js/catalogue.js';

const maison = JSON.parse(readFileSync(new URL('../data/recettes-maison.json', import.meta.url)));

test('recettes maison : French tacos valides et compatibles', () => {
  assert.ok(maison.length >= 3);
  for (const r of maison) {
    assert.ok(r.id.startsWith('maison-') && r.titre && r.portions > 0 && r.etapes.length >= 5);
    for (const i of r.ingredients) assert.ok(['g', 'ml', 'piece'].includes(i.unite), r.id + ' ' + i.nom);
    assert.ok(estUnRepas(r), r.titre);
    assert.equal(familleDe(r).id, 'french-tacos');
  }
  assert.equal(recettesCompatibles(maison, profil).length, maison.length);
  assert.equal(recettesCompatibles(maison, { ...profil, materiel: ['plaques'] }).length, 0, 'il faut un four pour les frites');
});

test('pas de « pâte à pizza » ni de sauce seule dans le planning', () => {
  const ing = (...n) => n.map((x) => ({ nom: x, qte: 100, unite: 'g' }));
  const nonRepas = [
    ['Pâte à pizza', ing('farine', 'eau', 'levure', 'sel', "huile d'olive")],
    ['Pâte à pizza express', ing('farine', 'eau', 'levure chimique', 'sel')],
    ['Sauce tomate maison', ing('tomate', 'oignon', 'ail', "huile d'olive")],
    ['Riz basmati', ing('riz basmati', 'eau', 'sel')],
    ['Purée maison', ing('pommes de terre', 'lait', 'beurre', 'sel')],
    ['Crêpes', ing('farine', 'oeuf', 'lait', 'sucre')],
  ];
  for (const [titre, ingredients] of nonRepas) assert.ok(!estUnRepas({ titre, ingredients }), titre);
  for (const r of recettes) assert.ok(estUnRepas(r), r.titre);
  // Même avec plein de farine qui périme, la pâte à pizza n'est jamais proposée.
  const avecPate = recettes.concat(nonRepas.map(([titre, ingredients], k) => ({
    id: `nr${k}`, titre, type: 'plat', portions: 2, temps: 10, regimes: ['vegetarien', 'vegan', 'sans_porc', 'sans_lactose'], materiel: [], ingredients, etapes: [{ texte: '…' }],
  })));
  const stock = [{ id: 'f', nom: 'Farine', ingredient: 'farine', qte: 2000, unite: 'g', peremption: '2026-11-25' }];
  const res = genererPlanning({
    recettes: avecPate, profil: { ...profil, base: [] }, stock, ctxPrix: creerContextePrix(prixData), jours: 7, personnes: 2, budget: 0,
    debut: '2026-11-24', aujourdhui: '2026-11-24', historique: { plats: [] }, favoris: [], aleatoire: rngFixe(5),
  });
  assert.ok(res.repas.every((r) => !r.recetteId.startsWith('nr')));
});

test('popularité : plats tendance devant, variété des familles', () => {
  assert.equal(familleDe({ titre: 'French Tacos poulet' }).id, 'french-tacos');
  assert.equal(familleDe({ titre: 'Smash burger maison' }).id, 'smash-burger');
  assert.equal(familleDe({ titre: 'Ragoût de panais au topinambour' }), null);
  // 30 recettes d'exemple + tacos + 400 plats obscurs : avec un gros budget, les plats connus doivent dominer.
  const obscurs = [];
  for (let i = 0; i < 400; i++) {
    obscurs.push({ id: `o${i}`, titre: `Ragoût de panais n°${i}`, type: 'plat', portions: 2, temps: 30, regimes: ['vegetarien', 'vegan', 'sans_porc', 'sans_lactose', 'sans_gluten'], materiel: ['plaques'],
      ingredients: [{ nom: `panais ${i}`, qte: 300, unite: 'g' }, { nom: `topinambour ${i % 50}`, qte: 200, unite: 'g' }, { nom: 'oignon', qte: 1, unite: 'piece', g: 100 }], etapes: [{ texte: '…' }] });
  }
  const toutes = maison.concat(recettes, obscurs);
  const pop = popularites(toutes);
  assert.ok(pop.get('maison-french-tacos-poulet').score > pop.get('o1').score + 0.4);
  const res = genererPlanning({
    recettes: toutes, profil, stock: [], ctxPrix: creerContextePrix(prixData), jours: 7, personnes: 2, budget: 200,
    debut: '2026-11-24', aujourdhui: '2026-11-24', historique: { plats: [] }, favoris: [], aleatoire: rngFixe(9),
  });
  const obscursChoisis = res.repas.filter((r) => r.recetteId.startsWith('o')).length;
  assert.ok(obscursChoisis <= 2, `${obscursChoisis} plats obscurs sur 14`);
  const familles = res.repas.map((r) => pop.get(r.recetteId).famille).filter(Boolean);
  const tacos = familles.filter((f) => f === 'french-tacos').length;
  assert.ok(tacos <= 1, 'pas trois French tacos dans la même semaine');
});

test('catalogue complet : bon produit pour chaque ingrédient', () => {
  let id = 1;
  const P = (nom, complet, prix, prixUnite, unite, rayon, famille, sousFamille) =>
    ({ id: id++, nom, nomComplet: complet, prix, prixPromo: null, prixUnite, unite, enStock: true, rayon, famille, sousFamille });
  const produits = [
    P('Beurre doux Eco+', 'Beurre doux Eco+ - 250g', 1.99, 7.96, 'kg', 'Crèmerie', 'Beurres et Margarines', 'Beurres doux'),
    P('Beurre de cacahuète', 'Beurre de cacahuète - 350g', 2.2, 6.29, 'kg', 'Épicerie sucrée', 'Pâtes à tartiner', 'Beurres de cacahuète'),
    P('Biscuits petit beurre', 'Biscuits petit beurre - 200g', 1.5, 7.5, 'kg', 'Épicerie sucrée', 'Biscuits', 'Biscuits secs'),
    P('Blanc de poulet', 'Blanc de poulet x4 tranches - 160g', 1.9, 11.88, 'kg', 'Charcuterie Traiteur', 'Charcuteries', 'Jambons et blancs de volaille'),
    P('Filet de poulet', 'Filet de poulet - 300g', 4.5, 15, 'kg', 'Boucherie Volaille', 'Volailles', 'Poulet'),
    P('Spaghetti Barilla', 'Spaghetti Barilla - 500g', 1.29, 2.58, 'kg', 'Épicerie salée', 'Pâtes', 'Spaghetti'),
    P('Pâtée chien au poulet', 'Pâtée chien au poulet - 400g', 0.9, 2.25, 'kg', 'Animalerie', 'Chiens', 'Pâtées'),
    P('Bière blonde Heineken', 'Bière blonde Heineken 12x25cl', 7.47, 2.49, 'l', 'Boissons', 'Bières et Cidres', 'Bières blondes'),
  ];
  const idx = indexerCatalogue(produits);
  const noms = (ing) => chercherDansCatalogue(idx, ing).map((p) => p.nom);
  assert.deepEqual(noms('beurre'), ['Beurre doux Eco+']);
  assert.deepEqual(noms('blanc de poulet'), ['Filet de poulet']);
  assert.deepEqual(noms('poulet'), ['Filet de poulet']);
  assert.deepEqual(noms('pâtes'), ['Spaghetti Barilla']);
  const ctx = creerContextePrix({ maj: '2026-11-26', produits });
  const achat = estimerAchat(ctx, 'bière', 600, 'ml');
  assert.equal(achat.source, 'drive');
  assert.equal(achat.paquets, 1);
  assert.equal(achat.qteAchetee, 3000, 'pack de 12x25cl = 3 L');
});

test('catalogue complet : produits proches, variantes et ruptures', () => {
  let id = 500;
  const P = (nom, format, prix, prixUnite, unite, rayon, famille, sousFamille, extra = {}) =>
    ({ id: id++, nom, nomComplet: `${nom} - ${format}`, format, prix, prixPromo: null, prixUnite, unite, enStock: true, rayon, famille, sousFamille, ...extra });
  const produits = [
    P('Sauce Soja', '125ml', 0.83, 6.64, 'l', 'Épicerie salée', 'Sauces', 'Sauces du monde'),
    P('Bâtonnets Poissons panés Eco+', 'x15 - 450g', 1.94, 4.31, 'kg', 'Surgelés', 'Poissons', 'Poissons panés'),
    P('Bouillon de poule Knorr', 'x15 - 150g', 1.17, 7.8, 'kg', 'Épicerie salée', 'Aides culinaires', 'Bouillons'),
    P('Ail semoule Ducros', '140g', 2.44, 17.43, 'kg', 'Épicerie salée', 'Épices', 'Ail et oignon'),
    P('Ail blanc', 'Filet 250g', 1.49, 5.96, 'kg', 'Fruits et Légumes', 'Légumes', 'Ail'),
    P('Lait chocolaté Cacolac', '1L', 2.77, 2.77, 'l', 'Crèmerie', 'Laits', 'Laits aromatisés'),
    P('Lait demi-écrémé', '1L', 1.15, 1.15, 'l', 'Crèmerie', 'Laits', 'Laits demi-écrémés', { enStock: false }),
    P('Laurier Ducros', 'Feuilles - 4g', 1.6, null, null, 'Épicerie salée', 'Épices', 'Herbes'),
    P('Jarret de porc', '800g', 5.5, 6.88, 'kg', 'Boucherie', 'Porc', 'Porc'),
    P('Bavette', '250g', 5.9, 23.6, 'kg', 'Boucherie', 'Boeuf', 'Boeuf'),
    P('Chorizo doux', '200g', 2.4, 12, 'kg', 'Charcuterie Traiteur', 'Charcuteries', 'Saucissons'),
  ];
  for (let i = 0; i < 100; i++) produits.push(P(`Sauce tomate ${i}`, '400g', 1.2, 3, 'kg', 'Épicerie salée', 'Sauces', 'Sauces tomate'));
  const idx = indexerCatalogue(produits);
  const noms = (ing) => chercherDansCatalogue(idx, ing).map((p) => `${p.approx ? '≈' : ''}${p.nom}`);
  assert.deepEqual(noms('sauce worcestershire'), [], 'pas de sauce soja à la place');
  assert.deepEqual(noms('bouillon de poisson'), ['≈Bouillon de poule Knorr'], 'pas de bâtonnets de poisson');
  assert.deepEqual(noms("gousse d'ail"), ['Ail blanc']);
  assert.deepEqual(noms('lait'), ['Lait demi-écrémé'], 'pas de lait chocolaté, même si le vrai lait est en rupture');
  assert.deepEqual(noms('feuille de laurier'), ['Laurier Ducros']);
  assert.deepEqual(noms('jarret de bœuf'), [], 'pas de jarret de porc');
  assert.deepEqual(noms('Steak de bœuf (rumsteck ou bavette)'), ['Bavette']);
  assert.deepEqual(noms('Saucisse fumée type andouille ou chorizo'), ['Chorizo doux']);
  const ctx = creerContextePrix({ produits });
  const laurier = estimerAchat(ctx, 'feuille de laurier', 2, 'piece');
  assert.equal(laurier.source, 'drive');
  assert.equal(laurier.paquets, 1);
  assert.ok(laurier.approx);
  assert.equal(estimerAchat(ctx, 'lait', 500, 'ml').cout, 1.15);
});

test('catalogue : contenants, surgelés, cuits et produits non alimentaires', () => {
  let id = 900;
  const P = (nom, format, prix, prixUnite, unite, rayon, famille, extra = {}) =>
    ({ id: id++, nom, nomComplet: `${nom} - ${format}`, format, prix, prixPromo: null, prixUnite, unite, enStock: true, rayon, famille, sousFamille: null, ...extra });
  const produits = [
    P('Boîte mouchoirs Lotus', 'x130', 2.4, null, null, null, null),
    P('Thon entier au naturel Petit Navire', 'égoutté - 120g', 1.94, 16.17, 'kg', 'Épicerie salée', 'Conserves de poisson'),
    P('Fleurettes de brocolis', '1kg', 2.1, 2.1, 'kg', 'Surgelés', 'Légumes surgelés'),
    P('Petits pois extra-fins', '1kg', 2.3, 2.3, 'kg', 'Surgelés', 'Légumes surgelés'),
    P('Céleri branche', 'la pièce', 1.5, null, null, 'Fruits et Légumes', 'Légumes'),
    P('Graines de lin', '250g', 2.5, 10, 'kg', 'Épicerie salée', 'Graines'),
    P('Riz long grain Eco+', '1kg', 1.2, 1.2, 'kg', 'Épicerie salée', 'Riz'),
    P('Ailerons de poulet', '1kg', 4.9, 4.9, 'kg', 'Boucherie', 'Volailles'),
  ];
  const idx = indexerCatalogue(produits);
  const noms = (ing) => chercherDansCatalogue(idx, ing).map((p) => p.nom);
  assert.deepEqual(noms('thon en boîte'), ['Thon entier au naturel Petit Navire']);
  assert.deepEqual(noms('thon en conserve'), ['Thon entier au naturel Petit Navire']);
  assert.deepEqual(noms('brocoli surgelé'), ['Fleurettes de brocolis']);
  assert.deepEqual(noms('petits pois surgelés'), ['Petits pois extra-fins']);
  assert.deepEqual(noms('branche de céleri'), ['Céleri branche']);
  assert.deepEqual(noms('graines de céleri'), [], 'pas de graines de lin');
  assert.deepEqual(noms('ailes de poulet'), ['Ailerons de poulet']);
  // Riz cuit : on achète du riz cru (environ 2,5 fois moins lourd).
  const recette = { id: 'r', titre: 'Riz sauté', portions: 2, ingredients: [{ nom: 'riz cuit', qte: 600, unite: 'g' }] };
  assert.deepEqual(besoins(recette, 2)[0].nom, 'riz cuit', "l'affichage de la recette ne change pas");
  const achat = besoins(recette, 2, true)[0];
  assert.equal(achat.nom, 'riz');
  assert.equal(Math.round(achat.qte), 240);
  assert.equal(noms(achat.nom)[0], 'Riz long grain Eco+');
});

test('pas de recette avec de la sauce Worcestershire', () => {
  const avec = { ...recettes[0], id: 'w', ingredients: recettes[0].ingredients.concat([{ nom: 'Sauce Worcestershire', qte: 5, unite: 'ml' }]) };
  assert.ok(!recettesCompatibles([avec], profil).length);
  assert.equal(recettesCompatibles([recettes[0]], profil).length, 1);
});

import { analyserTicket } from '../js/ticket-texte.js';
test('ticket : lecture des lignes, quantité, remise, total', () => {
  const texte = `E.LECLERC CARPENTRAS
LARDONS FUMES 2X100G      2,15
CREME FRAICHE 20CL        1,09
2 X 0,89
YAOURT NATURE X4          1,78
REMISE IMMEDIATE         -0,30
SOUS-TOTAL                5,02
TOTAL                     4,72
CB                        4,72`;
  const r = analyserTicket(texte, ['lardons', 'crème fraîche', 'yaourt']);
  assert.equal(r.total, 4.72);
  assert.equal(r.articles.length, 3);
  assert.equal(r.articles[0].ingredient, 'lardons');
  assert.deepEqual([r.articles[0].qte, r.articles[0].unite], [200, 'g']);
  assert.deepEqual([r.articles[1].qte, r.articles[1].unite], [200, 'ml']);
  assert.equal(r.articles[2].prix, 1.48);
  assert.equal(r.articles[2].qte, 8);
});

console.log(`\n${ok} tests réussis`);
