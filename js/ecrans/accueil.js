// Écran d'accueil : les repas du jour, ce qui périme bientôt, raccourcis.

import { etat, titre } from '../etat.js';
import { echapper } from '../texte.js';
import { aujourdhui, joursEntre, afficherQuantite, dateLisible } from '../unites.js';
import { trierParPeremption } from '../stock.js';

export async function afficher(conteneur) {
  titre('Accueil');
  const auj = aujourdhui();
  const repasDuJour = (etat.planning?.repas || [])
    .map((r, index) => ({ ...r, index }))
    .filter((r) => r.date === auj);
  const bientot = trierParPeremption(etat.stock).filter((it) => it.peremption && joursEntre(auj, it.peremption) <= 2);

  const blocRepas = repasDuJour.length
    ? repasDuJour.map((r) => {
        const rec = etat.parId.get(r.recetteId);
        return `<div class="repas ${r.fait ? 'fait' : ''}">
          <div class="moment">${r.moment === 'midi' ? 'Midi' : 'Soir'}</div>
          <div class="grandit">
            <div class="titre-repas gras">${echapper(rec ? rec.titre : 'Recette introuvable')}</div>
            <div class="doux petit">${rec ? `${rec.temps || '?'} min · ${r.personnes} pers.` : ''}</div>
          </div>
          ${rec && !r.fait ? `<a class="bouton petit" href="#/cuisine/${encodeURIComponent(r.recetteId)}/${r.personnes}/${r.index}">Cuisiner</a>` : ''}
        </div>`;
      }).join('')
    : `<p class="doux">Rien de prévu aujourd'hui.</p>
       <a class="bouton large" href="#/planning">Préparer un planning</a>`;

  const blocPeremption = bientot.length
    ? `<div class="alerte"><b>À utiliser vite :</b>
        <ul class="liste">${bientot.map((it) => {
          const j = joursEntre(auj, it.peremption);
          const quand = j < 0 ? 'périmé' : j === 0 ? "aujourd'hui" : j === 1 ? 'demain' : `dans ${j} jours`;
          return `<li>${echapper(it.nom)} — ${afficherQuantite(it.qte, it.unite)}${it.unite === 'piece' ? ' pièce(s)' : ''} <span class="pastille ${j <= 0 ? 'rouge' : 'orange'}">${quand}</span></li>`;
        }).join('')}</ul></div>`
    : '';

  const infoPrix = etat.prixData?.maj
    ? `Prix Leclerc du ${dateLisible(etat.prixData.maj.slice(0, 10), false)}${etat.prixData.magasin?.nom ? ` (${echapper(etat.prixData.magasin.nom)})` : ''}`
    : 'Pas encore de prix du Drive : les totaux utilisent les prix de tes tickets.';

  conteneur.innerHTML = `
    <div class="carte">
      <h3>Aujourd'hui · ${dateLisible(auj)}</h3>
      ${blocRepas}
    </div>
    ${blocPeremption}
    <h2>Ajouter au stock</h2>
    <div class="boutons">
      <a class="bouton secondaire" href="#/scan">Code-barres</a>
      <a class="bouton secondaire" href="#/ticket">Ticket</a>
      <a class="bouton secondaire" href="#/frigo">Photo frigo</a>
    </div>
    <div class="boutons">
      <a class="bouton secondaire" href="#/recettes">Toutes les recettes</a>
    </div>
    <p class="doux petit centre">${etat.recettes.length} recettes · ${infoPrix}</p>
  `;
}
