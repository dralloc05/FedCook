// Toutes les recettes : recherche, favoris. Sert aussi à choisir un plat pour le planning.

import { etat, sauver, titre, toast, aller } from '../etat.js';
import { recettesCompatibles } from '../planning.js';
import { echapper, normaliser } from '../texte.js';
import { remplacerRepas } from './planning.js';

const PAR_PAGE = 60;

export function boutonFavori(id) {
  const fav = etat.favoris.includes(id);
  return `<button class="coeur" data-favori="${echapper(id)}" aria-label="${fav ? 'Retirer des favoris' : 'Ajouter aux favoris'}">${fav ? '&#9829;' : '&#9825;'}</button>`;
}

export function brancherFavoris(racine) {
  racine.querySelectorAll('[data-favori]').forEach((b) => {
    b.addEventListener('click', async (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const id = b.dataset.favori;
      const ens = new Set(etat.favoris);
      if (ens.has(id)) ens.delete(id); else ens.add(id);
      etat.favoris = [...ens];
      await sauver('favoris');
      b.innerHTML = ens.has(id) ? '&#9829;' : '&#9825;';
    });
  });
}

export async function afficher(conteneur, params) {
  const choisir = params[0] === 'choisir';
  const index = Number(params[1]);
  titre(choisir ? 'Choisir un plat' : 'Recettes');
  const compat = new Set(recettesCompatibles(etat.recettes, etat.profil).map((r) => r.id));
  const index_recherche = etat.recettes.map((r) => ({
    r,
    texte: normaliser(`${r.titre} ${(r.ingredients || []).map((i) => i.nom).join(' ')}`),
  }));

  conteneur.innerHTML = `
    <input type="search" id="recherche" placeholder="Chercher un plat ou un ingrédient">
    <div class="cases">
      <label class="case"><input type="checkbox" id="f-compat" checked> Compatibles avec mon profil</label>
      <label class="case"><input type="checkbox" id="f-fav"> Favoris</label>
    </div>
    <p class="doux petit" id="compte"></p>
    <div id="resultats"></div>
  `;

  let limite = PAR_PAGE;
  const dessiner = () => {
    const mots = normaliser(conteneur.querySelector('#recherche').value).split(' ').filter(Boolean);
    const seulementCompat = conteneur.querySelector('#f-compat').checked;
    const seulementFav = conteneur.querySelector('#f-fav').checked;
    const fav = new Set(etat.favoris);
    const trouves = index_recherche
      .filter(({ r, texte }) =>
        (!seulementCompat || compat.has(r.id)) &&
        (!seulementFav || fav.has(r.id)) &&
        (r.type || 'plat') === 'plat' &&
        mots.every((m) => texte.includes(m)))
      .map(({ r }) => r);
    conteneur.querySelector('#compte').textContent = `${trouves.length} recette(s)`;
    conteneur.querySelector('#resultats').innerHTML = trouves.slice(0, limite).map((r) => `
      <div class="carte cliquable ligne" data-recette="${echapper(r.id)}">
        <div class="grandit">
          <div class="gras">${echapper(r.titre)}</div>
          <div class="doux petit">${r.temps || '?'} min · ${r.portions || '?'} pers.${compat.has(r.id) ? '' : ' · <span class="pastille rouge">hors profil</span>'}</div>
        </div>
        ${boutonFavori(r.id)}
      </div>`).join('') + (trouves.length > limite ? '<button class="large secondaire" id="plus">Afficher plus</button>' : '');

    brancherFavoris(conteneur.querySelector('#resultats'));
    conteneur.querySelectorAll('[data-recette]').forEach((el) => {
      el.addEventListener('click', async () => {
        const id = el.dataset.recette;
        if (choisir && etat.planning && etat.planning.repas[index]) {
          await remplacerRepas(index, id);
          toast('Plat remplacé');
          aller('planning');
        } else {
          const personnes = etat.planning?.personnes || etat.profil.personnes || 2;
          aller(`recette/${encodeURIComponent(id)}/${personnes}`);
        }
      });
    });
    conteneur.querySelector('#plus')?.addEventListener('click', () => { limite += PAR_PAGE; dessiner(); });
  };

  let attente = null;
  conteneur.querySelector('#recherche').addEventListener('input', () => {
    clearTimeout(attente);
    attente = setTimeout(() => { limite = PAR_PAGE; dessiner(); }, 200);
  });
  conteneur.querySelector('#f-compat').addEventListener('change', () => { limite = PAR_PAGE; dessiner(); });
  conteneur.querySelector('#f-fav').addEventListener('change', () => { limite = PAR_PAGE; dessiner(); });
  dessiner();
}
