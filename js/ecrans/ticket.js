// Photo du ticket de caisse : lecture (Tesseract dans le téléphone, ou Gemini),
// vérification, puis ajout au stock, à l'historique des dépenses et aux prix connus.

import { etat, sauver, titre, toast, aller } from '../etat.js';
import { euros, normaliser, devinerIngredient } from '../texte.js';
import { aujourdhui, convertir } from '../unites.js';
import { ajouter, nouvelId } from '../stock.js';
import { photoEnBase64, demanderGemini, geminiConfigure, CONSIGNE_TICKET } from '../gemini.js';
import { analyserTicket } from '../ticket-texte.js';
import { dessinerRevue } from './revue.js';

const URL_TESSERACT = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';

function chargerTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = URL_TESSERACT;
    s.onload = () => resolve(window.Tesseract);
    s.onerror = () => reject(new Error('Impossible de charger Tesseract (connexion internet nécessaire la première fois).'));
    document.head.appendChild(s);
  });
}

// Noir et blanc contrasté : Tesseract lit mieux les tickets thermiques.
function preparerPourOCR(canvas) {
  const ctx = canvas.getContext('2d');
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const gris = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    const v = gris > 150 ? 255 : gris < 90 ? 0 : (gris - 90) * (255 / 60);
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return canvas;
}

export async function afficher(conteneur) {
  titre('Photo du ticket');
  conteneur.innerHTML = `
    <div class="carte">
      <p>Prends le ticket bien à plat, en entier, avec une bonne lumière.</p>
      <label class="bouton large" for="photo" style="margin:0">Prendre / choisir la photo</label>
      <input type="file" id="photo" accept="image/*" capture="environment" hidden>
    </div>
    <div id="apercu"></div>
    <div id="lecture"></div>
    <div id="revue"></div>
  `;
  let photo = null;

  conteneur.querySelector('#photo').addEventListener('change', async (ev) => {
    const fichier = ev.target.files[0];
    if (!fichier) return;
    photo = await photoEnBase64(fichier, 2000);
    conteneur.querySelector('#apercu').innerHTML = `<img class="apercu" src="${photo.dataUrl}" alt="Ticket">`;
    conteneur.querySelector('#revue').innerHTML = '';
    conteneur.querySelector('#lecture').innerHTML = `
      <div class="boutons">
        <button id="lire-tesseract">Lire le ticket</button>
        ${geminiConfigure() ? '<button class="secondaire" id="lire-gemini">Lire avec Gemini</button>' : ''}
      </div>
      <p class="doux petit" id="progression">${geminiConfigure() ? 'Gemini est souvent plus précis sur les tickets abîmés.' : 'La lecture se fait dans ton téléphone.'}</p>`;

    conteneur.querySelector('#lire-tesseract').addEventListener('click', async () => {
      const prog = conteneur.querySelector('#progression');
      try {
        prog.textContent = 'Chargement de la lecture de texte…';
        const Tesseract = await chargerTesseract();
        const canvas = preparerPourOCR(photo.canvas);
        const res = await Tesseract.recognize(canvas, 'fra', {
          logger: (m) => {
            if (m.status === 'recognizing text') prog.textContent = `Lecture… ${Math.round(m.progress * 100)} %`;
          },
        });
        const analyse = analyserTicket(res.data.text, etat.ingredientsConnus);
        prog.textContent = `${analyse.articles.length} article(s) trouvé(s). Vérifie et corrige si besoin.`;
        montrerRevue(conteneur, analyse);
      } catch (e) {
        prog.textContent = e.message;
      }
    });

    conteneur.querySelector('#lire-gemini')?.addEventListener('click', async () => {
      const prog = conteneur.querySelector('#progression');
      prog.textContent = 'Envoi à Gemini…';
      try {
        const petite = await photoEnBase64(fichier, 1600);
        const r = await demanderGemini(CONSIGNE_TICKET, petite.base64);
        const articles = (r.articles || []).map((a) => ({
          libelle: a.libelle || '',
          nom: a.nom || a.libelle || '',
          ingredient: a.ingredient || devinerIngredient(a.nom || a.libelle || '', etat.ingredientsConnus),
          prix: Number(a.prix) || 0,
          qte: Number(a.qte) || 1,
          unite: ['g', 'ml', 'piece'].includes(a.unite) ? a.unite : 'piece',
        }));
        prog.textContent = `${articles.length} article(s) trouvé(s). Vérifie et corrige si besoin.`;
        montrerRevue(conteneur, { articles, total: Number(r.total) || null });
      } catch (e) {
        prog.textContent = e.message;
      }
    });
  });
}

function montrerRevue(conteneur, analyse) {
  const zone = conteneur.querySelector('#revue');
  if (!analyse.articles.length) {
    zone.innerHTML = '<div class="alerte">Aucun article reconnu. Reprends la photo plus nette, ou ajoute les produits à la main.</div>';
    return;
  }
  const lignes = analyse.articles.map((a) => ({ ...a, coche: Boolean(a.ingredient) }));
  zone.innerHTML = `
    <div class="carte">
      <label for="total-ticket">Total payé (€)</label>
      <input type="number" id="total-ticket" step="0.01" min="0" value="${analyse.total ?? ''}">
      <p class="doux petit">Somme des articles lus : <span id="somme"></span>. Décoche ce qui ne va pas dans le stock (produits d'entretien…), le prix compte quand même dans la dépense.</p>
    </div>
    <div id="lignes"></div>
    <button class="large" id="enregistrer">Enregistrer</button>
  `;
  const lire = dessinerRevue(zone.querySelector('#lignes'), lignes, { avecPrix: true });
  const majSomme = () => {
    const somme = lire().reduce((s, l) => s + (l.prix || 0), 0);
    zone.querySelector('#somme').textContent = euros(somme);
  };
  zone.querySelector('#lignes').addEventListener('input', majSomme);
  majSomme();

  zone.querySelector('#enregistrer').addEventListener('click', async () => {
    const valeurs = lire();
    const auj = aujourdhui();
    let stock = etat.stock;
    const prixTickets = { ...etat.prixTickets };
    for (const v of valeurs) {
      if (v.garder && v.item.nom && v.item.qte > 0) stock = ajouter(stock, { ...v.item, source: 'ticket' });
      // Prix par unité, pour estimer les courses sans données du Drive.
      if (v.prix > 0 && v.item.qte > 0 && v.item.ingredient) {
        const base = v.item.unite === 'piece' ? 'piece' : 'g';
        const qte = convertir(v.item.qte, v.item.unite, base);
        if (qte > 0) prixTickets[normaliser(v.item.ingredient)] = { prixParUnite: v.prix / qte, unite: base, date: auj, produit: v.item.nom };
      }
    }
    const somme = valeurs.reduce((s, v) => s + (v.prix || 0), 0);
    const total = Number(zone.querySelector('#total-ticket').value) || somme;
    etat.stock = stock;
    etat.prixTickets = prixTickets;
    etat.historique.depenses.push({
      id: nouvelId(),
      date: auj,
      total: Math.round(total * 100) / 100,
      source: 'ticket',
      lignes: valeurs.map((v) => ({ nom: v.item.nom, prix: v.prix })),
    });
    await sauver('stock', 'prixTickets', 'historique');
    toast('Ticket enregistré');
    aller('stock');
  });
}
