// Historique des dépenses et des plats cuisinés.

import { etat, sauver, titre, toast } from '../etat.js';
import { echapper, euros } from '../texte.js';
import { aujourdhui, ajouterJours, dateLisible, joursEntre } from '../unites.js';

function lundi(iso) {
  const [a, m, j] = iso.split('-').map(Number);
  const d = new Date(a, m - 1, j);
  const decalage = (d.getDay() + 6) % 7;
  return ajouterJours(iso, -decalage);
}

const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];

export async function afficher(conteneur, params) {
  titre('Historique');
  const onglet = params[0] === 'plats' ? 'plats' : 'depenses';
  conteneur.innerHTML = `
    <div class="boutons">
      <a class="bouton ${onglet === 'depenses' ? '' : 'secondaire'}" href="#/historique/depenses">Dépenses</a>
      <a class="bouton ${onglet === 'plats' ? '' : 'secondaire'}" href="#/historique/plats">Plats cuisinés</a>
    </div>
    <div id="zone"></div>`;
  const zone = conteneur.querySelector('#zone');
  if (onglet === 'plats') return dessinerPlats(zone);
  dessinerDepenses(zone);
}

function dessinerDepenses(zone) {
  const depenses = [...etat.historique.depenses].sort((a, b) => b.date.localeCompare(a.date));
  if (!depenses.length) {
    zone.innerHTML = '<p class="vide">Aucune dépense enregistrée. Prends tes tickets en photo, ou valide « Courses faites ».</p>';
    return;
  }
  const auj = aujourdhui();
  const semaines = [];
  for (let i = 7; i >= 0; i--) {
    const debut = lundi(ajouterJours(auj, -7 * i));
    const total = depenses.filter((d) => lundi(d.date) === debut).reduce((s, d) => s + d.total, 0);
    semaines.push({ debut, total });
  }
  const max = Math.max(1, ...semaines.map((s) => s.total));

  const parMois = new Map();
  for (const d of depenses) {
    const cle = d.date.slice(0, 7);
    parMois.set(cle, (parMois.get(cle) || 0) + d.total);
  }

  zone.innerHTML = `
    <div class="carte">
      <h3>Par semaine (8 dernières)</h3>
      <div class="barres">${semaines.map((s) => `<div class="barre" style="height:${Math.round((s.total / max) * 100)}%"><span>${s.total ? Math.round(s.total) : ''}</span></div>`).join('')}</div>
      <div class="legendes">${semaines.map((s) => `<span>${dateLisible(s.debut, false)}</span>`).join('')}</div>
      <p class="doux petit">Montants en euros, semaines commençant le lundi.</p>
    </div>
    <div class="carte">
      <h3>Par mois</h3>
      <ul class="liste">${[...parMois.entries()].map(([cle, total]) => {
        const [a, m] = cle.split('-').map(Number);
        return `<li class="ligne espace"><span>${MOIS[m - 1]} ${a}</span><span class="gras">${euros(total)}</span></li>`;
      }).join('')}</ul>
    </div>
    <div class="carte">
      <h3>Détail</h3>
      <ul class="liste">${depenses.map((d) => `
        <li>
          <div class="ligne espace">
            <span>${dateLisible(d.date)} <span class="pastille ${d.source === 'estimation' ? 'orange' : ''}">${d.source === 'estimation' ? 'estimé' : 'ticket'}</span></span>
            <span class="gras">${euros(d.total)}</span>
          </div>
          ${d.lignes?.length ? `<details><summary class="doux petit">${d.lignes.length} article(s)</summary><ul class="liste">${d.lignes.map((l) => `<li class="ligne espace petit"><span>${echapper(l.nom)}</span><span>${euros(l.prix)}</span></li>`).join('')}</ul></details>` : ''}
          <button class="petit danger" data-supprimer="${echapper(d.id)}">Supprimer</button>
        </li>`).join('')}</ul>
    </div>`;

  zone.querySelectorAll('[data-supprimer]').forEach((b) => {
    b.addEventListener('click', async () => {
      if (b.dataset.confirme !== 'oui') {
        b.dataset.confirme = 'oui';
        b.textContent = 'Confirmer la suppression';
        return;
      }
      etat.historique.depenses = etat.historique.depenses.filter((d) => d.id !== b.dataset.supprimer);
      await sauver('historique');
      toast('Dépense supprimée');
      dessinerDepenses(zone);
    });
  });
}

function dessinerPlats(zone) {
  const plats = [...etat.historique.plats].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 100);
  if (!plats.length) {
    zone.innerHTML = '<p class="vide">Aucun plat cuisiné pour l\'instant. Termine une recette en mode cuisine pour la voir ici.</p>';
    return;
  }
  const auj = aujourdhui();
  const ceMois = plats.filter((p) => joursEntre(p.date, auj) <= 30).length;
  zone.innerHTML = `
    <p class="doux">${ceMois} plat(s) cuisiné(s) ces 30 derniers jours.</p>
    <div class="carte"><ul class="liste">${plats.map((p) => `
      <li><a href="#/recette/${encodeURIComponent(p.recetteId)}/${p.personnes || 2}" class="ligne espace" style="color:inherit;text-decoration:none">
        <span class="grandit"><span class="gras">${echapper(p.titre)}</span><br><span class="doux petit">${dateLisible(p.date)} · ${p.moment === 'midi' ? 'midi' : 'soir'} · ${p.personnes} pers.</span></span>
        <span>›</span>
      </a></li>`).join('')}</ul></div>`;
}
