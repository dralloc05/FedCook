// Scan d'un code-barres avec la caméra, puis infos produit via Open Food Facts.

import { titre, toast, aller } from '../etat.js';
import { parserFormat } from '../unites.js';
import { preparer } from './ajout-stock.js';

let flux = null;
let boucle = null;

export function quitter() {
  if (boucle) clearInterval(boucle);
  boucle = null;
  if (flux) flux.getTracks().forEach((t) => t.stop());
  flux = null;
}

export async function chercherProduit(code) {
  const url = `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,product_name_fr,brands,quantity,product_quantity,product_quantity_unit`;
  const rep = await fetch(url);
  if (!rep.ok) throw new Error(`Open Food Facts : erreur ${rep.status}`);
  const data = await rep.json();
  if (data.status !== 1 || !data.product) return null;
  const p = data.product;
  const nom = (p.product_name_fr || p.product_name || '').trim();
  const marque = (p.brands || '').split(',')[0].trim();
  let contenu = null;
  const q = Number(p.product_quantity);
  const u = String(p.product_quantity_unit || '').toLowerCase();
  if (q > 0 && (u === 'g' || u === 'ml')) contenu = { qte: q, unite: u };
  if (!contenu) contenu = parserFormat(p.quantity);
  return {
    nom: [nom, marque && !nom.toLowerCase().includes(marque.toLowerCase()) ? marque : ''].filter(Boolean).join(' '),
    qte: contenu ? contenu.qte : '',
    unite: contenu ? contenu.unite : 'piece',
    ean: code,
    source: 'code-barres',
  };
}

async function traiterCode(code, conteneur) {
  quitter();
  conteneur.querySelector('#etat-scan').textContent = `Code ${code} : recherche du produit…`;
  try {
    const produit = await chercherProduit(code);
    if (!produit || !produit.nom) {
      toast('Produit inconnu d\'Open Food Facts : complète à la main');
      preparer({ nom: '', ean: code, source: 'code-barres' });
    } else {
      preparer(produit);
    }
  } catch (e) {
    toast('Pas de connexion à Open Food Facts : complète à la main');
    preparer({ nom: '', ean: code, source: 'code-barres' });
  }
  aller('ajout-stock');
}

export async function afficher(conteneur) {
  titre('Scanner un code-barres');
  conteneur.innerHTML = `
    <video class="camera" id="video" playsinline muted></video>
    <p id="etat-scan" class="doux centre">Démarrage de la caméra…</p>
    <form id="form-code" class="carte">
      <label for="code">Ou tape le code-barres</label>
      <div class="ligne">
        <input type="text" id="code" inputmode="numeric" pattern="[0-9]{8,14}" placeholder="ex : 3017620422003" class="grandit">
        <button type="submit">OK</button>
      </div>
    </form>
  `;
  conteneur.querySelector('#form-code').addEventListener('submit', (ev) => {
    ev.preventDefault();
    const code = conteneur.querySelector('#code').value.replace(/\D/g, '');
    if (code.length >= 8) traiterCode(code, conteneur);
  });

  const etatScan = conteneur.querySelector('#etat-scan');
  if (!('BarcodeDetector' in window)) {
    etatScan.textContent = 'Ce navigateur ne sait pas lire les codes-barres avec la caméra. Utilise Chrome sur Android, ou tape le code.';
    return;
  }
  try {
    flux = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
  } catch (e) {
    etatScan.textContent = 'Accès à la caméra refusé. Autorise-le dans les réglages du navigateur, ou tape le code.';
    return;
  }
  const video = conteneur.querySelector('#video');
  video.srcObject = flux;
  await video.play();
  etatScan.textContent = 'Vise le code-barres du produit.';
  const detecteur = new window.BarcodeDetector({ formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e'] });
  let occupe = false;
  boucle = setInterval(async () => {
    if (occupe || !flux) return;
    occupe = true;
    try {
      const codes = await detecteur.detect(video);
      if (codes.length) {
        if (navigator.vibrate) navigator.vibrate(80);
        traiterCode(codes[0].rawValue, conteneur);
      }
    } catch (e) {
      console.warn(e);
    } finally {
      occupe = false;
    }
  }, 250);
}
