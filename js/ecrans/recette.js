// Fiche d'une recette, avec les quantités adaptées au nombre de personnes.

import { etat, titre, aller } from '../etat.js';
import { besoins, estProduitDeBase } from '../planning.js';
import { echapper, majuscule } from '../texte.js';
import { afficherQuantite } from '../unites.js';
import { disponible } from '../stock.js';
import { boutonFavori, brancherFavoris } from './recettes.js';

export function ligneIngredient(ing, avecStock = true) {
  let qte = '';
  if (ing.qte > 0) qte = ing.unite === 'piece' ? `${afficherQuantite(ing.qte, 'piece')} ` : `${afficherQuantite(ing.qte, ing.unite)} de `;
  const base = estProduitDeBase(ing.nom, etat.profil);
  let etatStock = '';
  if (avecStock && ing.qte > 0 && !base) {
    const dispo = disponible(etat.stock, ing.nom, ing.unite, ing.g);
    etatStock = dispo >= ing.qte * 0.98 ? ' <span class="pastille">en stock</span>' : dispo > 0 ? ' <span class="pastille orange">en partie</span>' : '';
  }
  const texte = ing.qte > 0 ? `${qte}${ing.nom}` : `${majuscule(ing.nom)} (selon le goût)`;
  return `<li>${echapper(majuscule(texte))}${etatStock}</li>`;
}

export async function afficher(conteneur, params) {
  const r = etat.parId.get(params[0]);
  if (!r) {
    conteneur.innerHTML = '<p class="vide">Recette introuvable.</p>';
    return;
  }
  let personnes = Math.max(1, Number(params[1]) || etat.profil.personnes || 2);
  titre('Recette');

  const dessiner = () => {
    conteneur.innerHTML = `
      <div class="ligne haut">
        <h2 class="grandit" style="margin-top:4px">${echapper(r.titre)}</h2>
        ${boutonFavori(r.id)}
      </div>
      <p class="doux">${r.temps || '?'} min${(r.materiel || []).length ? ` · ${r.materiel.map((m) => m.replace('_', '-')).join(', ')}` : ''}</p>
      <div class="carte">
        <div class="ligne espace">
          <h3 style="margin:0">Ingrédients</h3>
          <div class="ligne">
            <button class="petit secondaire" id="moins" aria-label="Moins de personnes">−</button>
            <span class="gras">${personnes} pers.</span>
            <button class="petit secondaire" id="plus" aria-label="Plus de personnes">+</button>
          </div>
        </div>
        <ul class="liste">${besoins(r, personnes).map((ing) => ligneIngredient(ing)).join('')}</ul>
      </div>
      <div class="carte">
        <h3>Étapes</h3>
        <ol>${(r.etapes || []).map((e) => `<li style="margin:6px 0">${echapper(e.texte)}${e.min ? ` <span class="doux petit">(${e.min} min)</span>` : ''}</li>`).join('')}</ol>
      </div>
      <button class="large" id="cuisiner">Cuisiner en mode pas à pas</button>
    `;
    brancherFavoris(conteneur);
    conteneur.querySelector('#moins').addEventListener('click', () => { personnes = Math.max(1, personnes - 1); dessiner(); });
    conteneur.querySelector('#plus').addEventListener('click', () => { personnes = Math.min(20, personnes + 1); dessiner(); });
    conteneur.querySelector('#cuisiner').addEventListener('click', () => {
      const index = (etat.planning?.repas || []).findIndex((x) => x.recetteId === r.id && !x.fait);
      aller(`cuisine/${encodeURIComponent(r.id)}/${personnes}${index >= 0 ? `/${index}` : ''}`);
    });
  };
  dessiner();
}
