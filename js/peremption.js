// Rayon et durée de conservation par défaut, devinés à partir du nom.
// Les durées sont des valeurs prudentes, toujours modifiables à l'ajout.

import { normaliser } from './texte.js';
import { ajouterJours } from './unites.js';

export const RAYONS = [
  'Fruits et légumes',
  'Viandes et poissons',
  'Crèmerie et œufs',
  'Boulangerie',
  'Épicerie',
  'Surgelés',
  'Boissons',
  'Autres',
];

// Ordre important : les mots les plus précis d'abord.
const REGLES = [
  ['surgele', 'Surgelés', 180],
  ['lait de coco', 'Épicerie', 365],
  ['creme de coco', 'Épicerie', 365],
  ['pomme de terre', 'Fruits et légumes', 30],
  ['patate douce', 'Fruits et légumes', 21],
  ['pate feuilletee', 'Crèmerie et œufs', 10],
  ['pate brisee', 'Crèmerie et œufs', 10],
  ['pate sablee', 'Crèmerie et œufs', 10],
  ['pate a pizza', 'Crèmerie et œufs', 10],
  ['pain de mie', 'Boulangerie', 7],
  ['tortilla', 'Boulangerie', 14],
  ['wrap', 'Boulangerie', 14],
  ['pain', 'Boulangerie', 3],
  ['baguette', 'Boulangerie', 2],
  ['sauce tomate', 'Épicerie', 365],
  ['coulis', 'Épicerie', 365],
  ['concentre', 'Épicerie', 365],
  ['tomate pelee', 'Épicerie', 365],
  ['tomate concassee', 'Épicerie', 365],
  ['thon', 'Épicerie', 730],
  ['sardine', 'Épicerie', 730],
  ['pois chiche', 'Épicerie', 365],
  ['haricot rouge', 'Épicerie', 365],
  ['haricot blanc', 'Épicerie', 365],
  ['lentille', 'Épicerie', 365],
  ['mais', 'Épicerie', 365],
  ['olive', 'Épicerie', 365],
  ['huile', 'Épicerie', 365],
  ['vinaigre', 'Épicerie', 730],
  ['moutarde', 'Épicerie', 180],
  ['ketchup', 'Épicerie', 180],
  ['mayonnaise', 'Épicerie', 60],
  ['sauce soja', 'Épicerie', 365],
  ['bouillon', 'Épicerie', 365],
  ['pate', 'Épicerie', 365],
  ['spaghetti', 'Épicerie', 365],
  ['tagliatelle', 'Épicerie', 365],
  ['penne', 'Épicerie', 365],
  ['nouille', 'Épicerie', 365],
  ['riz', 'Épicerie', 365],
  ['semoule', 'Épicerie', 365],
  ['quinoa', 'Épicerie', 365],
  ['boulgour', 'Épicerie', 365],
  ['farine', 'Épicerie', 180],
  ['sucre', 'Épicerie', 730],
  ['sel', 'Épicerie', 1000],
  ['poivre', 'Épicerie', 1000],
  ['epice', 'Épicerie', 365],
  ['cumin', 'Épicerie', 365],
  ['paprika', 'Épicerie', 365],
  ['curry', 'Épicerie', 365],
  ['herbe de provence', 'Épicerie', 365],
  ['levure', 'Épicerie', 180],
  ['miel', 'Épicerie', 730],
  ['chocolat', 'Épicerie', 180],
  ['cafe', 'Épicerie', 180],
  ['the', 'Épicerie', 365],
  ['chapelure', 'Épicerie', 180],
  ['lait', 'Crèmerie et œufs', 7],
  ['creme', 'Crèmerie et œufs', 10],
  ['beurre', 'Crèmerie et œufs', 30],
  ['yaourt', 'Crèmerie et œufs', 21],
  ['fromage blanc', 'Crèmerie et œufs', 10],
  ['mozzarella', 'Crèmerie et œufs', 7],
  ['ricotta', 'Crèmerie et œufs', 5],
  ['parmesan', 'Crèmerie et œufs', 30],
  ['emmental', 'Crèmerie et œufs', 14],
  ['gruyere', 'Crèmerie et œufs', 14],
  ['comte', 'Crèmerie et œufs', 21],
  ['feta', 'Crèmerie et œufs', 14],
  ['chevre', 'Crèmerie et œufs', 14],
  ['fromage', 'Crèmerie et œufs', 14],
  ['oeuf', 'Crèmerie et œufs', 28],
  ['viande hachee', 'Viandes et poissons', 1],
  ['steak hache', 'Viandes et poissons', 1],
  ['hache', 'Viandes et poissons', 1],
  ['lardon', 'Viandes et poissons', 10],
  ['jambon', 'Viandes et poissons', 5],
  ['chorizo', 'Viandes et poissons', 21],
  ['saucisse', 'Viandes et poissons', 4],
  ['merguez', 'Viandes et poissons', 3],
  ['poulet', 'Viandes et poissons', 2],
  ['dinde', 'Viandes et poissons', 2],
  ['canard', 'Viandes et poissons', 3],
  ['boeuf', 'Viandes et poissons', 3],
  ['veau', 'Viandes et poissons', 3],
  ['porc', 'Viandes et poissons', 3],
  ['agneau', 'Viandes et poissons', 3],
  ['saumon', 'Viandes et poissons', 2],
  ['cabillaud', 'Viandes et poissons', 2],
  ['colin', 'Viandes et poissons', 2],
  ['poisson', 'Viandes et poissons', 2],
  ['crevette', 'Viandes et poissons', 2],
  ['salade', 'Fruits et légumes', 4],
  ['laitue', 'Fruits et légumes', 4],
  ['epinard', 'Fruits et légumes', 4],
  ['champignon', 'Fruits et légumes', 4],
  ['persil', 'Fruits et légumes', 5],
  ['coriandre', 'Fruits et légumes', 5],
  ['basilic', 'Fruits et légumes', 5],
  ['ciboulette', 'Fruits et légumes', 5],
  ['menthe', 'Fruits et légumes', 5],
  ['avocat', 'Fruits et légumes', 4],
  ['fraise', 'Fruits et légumes', 3],
  ['banane', 'Fruits et légumes', 5],
  ['tomate', 'Fruits et légumes', 6],
  ['courgette', 'Fruits et légumes', 7],
  ['aubergine', 'Fruits et légumes', 7],
  ['poivron', 'Fruits et légumes', 7],
  ['concombre', 'Fruits et légumes', 7],
  ['brocoli', 'Fruits et légumes', 5],
  ['chou', 'Fruits et légumes', 10],
  ['poireau', 'Fruits et légumes', 10],
  ['carotte', 'Fruits et légumes', 14],
  ['oignon', 'Fruits et légumes', 30],
  ['echalote', 'Fruits et légumes', 30],
  ['ail', 'Fruits et légumes', 60],
  ['gingembre', 'Fruits et légumes', 21],
  ['citron', 'Fruits et légumes', 21],
  ['pomme', 'Fruits et légumes', 21],
  ['orange', 'Fruits et légumes', 14],
  ['poire', 'Fruits et légumes', 7],
  ['potiron', 'Fruits et légumes', 30],
  ['courge', 'Fruits et légumes', 30],
  ['haricot vert', 'Fruits et légumes', 5],
  ['petit poi', 'Surgelés', 180],
  ['eau', 'Boissons', 365],
  ['jus', 'Boissons', 7],
  ['vin', 'Boissons', 365],
  ['biere', 'Boissons', 365],
];

const REGLES_NORMALISEES = REGLES.map(([mot, rayon, jours]) => [normaliser(mot), rayon, jours]);

function regle(nom) {
  const n = ` ${normaliser(nom)} `;
  for (const [mot, rayon, jours] of REGLES_NORMALISEES) {
    if (n.includes(` ${mot} `)) return { rayon, jours };
  }
  return null;
}

export function rayonDe(nom) {
  return regle(nom)?.rayon || 'Autres';
}

export function dureeConservation(nom) {
  return regle(nom)?.jours ?? 7;
}

export function peremptionParDefaut(nom, depuisISO) {
  return ajouterJours(depuisISO, dureeConservation(nom));
}
