// Mode cuisine : une étape par écran, minuteurs, écran qui reste allumé.
// À la fin, les ingrédients utilisés sont retirés du stock.

import { etat, sauver, titre, toast, aller } from '../etat.js';
import { besoins, estProduitDeBase } from '../planning.js';
import { echapper } from '../texte.js';
import { aujourdhui } from '../unites.js';
import { retirer, nouvelId } from '../stock.js';
import { ligneIngredient } from './recette.js';

let verrou = null;
let minuteur = null;

async function garderEcranAllume() {
  try {
    if ('wakeLock' in navigator) verrou = await navigator.wakeLock.request('screen');
  } catch (e) {
    console.warn('Écran allumé impossible', e);
  }
}

export function quitter() {
  if (verrou) verrou.release().catch(() => {});
  verrou = null;
  if (minuteur) clearInterval(minuteur);
  minuteur = null;
  document.removeEventListener('visibilitychange', surVisibilite);
}

function surVisibilite() {
  if (document.visibilityState === 'visible' && !verrou) garderEcranAllume();
}

function sonner() {
  try {
    if (navigator.vibrate) navigator.vibrate([400, 200, 400, 200, 400]);
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.4, 0.8].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      o.connect(g);
      g.connect(ctx.destination);
      g.gain.setValueAtTime(0.25, ctx.currentTime + t);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.25);
    });
  } catch (e) {
    console.warn(e);
  }
}

function format(secondes) {
  const m = Math.floor(secondes / 60);
  const s = secondes % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export async function afficher(conteneur, params) {
  const r = etat.parId.get(params[0]);
  if (!r) {
    conteneur.innerHTML = '<p class="vide">Recette introuvable.</p>';
    return;
  }
  const personnes = Math.max(1, Number(params[1]) || etat.profil.personnes || 2);
  const indexPlanning = params[2] !== undefined ? Number(params[2]) : null;
  titre(r.titre);
  garderEcranAllume();
  document.addEventListener('visibilitychange', surVisibilite);

  const ingredients = besoins(r, personnes);
  const etapes = r.etapes || [];
  let position = 0; // 0 = ingrédients, 1..n = étapes

  const dessiner = () => {
    if (minuteur) { clearInterval(minuteur); minuteur = null; }
    const total = etapes.length + 1;
    const barre = `<div class="progression"><div style="width:${Math.round((position / Math.max(1, total - 1)) * 100)}%"></div></div>`;
    if (position === 0) {
      conteneur.innerHTML = `
        ${barre}
        <p class="doux" style="margin:10px 0 0">${personnes} personne${personnes > 1 ? 's' : ''} · ${r.temps || '?'} min · ${etapes.length} étapes</p>
        <div class="carte"><h3>Sors les ingrédients</h3><ul class="liste">${ingredients.map((i) => ligneIngredient(i)).join('')}</ul></div>
        <div class="boutons"><button class="secondaire" id="sortir">Quitter</button><button id="suivant">Commencer</button></div>`;
    } else {
      const e = etapes[position - 1];
      const derniere = position === etapes.length;
      conteneur.innerHTML = `
        ${barre}
        <p class="surtitre" style="margin:10px 0 0">Étape ${position} sur ${etapes.length}</p>
        <div class="etape-cuisine">${echapper(e.texte)}</div>
        ${e.min ? `<div class="carte centre"><div class="minuteur" id="temps">${format(e.min * 60)}</div><button class="secondaire" id="lancer">Lancer le minuteur (${e.min} min)</button></div>` : ''}
        <div class="boutons">
          <button class="secondaire" id="precedent">Précédent</button>
          ${derniere ? '<button id="fini">J\'ai fini</button>' : '<button id="suivant">Suivant</button>'}
        </div>`;
      if (e.min) {
        conteneur.querySelector('#lancer').addEventListener('click', (ev) => {
          let reste = e.min * 60;
          ev.currentTarget.disabled = true;
          const affichage = conteneur.querySelector('#temps');
          minuteur = setInterval(() => {
            reste -= 1;
            affichage.textContent = format(Math.max(0, reste));
            if (reste <= 0) {
              clearInterval(minuteur);
              minuteur = null;
              affichage.textContent = 'Terminé !';
              sonner();
            }
          }, 1000);
        });
      }
    }
    conteneur.querySelector('#suivant')?.addEventListener('click', () => { position += 1; dessiner(); });
    conteneur.querySelector('#precedent')?.addEventListener('click', () => { position -= 1; dessiner(); });
    conteneur.querySelector('#sortir')?.addEventListener('click', () => history.back());
    conteneur.querySelector('#fini')?.addEventListener('click', terminer);
  };

  const terminer = async () => {
    let stock = etat.stock;
    const manques = [];
    // Version « stock » : le riz cuit se retire du riz cru, etc.
    for (const ing of besoins(r, personnes, true)) {
      if (ing.qte <= 0 || estProduitDeBase(ing.nom, etat.profil)) continue;
      const res = retirer(stock, ing.nom, ing.qte, ing.unite, ing.g);
      stock = res.stock;
      if (res.manque > ing.qte * 0.05) manques.push(ing.nom);
    }
    etat.stock = stock;
    const auj = aujourdhui();
    const repas = indexPlanning !== null ? etat.planning?.repas?.[indexPlanning] : null;
    if (repas && repas.recetteId === r.id) repas.fait = true;
    etat.historique.plats.push({
      id: nouvelId(),
      date: auj,
      recetteId: r.id,
      titre: r.titre,
      moment: repas ? repas.moment : (new Date().getHours() < 16 ? 'midi' : 'soir'),
      personnes,
    });
    await sauver('stock', 'historique', 'planning');
    quitter();
    toast(manques.length ? `Bon appétit ! Pas trouvé dans le stock : ${manques.slice(0, 3).join(', ')}${manques.length > 3 ? '…' : ''}` : 'Bon appétit ! Stock mis à jour.', 4000);
    aller('accueil');
  };

  dessiner();
}
