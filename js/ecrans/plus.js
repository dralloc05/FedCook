// Menu « Plus ».

import { etat, titre, libelleMagasin } from '../etat.js';
import { echapper } from '../texte.js';
import { dateLisible } from '../unites.js';
import { ICONES } from '../icones.js';

// Version du code, pour vérifier qu'une mise à jour est bien arrivée sur le téléphone.
const VERSION_APPLI = '7';

function rangee(lien, icone, texte, detail) {
  return `<a class="rangee" href="${lien}">
    <span class="tuile neutre" style="width:44px;height:44px">${icone}</span>
    <span class="infos"><span class="titre" style="font-size:16px">${texte}</span>${detail ? `<span class="surtitre">${detail}</span>` : ''}</span>
    <span class="chevron">${ICONES.chevron}</span>
  </a>`;
}

export async function afficher(conteneur) {
  titre('Plus');
  const maj = etat.prixData?.maj;
  conteneur.innerHTML = `
    <div class="carte serree">
      ${rangee('#/recettes', ICONES.livre, 'Toutes les recettes', `${etat.recettes.length} recettes · favoris`)}
      ${rangee('#/historique', ICONES.graphique, 'Historique', 'Dépenses et plats cuisinés')}
    </div>
    <div class="carte serree">
      ${rangee('#/installation', ICONES.profil, 'Mon profil', 'Goûts, restrictions, matériel')}
      ${rangee('#/reglages', ICONES.reglages, 'Réglages', 'Clé Gemini, sauvegarde')}
    </div>
    <p class="doux petit centre" style="margin-top:20px">${maj
      ? `Prix Leclerc du ${dateLisible(maj.slice(0, 10), false)}${libelleMagasin() ? ` · ${echapper(libelleMagasin())}` : ''}`
      : 'Prix du Drive pas encore récupérés'}<br>Version ${VERSION_APPLI} · ${etat.recettes.length} recettes</p>
  `;
}
