// Premier lancement (et modification du profil depuis les réglages).

import { etat, sauver, aller, titre, toast } from '../etat.js';
import { RESTRICTIONS, MATERIEL, BASES_PROPOSEES } from '../planning.js';
import { echapper } from '../texte.js';

function cases(nom, options, coches) {
  return `<div class="cases">${options
    .map(([valeur, libelle]) => `<label class="case"><input type="checkbox" name="${nom}" value="${echapper(valeur)}" ${coches.includes(valeur) ? 'checked' : ''}> ${echapper(libelle)}</label>`)
    .join('')}</div>`;
}

function enListe(texte) {
  return String(texte || '')
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function afficher(conteneur) {
  const premier = !etat.profil;
  titre(premier ? 'Bienvenue sur FedCook' : 'Mon profil');
  const p = etat.profil || {
    restrictions: [],
    allergies: [],
    detestes: [],
    materiel: ['plaques', 'four', 'micro_ondes'],
    base: ['sel', 'poivre', 'huile', 'huile d\'olive'],
    personnes: 2,
    budget: 50,
  };
  const basesAffichees = [...new Set([...BASES_PROPOSEES, ...(p.base || [])])];

  conteneur.innerHTML = `
    ${premier ? `<p>Quelques questions, une seule fois. Tout reste modifiable ensuite dans <b>Plus → Mon profil</b>.</p>` : ''}
    <form id="form-profil">
      <div class="carte">
        <h3>1. Restrictions alimentaires</h3>
        <p class="doux petit">Les recettes qui ne respectent pas ces restrictions ne seront jamais proposées.</p>
        ${cases('restrictions', RESTRICTIONS, p.restrictions || [])}
        <label for="allergies">Allergies ou ingrédients interdits</label>
        <input type="text" id="allergies" placeholder="ex : arachide, crevette" value="${echapper((p.allergies || []).join(', '))}">
        <p class="doux petit">Sépare-les par des virgules. Écris le nom de l'ingrédient tel qu'il apparaît dans une recette.</p>
      </div>

      <div class="carte">
        <h3>2. Tes goûts</h3>
        <label for="detestes">Ingrédients que tu n'aimes pas</label>
        <input type="text" id="detestes" placeholder="ex : champignons, poivron" value="${echapper((p.detestes || []).join(', '))}">
      </div>

      <div class="carte">
        <h3>3. Ton matériel</h3>
        ${cases('materiel', MATERIEL, p.materiel || [])}
      </div>

      <div class="carte">
        <h3>4. Produits que tu as toujours</h3>
        <p class="doux petit">Ils ne seront jamais ajoutés à la liste de courses.</p>
        ${cases('base', basesAffichees.map((b) => [b, b]), p.base || [])}
        <label for="autres-bases">Autres (séparés par des virgules)</label>
        <input type="text" id="autres-bases" placeholder="ex : sauce soja, ketchup">
      </div>

      <div class="carte">
        <h3>5. Par défaut</h3>
        <div class="champs-ligne">
          <div>
            <label for="personnes">Personnes</label>
            <input type="number" id="personnes" min="1" max="20" value="${p.personnes || 2}">
          </div>
          <div>
            <label for="budget">Budget courses (€)</label>
            <input type="number" id="budget" min="0" step="1" value="${p.budget ?? 50}">
          </div>
        </div>
      </div>

      <button type="submit" class="large">${premier ? 'C\'est parti' : 'Enregistrer'}</button>
    </form>
  `;

  conteneur.querySelector('#form-profil').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const f = ev.currentTarget;
    const coches = (nom) => [...f.querySelectorAll(`input[name="${nom}"]:checked`)].map((i) => i.value);
    const restrictions = coches('restrictions');
    if (restrictions.includes('vegan') && !restrictions.includes('vegetarien')) restrictions.push('vegetarien');
    etat.profil = {
      restrictions,
      allergies: enListe(f.querySelector('#allergies').value),
      detestes: enListe(f.querySelector('#detestes').value),
      materiel: coches('materiel'),
      base: [...new Set([...coches('base'), ...enListe(f.querySelector('#autres-bases').value)])],
      personnes: Math.max(1, Number(f.querySelector('#personnes').value) || 2),
      budget: Math.max(0, Number(f.querySelector('#budget').value) || 0),
    };
    await sauver('profil');
    toast('Profil enregistré');
    aller(premier ? 'accueil' : 'plus');
  });
}
