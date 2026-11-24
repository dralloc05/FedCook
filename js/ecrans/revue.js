// Liste à vérifier avant d'ajouter plusieurs produits au stock (ticket, photo du frigo).

import { datalistIngredients } from '../etat.js';
import { echapper } from '../texte.js';
import { EMPLACEMENTS, nouvelId } from '../stock.js';
import { peremptionParDefaut } from '../peremption.js';
import { aujourdhui } from '../unites.js';
import { emplacementParDefaut } from './ajout-stock.js';

// lignes : [{ nom, ingredient, qte, unite, prix?, coche? }]
export function dessinerRevue(conteneur, lignes, { avecPrix = false } = {}) {
  const auj = aujourdhui();
  conteneur.innerHTML = `
    ${datalistIngredients()}
    ${lignes.map((l, i) => {
      const ref = l.ingredient || l.nom || '';
      return `<div class="carte" data-ligne="${i}">
        <label class="ligne" style="margin:0">
          <input type="checkbox" class="garder" ${l.coche === false ? '' : 'checked'}>
          <span class="grandit">${avecPrix ? 'Ajouter au stock' : 'Garder'}</span>
          ${avecPrix ? `<input type="number" class="prix" step="0.01" min="0" value="${l.prix ?? ''}" style="width:96px" aria-label="Prix en euros"> €` : ''}
        </label>
        ${l.libelle ? `<p class="doux petit">Ticket : ${echapper(l.libelle)}</p>` : ''}
        <div class="champs-ligne">
          <div><label>Produit</label><input type="text" class="nom" value="${echapper(l.nom || '')}"></div>
          <div><label>Ingrédient</label><input type="text" class="ingredient" list="liste-ingredients" value="${echapper(l.ingredient || '')}"></div>
        </div>
        <div class="champs-ligne">
          <div><label>Quantité</label><input type="number" class="qte" min="0" step="any" value="${l.qte ?? ''}"></div>
          <div><label>Unité</label><select class="unite">${[['g', 'g'], ['ml', 'ml'], ['piece', 'pièces']].map(([v, t]) => `<option value="${v}" ${l.unite === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
        </div>
        <div class="champs-ligne">
          <div><label>Rangé où</label><select class="emplacement">${EMPLACEMENTS.map((e) => `<option ${emplacementParDefaut(ref) === e ? 'selected' : ''}>${e}</option>`).join('')}</select></div>
          <div><label>Périme le</label><input type="date" class="peremption" value="${peremptionParDefaut(ref || 'x', auj)}"></div>
        </div>
      </div>`;
    }).join('')}
  `;

  return function lire() {
    return [...conteneur.querySelectorAll('[data-ligne]')].map((el) => {
      const val = (sel) => el.querySelector(sel)?.value ?? '';
      const nom = val('.nom').trim();
      return {
        garder: el.querySelector('.garder').checked,
        prix: avecPrix ? Number(val('.prix')) || 0 : null,
        item: {
          id: nouvelId(),
          nom,
          ingredient: val('.ingredient').trim() || nom,
          qte: Number(val('.qte')) || 0,
          unite: val('.unite') || 'piece',
          emplacement: val('.emplacement'),
          peremption: val('.peremption') || null,
          ajout: auj,
        },
      };
    });
  };
}
