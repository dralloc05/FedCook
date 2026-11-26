// Fiche d'une recette, avec les quantités adaptées au nombre de personnes.

import { etat, titre, aller } from '../etat.js';
import { besoins, estProduitDeBase, versIngredientAchete } from '../planning.js';
import { echapper, majuscule } from '../texte.js';
import { afficherQuantite } from '../unites.js';
import { disponible } from '../stock.js';
import { boutonFavori, brancherFavoris } from './recettes.js';
import { ICONES, iconePlat } from '../icones.js';

export function ligneIngredient(ing, avecStock = true) {
  let qte = '';
  if (ing.qte > 0) qte = ing.unite === 'piece' ? `${afficherQuantite(ing.qte, 'piece')} ` : `${afficherQuantite(ing.qte, ing.unite)} de `;
  const base = estProduitDeBase(ing.nom, etat.profil);
  let etatStock = '';
  if (avecStock && ing.qte > 0 && !base) {
    // « Riz cuit » : on regarde s'il reste assez de riz cru.
    const achat = versIngredientAchete(ing.nom, ing.qte) || { nom: ing.nom, qte: ing.qte };
    const dispo = disponible(etat.stock, achat.nom, ing.unite, ing.g);
    etatStock = dispo >= achat.qte * 0.98 ? ' <span class="pastille verte">en stock</span>' : dispo > 0 ? ' <span class="pastille orange">en partie</span>' : '';
  }
  const texte = ing.qte > 0 ? `${qte}${ing.nom}` : `${majuscule(ing.nom)} (selon le goût)`;
  return `<li class="ligne espace"><span>${echapper(majuscule(texte))}</span>${etatStock}</li>`;
}

export async function afficher(conteneur, params) {
  const r = etat.parId.get(params[0]);
  if (!r) {
    conteneur.innerHTML = '<p class="vide">Recette introuvable.</p>';
    return;
  }
  let personnes = Math.max(1, Number(params[1]) || etat.profil.personnes || 2);
  titre(r.titre, { sousTitre: `${r.temps || '?'} min${(r.regimes || []).includes('vegetarien') ? ' · végétarien' : ''}` });

  const dessiner = () => {
    conteneur.innerHTML = `
      <div class="carte ligne" style="gap:14px">
        <div class="tuile" style="width:64px;height:64px">${iconePlat(r.id)}</div>
        <div class="grandit">
          <span class="surtitre">${(r.etapes || []).length} étapes${(r.materiel || []).length ? ` · ${r.materiel.map((m) => m.replace('_', '-')).join(', ')}` : ''}</span>
          <div class="puces" style="margin-top:8px">${(r.regimes || []).map((x) => `<span class="pastille verte">${x.replace('_', ' ')}</span>`).join('')}</div>
        </div>
        ${boutonFavori(r.id)}
      </div>
      <div class="carte">
        <div class="ligne espace">
          <h3 style="margin:0">Ingrédients</h3>
          <div class="compteur">
            <button class="icone-bouton petit" id="moins" aria-label="Moins de personnes">−</button>
            <b>${personnes} pers.</b>
            <button class="icone-bouton petit" id="plus" aria-label="Plus de personnes">+</button>
          </div>
        </div>
        <ul class="liste" style="margin-top:6px">${besoins(r, personnes).map((ing) => ligneIngredient(ing)).join('')}</ul>
      </div>
      <div class="carte">
        <h3>Étapes</h3>
        <ol class="etapes">${(r.etapes || []).map((e) => `<li>${echapper(e.texte)}${e.min ? ` <span class="doux petit">(${e.min} min)</span>` : ''}</li>`).join('')}</ol>
      </div>
      <button class="large" id="cuisiner">${ICONES.lecture} Cuisiner pas à pas</button>
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
