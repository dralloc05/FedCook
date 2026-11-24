// Écran planning : réglages, génération, changement d'un plat, total des courses.

import { etat, sauver, titre, toast, contextePrix } from '../etat.js';
import { genererPlanning, calculerCourses, recettesCompatibles } from '../planning.js';
import { echapper, euros } from '../texte.js';
import { aujourdhui, dateLisible } from '../unites.js';
import { iconePlat, tuileNeutre } from '../icones.js';

function parametres(extra = {}) {
  return {
    recettes: etat.recettes,
    profil: etat.profil,
    stock: etat.stock,
    ctxPrix: contextePrix(),
    aujourdhui: aujourdhui(),
    historique: etat.historique,
    favoris: etat.favoris,
    ...extra,
  };
}

export function totalCourses() {
  if (!etat.planning) return null;
  return calculerCourses(parametres(), etat.planning.repas);
}

function majusculeInitiale(texte) {
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

export async function afficher(conteneur, params) {
  titre('Ta semaine');
  if (!etat.planning || params[0] === 'nouveau') return afficherFormulaire(conteneur);
  afficherPlanning(conteneur);
}

function afficherFormulaire(conteneur) {
  const p = etat.profil;
  const nbCompat = recettesCompatibles(etat.recettes, p).length;
  titre('Nouveau planning', { sousTitre: 'Midi et soir, jusqu\'à 7 jours' });
  conteneur.innerHTML = `
    <form id="form-planning" class="carte">
      <label for="debut" style="margin-top:0">À partir du</label>
      <input type="date" id="debut" value="${aujourdhui()}">
      <div class="champs-ligne">
        <div>
          <label for="jours">Jours (1 à 7)</label>
          <input type="number" id="jours" min="1" max="7" value="${etat.planning?.jours || 7}">
        </div>
        <div>
          <label for="personnes">Personnes</label>
          <input type="number" id="personnes" min="1" max="20" value="${etat.planning?.personnes || p.personnes || 2}">
        </div>
      </div>
      <label for="budget">Budget courses pour la période (€)</label>
      <input type="number" id="budget" min="0" step="1" value="${etat.planning?.budget ?? p.budget ?? 50}">
      <p class="doux petit">Midi et soir pour chaque jour. ${nbCompat} recettes compatibles avec ton profil. Laisse 0 pour ne pas limiter le budget.</p>
      ${nbCompat < 4 ? '<div class="alerte rouge">Très peu de recettes compatibles : vérifie ton matériel et tes restrictions dans Plus → Mon profil.</div>' : ''}
      <button type="submit" class="large" id="generer">Proposer les repas</button>
    </form>
  `;
  conteneur.querySelector('#form-planning').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const bouton = conteneur.querySelector('#generer');
    bouton.disabled = true;
    bouton.textContent = 'Calcul en cours…';
    const jours = Math.min(7, Math.max(1, Number(conteneur.querySelector('#jours').value) || 7));
    const personnes = Math.max(1, Number(conteneur.querySelector('#personnes').value) || 2);
    const budget = Math.max(0, Number(conteneur.querySelector('#budget').value) || 0);
    const debut = conteneur.querySelector('#debut').value || aujourdhui();
    setTimeout(async () => {
      const res = genererPlanning(parametres({ jours, personnes, budget, debut }));
      if (!res.repas.length) {
        toast('Aucune recette compatible trouvée');
        bouton.disabled = false;
        bouton.textContent = 'Proposer les repas';
        return;
      }
      etat.planning = { debut, jours, personnes, budget, repas: res.repas, cree: new Date().toISOString() };
      etat.coches = [];
      await sauver('planning', 'coches');
      afficherPlanning(conteneur);
    }, 30);
  });
}

