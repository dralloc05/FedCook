// Ajout ou modification d'un produit du stock.

import { etat, sauver, titre, toast, datalistIngredients } from '../etat.js';
import { echapper, devinerIngredient } from '../texte.js';
import { aujourdhui } from '../unites.js';
import { EMPLACEMENTS, nouvelId, ajouter } from '../stock.js';
import { peremptionParDefaut, rayonDe } from '../peremption.js';

let brouillon = null;

// Pré-remplit le formulaire (utilisé après un scan de code-barres).
export function preparer(item) {
  brouillon = item;
}

export function emplacementParDefaut(nom) {
  const rayon = rayonDe(nom);
  if (rayon === 'Surgelés') return 'Congélateur';
  if (['Viandes et poissons', 'Crèmerie et œufs'].includes(rayon)) return 'Frigo';
  if (rayon === 'Fruits et légumes') return /salade|epinard|champignon|persil|coriandre|basilic|ciboulette|menthe|fraise|courgette|poivron|brocoli|haricot vert|poireau|carotte/.test(nom.toLowerCase()) ? 'Frigo' : 'Placard';
  return 'Placard';
}

export async function afficher(conteneur, params) {
  const id = params[0];
  const existant = id ? etat.stock.find((it) => String(it.id) === id) : null;
  const auj = aujourdhui();
  const base = existant || brouillon || {};
  brouillon = null;
  titre(existant ? 'Modifier' : 'Ajouter au stock');

  const ingredientInitial = base.ingredient || devinerIngredient(base.nom || '', etat.ingredientsConnus);
  const refPeremption = ingredientInitial || base.nom || '';

  conteneur.innerHTML = `
    <form id="form-stock" class="carte">
      <label for="nom">Produit</label>
      <input type="text" id="nom" required value="${echapper(base.nom || '')}" placeholder="ex : Lardons fumés">
      <label for="ingredient">Ingrédient correspondant</label>
      <input type="text" id="ingredient" list="liste-ingredients" value="${echapper(ingredientInitial)}" placeholder="ex : lardons">
      <p class="doux petit">C'est ce nom qui fait le lien avec les recettes.</p>
      <div class="champs-ligne">
        <div>
          <label for="qte">Quantité</label>
          <input type="number" id="qte" min="0" step="any" required value="${base.qte ?? ''}">
        </div>
        <div>
          <label for="unite">Unité</label>
          <select id="unite">
            ${[['g', 'grammes'], ['ml', 'millilitres'], ['piece', 'pièces']].map(([v, l]) => `<option value="${v}" ${base.unite === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="champs-ligne">
        <div>
          <label for="emplacement">Rangé où</label>
          <select id="emplacement">
            ${EMPLACEMENTS.map((e) => `<option ${(base.emplacement || emplacementParDefaut(refPeremption)) === e ? 'selected' : ''}>${e}</option>`).join('')}
          </select>
        </div>
        <div>
          <label for="peremption">Périme le</label>
          <input type="date" id="peremption" value="${base.peremption || peremptionParDefaut(refPeremption || 'x', auj)}">
        </div>
      </div>
      ${datalistIngredients()}
      <div class="boutons">
        <button type="submit">${existant ? 'Enregistrer' : 'Ajouter'}</button>
      </div>
      ${existant ? '<button type="button" class="danger large" id="supprimer">Retirer du stock</button>' : ''}
    </form>
  `;

  const f = conteneur.querySelector('#form-stock');
  let dateTouchee = Boolean(existant);
  f.querySelector('#peremption').addEventListener('input', () => { dateTouchee = true; });
  const majDefauts = () => {
    if (dateTouchee) return;
    const ref = f.querySelector('#ingredient').value || f.querySelector('#nom').value;
    f.querySelector('#peremption').value = peremptionParDefaut(ref || 'x', auj);
    f.querySelector('#emplacement').value = emplacementParDefaut(ref || '');
  };
  f.querySelector('#nom').addEventListener('change', () => {
    if (!f.querySelector('#ingredient').value) {
      f.querySelector('#ingredient').value = devinerIngredient(f.querySelector('#nom').value, etat.ingredientsConnus);
    }
    majDefauts();
  });
  f.querySelector('#ingredient').addEventListener('change', majDefauts);

  f.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const item = {
      id: existant ? existant.id : nouvelId(),
      nom: f.querySelector('#nom').value.trim(),
      ingredient: f.querySelector('#ingredient').value.trim() || f.querySelector('#nom').value.trim(),
      qte: Number(f.querySelector('#qte').value) || 0,
      unite: f.querySelector('#unite').value,
      emplacement: f.querySelector('#emplacement').value,
      peremption: f.querySelector('#peremption').value || null,
      gParPiece: base.gParPiece || null,
      ajout: existant ? existant.ajout : auj,
      source: base.source || 'main',
    };
    if (existant) {
      etat.stock = etat.stock.map((it) => (it.id === existant.id ? item : it)).filter((it) => it.qte > 0);
    } else if (item.qte > 0) {
      etat.stock = ajouter(etat.stock, item);
    }
    await sauver('stock');
    toast(existant ? 'Modifié' : 'Ajouté au stock');
    history.back();
  });

  if (existant) {
    f.querySelector('#supprimer').addEventListener('click', async () => {
      etat.stock = etat.stock.filter((it) => it.id !== existant.id);
      await sauver('stock');
      toast('Retiré du stock');
      history.back();
    });
  }
}
