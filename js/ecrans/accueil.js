// Écran d'accueil : budget, repas du jour, produits qui périment bientôt, raccourcis.

import { etat, titre, contextePrix } from '../etat.js';
import { calculerCourses } from '../planning.js';
import { echapper, euros } from '../texte.js';
import { aujourdhui, joursEntre, dateLisible } from '../unites.js';
import { trierParPeremption } from '../stock.js';
import { ICONES, iconePlat, tuileNeutre } from '../icones.js';

function majusculeInitiale(texte) {
  return texte.charAt(0).toUpperCase() + texte.slice(1);
}

function carteBudget() {
  const pl = etat.planning;
  if (!pl) {
    return `<div class="carte">
      <span class="surtitre">Pas encore de planning</span>
      <p style="margin:6px 0 14px;font-size:17px;font-weight:700">Prépare tes repas de la semaine et ta liste de courses.</p>
      <a class="bouton large" href="#/planning">Préparer un planning</a>
    </div>`;
  }
  const res = calculerCourses({ recettes: etat.recettes, profil: etat.profil, stock: etat.stock, ctxPrix: contextePrix() }, pl.repas);
  const budget = pl.budget || 0;
  const part = budget > 0 ? Math.min(100, Math.round((res.total / budget) * 100)) : 0;
  const depasse = budget > 0 && res.total > budget + 0.01;
  const marge = budget - res.total;
  return `<div class="carte">
    <div class="ligne espace">
      <span class="surtitre">Budget courses · ${pl.jours} jour${pl.jours > 1 ? 's' : ''}</span>
      <a href="#/courses" class="petit">Liste</a>
    </div>
    <div class="total-ligne" style="margin-top:8px">
      <span class="gros-chiffre">${euros(res.total)}</span>
      ${budget > 0 ? `<span class="doux" style="font-size:16px;font-weight:600">sur ${euros(budget)}</span>` : ''}
    </div>
    ${budget > 0 ? `<div class="jauge ${depasse ? 'depasse' : ''}"><div style="width:${part}%"></div></div>` : '<div style="height:14px"></div>'}
    <div class="grille-2">
      <div class="case-chiffre"><b style="${depasse ? 'color:var(--rouge)' : ''}">${budget > 0 ? euros(Math.abs(marge)) : '—'}</b><span>${budget > 0 ? (depasse ? 'de dépassement' : 'de marge') : 'pas de budget fixé'}</span></div>
      <div class="case-chiffre"><b>${res.lignes.length} produit${res.lignes.length > 1 ? 's' : ''}</b><span>à acheter</span></div>
    </div>
    ${res.inconnus ? `<p class="doux petit" style="margin:10px 0 0">${res.inconnus} produit(s) sans prix connu, pas comptés dans le total.</p>` : ''}
  </div>`;
}

export async function afficher(conteneur) {
  const auj = aujourdhui();
  titre('Bonjour', {
    sousTitre: majusculeInitiale(dateLisible(auj)),
    actions: `<a class="icone-bouton bouton" href="#/reglages" aria-label="Réglages" style="padding:0">${ICONES.reglages}</a>`,
  });

  const repasDuJour = (etat.planning?.repas || [])
    .map((r, index) => ({ ...r, index }))
    .filter((r) => r.date === auj);
  const bientot = trierParPeremption(etat.stock).filter((it) => it.peremption && joursEntre(auj, it.peremption) <= 3);

  const rangees = repasDuJour.map((r) => {
    const rec = etat.parId.get(r.recetteId);
    if (!rec) return '';
    const info = `${r.moment === 'midi' ? 'Midi' : 'Soir'} · ${rec.temps || '?'} min${r.fait ? ' · cuisiné' : ''}`;
    return `<div class="rangee ${r.fait ? 'fait' : ''}">
      <div class="tuile ${tuileNeutre(rec.id) ? 'neutre' : ''}">${iconePlat(rec.id)}</div>
      <a class="infos" href="#/recette/${encodeURIComponent(rec.id)}/${r.personnes}" style="color:inherit;font-weight:inherit">
        <span class="surtitre">${info}</span>
        <span class="titre">${echapper(rec.titre)}</span>
      </a>
      ${r.fait ? '' : `<a class="bouton petit" href="#/cuisine/${encodeURIComponent(rec.id)}/${r.personnes}/${r.index}">Cuisiner</a>`}
    </div>`;
  }).join('');

  const puces = bientot.slice(0, 8).map((it) => {
    const j = joursEntre(auj, it.peremption);
    const quand = j < 0 ? 'périmé' : j === 0 ? "aujourd'hui" : j === 1 ? 'demain' : `${j} j`;
    return `<a class="puce" href="#/ajout-stock/${encodeURIComponent(it.id)}"><span class="point ${j <= 1 ? 'urgent' : ''}"></span>${echapper(it.ingredient || it.nom)} · ${quand}</a>`;
  }).join('');

  conteneur.innerHTML = `
    ${carteBudget()}

    <div class="entete-section">
      <h2>Aujourd'hui</h2>
      <a href="#/planning" class="petit">Toute la semaine</a>
    </div>
    ${rangees
      ? `<div class="carte serree">${rangees}</div>`
      : `<div class="carte"><p class="doux" style="margin:0">Rien de prévu aujourd'hui.</p></div>`}

    ${puces ? `<h2>À utiliser vite</h2><div class="puces">${puces}</div>` : ''}

    <h2>Ajouter au stock</h2>
    <div class="grille-3">
      <a class="bouton secondaire" href="#/scan" style="padding:0 8px">Code-barres</a>
      <a class="bouton secondaire" href="#/ticket" style="padding:0 8px">Ticket</a>
      <a class="bouton secondaire" href="#/frigo" style="padding:0 8px">Photo frigo</a>
    </div>

    <p class="doux petit centre" style="margin-top:24px">${etat.recettes.length} recettes · ${etat.prixData?.maj
      ? `prix Leclerc du ${dateLisible(etat.prixData.maj.slice(0, 10), false)}`
      : 'prix du Drive pas encore récupérés'}</p>
  `;
}
