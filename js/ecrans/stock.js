// Écran stock : ce qu'il y a dans le frigo, le congélateur et les placards.

import { etat, titre } from '../etat.js';
import { echapper, normaliser } from '../texte.js';
import { aujourdhui, joursEntre, afficherQuantite, dateLisible } from '../unites.js';
import { EMPLACEMENTS, trierParPeremption } from '../stock.js';

function pastillePeremption(iso, auj) {
  if (!iso) return '';
  const j = joursEntre(auj, iso);
  const classe = j <= 0 ? 'rouge' : j <= 2 ? 'orange' : '';
  const texte = j < 0 ? 'périmé' : j === 0 ? "aujourd'hui" : j === 1 ? 'demain' : j <= 14 ? `${j} j` : dateLisible(iso, false);
  return `<span class="pastille ${classe}">${texte}</span>`;
}

export async function afficher(conteneur) {
  titre('Stock');
  const auj = aujourdhui();

  conteneur.innerHTML = `
    <div class="boutons">
      <a class="bouton" href="#/ajout-stock">+ À la main</a>
      <a class="bouton secondaire" href="#/scan">Code-barres</a>
    </div>
    <div class="boutons">
      <a class="bouton secondaire" href="#/ticket">Photo du ticket</a>
      <a class="bouton secondaire" href="#/frigo">Photo du frigo</a>
    </div>
    <input type="search" id="filtre" placeholder="Chercher dans le stock">
    <div id="liste-stock"></div>
  `;

  const dessiner = () => {
    const filtre = normaliser(conteneur.querySelector('#filtre').value);
    const items = trierParPeremption(etat.stock).filter(
      (it) => !filtre || normaliser(`${it.nom} ${it.ingredient || ''}`).includes(filtre)
    );
    if (!etat.stock.length) {
      conteneur.querySelector('#liste-stock').innerHTML = '<p class="vide">Ton stock est vide. Ajoute ce que tu as avec les boutons ci-dessus.</p>';
      return;
    }
    conteneur.querySelector('#liste-stock').innerHTML = EMPLACEMENTS.map((emp) => {
      const ici = items.filter((it) => (it.emplacement || 'Placard') === emp);
      if (!ici.length) return '';
      return `<h2>${emp} <span class="doux petit">(${ici.length})</span></h2>
        <div class="carte"><ul class="liste">${ici.map((it) => `
          <li><a href="#/ajout-stock/${encodeURIComponent(it.id)}" class="ligne espace" style="color:inherit;text-decoration:none">
            <span class="grandit">
              <span class="gras">${echapper(it.nom)}</span><br>
              <span class="doux petit">${afficherQuantite(it.qte, it.unite)}${it.unite === 'piece' ? ' pièce(s)' : ''}${it.ingredient && normaliser(it.ingredient) !== normaliser(it.nom) ? ` · ${echapper(it.ingredient)}` : ''}</span>
            </span>
            ${pastillePeremption(it.peremption, auj)}
          </a></li>`).join('')}</ul></div>`;
    }).join('') || '<p class="vide">Aucun résultat.</p>';
  };

  conteneur.querySelector('#filtre').addEventListener('input', dessiner);
  dessiner();
}
