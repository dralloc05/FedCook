// Écran stock : ce qu'il y a dans le frigo, le congélateur et les placards.

import { etat, titre } from '../etat.js';
import { echapper, normaliser } from '../texte.js';
import { aujourdhui, joursEntre, afficherQuantite, dateLisible } from '../unites.js';
import { EMPLACEMENTS, trierParPeremption } from '../stock.js';
import { ICONES } from '../icones.js';

function pastillePeremption(iso, auj) {
  if (!iso) return '';
  const j = joursEntre(auj, iso);
  const classe = j <= 1 ? 'rouge' : j <= 3 ? 'orange' : '';
  const texte = j < 0 ? 'périmé' : j === 0 ? "aujourd'hui" : j === 1 ? 'demain' : j <= 14 ? `${j} j` : dateLisible(iso, false);
  return `<span class="pastille ${classe}">${texte}</span>`;
}

export async function afficher(conteneur) {
  titre('Stock', {
    sousTitre: `${etat.stock.length} produit${etat.stock.length > 1 ? 's' : ''}`,
    actions: `<a class="icone-bouton bouton" href="#/ajout-stock" aria-label="Ajouter à la main" style="padding:0">${ICONES.plus}</a>`,
  });
  const auj = aujourdhui();

  conteneur.innerHTML = `
    <div class="grille-3">
      <a class="bouton secondaire" href="#/scan" style="padding:0 8px">Code-barres</a>
      <a class="bouton secondaire" href="#/ticket" style="padding:0 8px">Ticket</a>
      <a class="bouton secondaire" href="#/frigo" style="padding:0 8px">Photo frigo</a>
    </div>
    <div style="margin-top:14px"><input type="search" id="filtre" placeholder="Chercher dans le stock" aria-label="Chercher dans le stock"></div>
    <div id="liste-stock"></div>
  `;

  const dessiner = () => {
    const filtre = normaliser(conteneur.querySelector('#filtre').value);
    const items = trierParPeremption(etat.stock).filter(
      (it) => !filtre || normaliser(`${it.nom} ${it.ingredient || ''}`).includes(filtre)
    );
    if (!etat.stock.length) {
      conteneur.querySelector('#liste-stock').innerHTML = `<div class="carte" style="margin-top:20px">
        <p style="margin:0 0 6px;font-weight:700;font-size:17px">Ton stock est vide</p>
        <p class="doux" style="margin:0 0 14px">Scanne tes produits, prends ton ticket en photo, ou ajoute-les à la main.</p>
        <a class="bouton large" href="#/ajout-stock">Ajouter un produit</a>
      </div>`;
      return;
    }
    conteneur.querySelector('#liste-stock').innerHTML = EMPLACEMENTS.map((emp) => {
      const ici = items.filter((it) => (it.emplacement || 'Placard') === emp);
      if (!ici.length) return '';
      return `<div class="entete-section"><h2>${emp}</h2><span class="doux petit">${ici.length}</span></div>
        <div class="carte serree">${ici.map((it) => `
          <a class="rangee" href="#/ajout-stock/${encodeURIComponent(it.id)}">
            <span class="infos">
              <span class="titre" style="font-size:16px">${echapper(it.nom)}</span>
              <span class="surtitre">${afficherQuantite(it.qte, it.unite)}${it.unite === 'piece' ? ' pièce(s)' : ''}${it.ingredient && normaliser(it.ingredient) !== normaliser(it.nom) ? ` · ${echapper(it.ingredient)}` : ''}</span>
            </span>
            ${pastillePeremption(it.peremption, auj)}
          </a>`).join('')}</div>`;
    }).join('') || '<p class="vide">Aucun résultat.</p>';
  };

  conteneur.querySelector('#filtre').addEventListener('input', dessiner);
  dessiner();
}