function afficherPlanning(conteneur) {
  const pl = etat.planning;
  titre('Ta semaine', { sousTitre: `Du ${dateLisible(pl.debut, false)} au ${dateLisible(pl.repas[pl.repas.length - 1]?.date || pl.debut, false)}` });
  const courses = calculerCourses(parametres(), pl.repas);
  const depasse = pl.budget > 0 && courses.total > pl.budget + 0.01;

  const parJour = new Map();
  pl.repas.forEach((r, index) => {
    if (!parJour.has(r.date)) parJour.set(r.date, []);
    parJour.get(r.date).push({ ...r, index });
  });

  const auj = aujourdhui();
  const jours = [...parJour.entries()].map(([date, repas]) => `
    <div class="entete-section">
      <h2>${date === auj ? "Aujourd'hui" : majusculeInitiale(dateLisible(date))}</h2>
      ${date === auj ? `<span class="doux petit">${dateLisible(date)}</span>` : ''}
    </div>
    <div class="carte serree">
      ${repas.map((r) => {
        const rec = etat.parId.get(r.recetteId);
        const info = `${r.moment === 'midi' ? 'Midi' : 'Soir'}${rec ? ` · ${rec.temps || '?'} min` : ''}${r.fait ? ' · cuisiné' : ''}`;
        return `<div class="rangee ${r.fait ? 'fait' : ''}" style="flex-wrap:wrap">
          <div class="tuile ${rec && tuileNeutre(rec.id) ? 'neutre' : ''}">${iconePlat(r.recetteId)}</div>
          <a class="infos" href="#/recette/${encodeURIComponent(r.recetteId)}/${r.personnes}" style="color:inherit;font-weight:inherit">
            <span class="surtitre">${info}</span>
            <span class="titre">${echapper(rec ? rec.titre : 'Recette introuvable')}</span>
          </a>
          ${r.fait ? '' : `<div class="actions-rangee" style="width:100%;padding-left:66px">
            <a class="bouton petit" href="#/cuisine/${encodeURIComponent(r.recetteId)}/${r.personnes}/${r.index}">Cuisiner</a>
            <button class="petit secondaire" data-changer="${r.index}">Changer</button>
            <a class="petit" href="#/recettes/choisir/${r.index}">Choisir</a>
          </div>`}
        </div>`;
      }).join('')}
    </div>`).join('');

  const part = pl.budget > 0 ? Math.min(100, Math.round((courses.total / pl.budget) * 100)) : 0;
  conteneur.innerHTML = `
    <div class="carte">
      <div class="ligne espace">
        <span class="surtitre">Courses · ${pl.personnes} pers. · ${pl.jours} jour${pl.jours > 1 ? 's' : ''}</span>
        <a class="petit" href="#/planning/nouveau">Nouveau planning</a>
      </div>
      <div class="total-ligne" style="margin-top:8px">
        <span class="gros-chiffre" style="${depasse ? 'color:var(--rouge)' : ''}">${euros(courses.total)}</span>
        ${pl.budget > 0 ? `<span class="doux" style="font-size:16px;font-weight:600">sur ${euros(pl.budget)}</span>` : ''}
      </div>
      ${pl.budget > 0 ? `<div class="jauge ${depasse ? 'depasse' : ''}"><div style="width:${part}%"></div></div>` : '<div style="height:12px"></div>'}
      <a class="bouton large" href="#/courses">Voir la liste de courses</a>
    </div>
    ${courses.inconnus ? `<div class="alerte">${courses.inconnus} produit(s) sans prix connu : le total est sous-estimé.</div>` : ''}
    <div id="budget-min"></div>
    ${jours}
  `;

  if (depasse) {
    setTimeout(() => {
      const moinsCher = genererPlanning(parametres({ jours: pl.jours, personnes: pl.personnes, budget: 0, debut: pl.debut, mode: 'moinsCher' }));
      const total = calculerCourses(parametres(), moinsCher.repas).total;
      const el = conteneur.querySelector('#budget-min');
      if (el) {
        el.innerHTML = total > pl.budget + 0.01
          ? `<div class="alerte rouge">Budget impossible à tenir : le planning le moins cher trouvé coûte environ ${euros(total)}.</div>`
          : `<div class="alerte">Budget dépassé. Un planning moins cher existe (environ ${euros(total)}) : relance « Nouveau planning » ou change les plats les plus chers.</div>`;
      }
    }, 50);
  }

  conteneur.querySelectorAll('[data-changer]').forEach((b) => {
    b.addEventListener('click', () => changer(Number(b.dataset.changer), conteneur));
  });
}

export async function remplacerRepas(index, recetteId) {
  const pl = etat.planning;
  pl.repas[index] = { ...pl.repas[index], recetteId, fait: false };
  await sauver('planning');
}

async function changer(index, conteneur) {
  const pl = etat.planning;
  const fixes = new Map();
  pl.repas.forEach((r, i) => { if (i !== index) fixes.set(i, r.recetteId); });
  const res = genererPlanning(parametres({
    jours: pl.jours,
    personnes: pl.personnes,
    budget: pl.budget,
    debut: pl.debut,
    fixes,
    exclure: new Set([pl.repas[index].recetteId]),
  }));
  const nouveau = res.repas[index];
  if (!nouveau || nouveau.recetteId === pl.repas[index].recetteId) {
    toast('Pas d\'autre recette disponible');
    return;
  }
  await remplacerRepas(index, nouveau.recetteId);
  toast(`Remplacé par : ${etat.parId.get(nouveau.recetteId)?.titre || ''}`);
  afficherPlanning(conteneur);
}
