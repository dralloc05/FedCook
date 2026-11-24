// Menu « Plus ».

import { etat, titre } from '../etat.js';
import { echapper } from '../texte.js';
import { dateLisible } from '../unites.js';

export async function afficher(conteneur) {
  titre('Plus');
  const maj = etat.prixData?.maj;
  conteneur.innerHTML = `
    <a class="carte cliquable ligne" href="#/recettes" style="color:inherit;text-decoration:none"><span class="grandit gras">Toutes les recettes</span><span>›</span></a>
    <a class="carte cliquable ligne" href="#/historique" style="color:inherit;text-decoration:none"><span class="grandit gras">Historique (dépenses et plats)</span><span>›</span></a>
    <a class="carte cliquable ligne" href="#/installation" style="color:inherit;text-decoration:none"><span class="grandit gras">Mon profil (goûts, restrictions, matériel)</span><span>›</span></a>
    <a class="carte cliquable ligne" href="#/reglages" style="color:inherit;text-decoration:none"><span class="grandit gras">Réglages et sauvegarde</span><span>›</span></a>
    <p class="doux petit centre">${etat.recettes.length} recettes ·
      ${maj ? `prix Leclerc du ${dateLisible(maj.slice(0, 10), false)}${etat.prixData.magasin?.nom ? ` (${echapper(etat.prixData.magasin.nom)})` : ''}` : 'prix du Drive pas encore récupérés'}</p>
  `;
}
