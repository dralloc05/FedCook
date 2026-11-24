// Tests de la logique (sans navigateur) : node tests/tests.js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normaliser, memeIngredient, devinerIngredient } from '../js/texte.js';
import { parserFormat, convertir, ajouterJours, joursEntre } from '../js/unites.js';
import { rayonDe, dureeConservation } from '../js/peremption.js';
import { creerContextePrix, estimerAchat, contenance } from '../js/prix.js';
import { retirer, disponible } from '../js/stock.js';
import { genererPlanning, calculerCourses, recettesCompatibles } from '../js/planning.js';

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
