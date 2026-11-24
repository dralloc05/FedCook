// Photo du frigo ou d'un placard : Gemini liste les aliments, tu vérifies, puis ajout au stock.

import { etat, sauver, titre, toast, aller } from '../etat.js';
import { devinerIngredient } from '../texte.js';
import { ajouter } from '../stock.js';
import { photoEnBase64, demanderGemini, geminiConfigure, CONSIGNE_FRIGO } from '../gemini.js';
import { dessinerRevue } from './revue.js';

export async function afficher(conteneur) {
  titre('Photo du frigo');
  if (!geminiConfigure()) {
    conteneur.innerHTML = `
      <div class="alerte">La reconnaissance des aliments passe par Gemini (offre gratuite de Google).
      Crée une clé sur Google AI Studio, puis colle-la dans <b>Plus → Réglages</b>.</div>
      <a class="bouton large" href="#/reglages">Aller aux réglages</a>`;
    return;
  }
  conteneur.innerHTML = `
    <div class="carte">
      <p>Ouvre bien la porte, une étagère par photo si besoin. Les aliments cachés ne seront pas vus.</p>
      <label class="bouton large" for="photo" style="margin:0">Prendre / choisir la photo</label>
      <input type="file" id="photo" accept="image/*" capture="environment" hidden>
    </div>
    <div id="apercu"></div>
    <p class="doux petit" id="progression"></p>
    <div id="revue"></div>
  `;

  conteneur.querySelector('#photo').addEventListener('change', async (ev) => {
    const fichier = ev.target.files[0];
    if (!fichier) return;
    const prog = conteneur.querySelector('#progression');
    const photo = await photoEnBase64(fichier, 1280);
    conteneur.querySelector('#apercu').innerHTML = `<img class="apercu" src="${photo.dataUrl}" alt="Photo du frigo">`;
    conteneur.querySelector('#revue').innerHTML = '';
    prog.textContent = 'Analyse de la photo par Gemini…';
    try {
      const r = await demanderGemini(CONSIGNE_FRIGO, photo.base64);
      const lignes = (r.produits || []).map((p) => ({
        nom: p.nom || p.ingredient || '',
        ingredient: p.ingredient || devinerIngredient(p.nom || '', etat.ingredientsConnus),
        qte: Number(p.qte) || 1,
        unite: ['g', 'ml', 'piece'].includes(p.unite) ? p.unite : 'piece',
        coche: (Number(p.confiance) || 1) >= 0.5,
      }));
      if (!lignes.length) {
        prog.textContent = 'Aucun aliment reconnu. Essaie avec une photo plus nette et mieux éclairée.';
        return;
      }
      prog.textContent = `${lignes.length} aliment(s) reconnu(s). Vérifie les quantités et les dates avant d'ajouter.`;
      const zone = conteneur.querySelector('#revue');
      zone.innerHTML = '<div id="lignes"></div><button class="large" id="ajouter">Ajouter au stock</button>';
      const lire = dessinerRevue(zone.querySelector('#lignes'), lignes);
      zone.querySelector('#ajouter').addEventListener('click', async () => {
        let stock = etat.stock;
        let n = 0;
        for (const v of lire()) {
          if (v.garder && v.item.nom && v.item.qte > 0) {
            stock = ajouter(stock, { ...v.item, source: 'photo' });
            n += 1;
          }
        }
        etat.stock = stock;
        await sauver('stock');
        toast(`${n} produit(s) ajouté(s)`);
        aller('stock');
      });
    } catch (e) {
      prog.textContent = e.message;
    }
  });
}
