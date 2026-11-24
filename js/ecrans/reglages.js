// Réglages : clé Gemini, sauvegarde et restauration des données.

import { etat, sauver, titre, toast, MODELE_GEMINI_DEFAUT } from '../etat.js';
import { toutLire, toutRemplacer } from '../db.js';
import { echapper } from '../texte.js';
import { aujourdhui } from '../unites.js';

export async function afficher(conteneur) {
  titre('Réglages');
  const r = etat.reglages;
  conteneur.innerHTML = `
    <form id="form-gemini" class="carte">
      <h3>Gemini (photo du frigo, lecture des tickets)</h3>
      <p class="doux petit">Crée une clé gratuite sur <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Google AI Studio</a>, sans ajouter de carte bancaire. Elle reste enregistrée dans ce téléphone uniquement. Sur l'offre gratuite, Google peut utiliser les photos envoyées pour améliorer ses produits.</p>
      <label for="cle">Clé API</label>
      <input type="password" id="cle" autocomplete="off" value="${echapper(r.cleGemini || '')}" placeholder="Colle ta clé ici">
      <label for="modele">Modèle</label>
      <input type="text" id="modele" value="${echapper(r.modeleGemini || MODELE_GEMINI_DEFAUT)}">
      <p class="doux petit">Par défaut : ${MODELE_GEMINI_DEFAUT}. Change-le seulement si Google le retire.</p>
      <button type="submit" class="large">Enregistrer</button>
    </form>

    <div class="carte">
      <h3>Sauvegarde</h3>
      <p class="doux petit">Tes données (stock, profil, historique…) sont dans ce navigateur. Fais une sauvegarde de temps en temps, et avant de passer à la version APK.</p>
      <div class="boutons">
        <button id="exporter">Télécharger une sauvegarde</button>
        <label class="bouton secondaire" for="fichier-import" style="margin:0">Restaurer</label>
        <input type="file" id="fichier-import" accept="application/json" hidden>
      </div>
    </div>

    <div class="carte">
      <h3>Tout effacer</h3>
      <p class="doux petit">Efface le stock, le planning, l'historique et le profil de ce téléphone.</p>
      <button class="danger large" id="effacer">Tout effacer</button>
    </div>
  `;

  conteneur.querySelector('#form-gemini').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    etat.reglages = {
      ...etat.reglages,
      cleGemini: conteneur.querySelector('#cle').value.trim(),
      modeleGemini: conteneur.querySelector('#modele').value.trim() || MODELE_GEMINI_DEFAUT,
    };
    await sauver('reglages');
    toast('Réglages enregistrés');
  });

  conteneur.querySelector('#exporter').addEventListener('click', async () => {
    const donnees = await toutLire();
    // La clé Gemini ne part pas dans la sauvegarde.
    if (donnees.reglages) donnees.reglages = { ...donnees.reglages, cleGemini: '' };
    const blob = new Blob([JSON.stringify({ format: 'appli-repas', version: 1, date: aujourdhui(), donnees }, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sauvegarde-fedcook-${aujourdhui()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  });

  conteneur.querySelector('#fichier-import').addEventListener('change', async (ev) => {
    const fichier = ev.target.files[0];
    if (!fichier) return;
    try {
      const contenu = JSON.parse(await fichier.text());
      if (contenu.format !== 'appli-repas' || !contenu.donnees) throw new Error('Ce fichier n\'est pas une sauvegarde de l\'appli.');
      const cle = etat.reglages.cleGemini;
      const donnees = contenu.donnees;
      donnees.reglages = { ...(donnees.reglages || {}), cleGemini: cle };
      await toutRemplacer(donnees);
      toast('Sauvegarde restaurée');
      setTimeout(() => location.reload(), 800);
    } catch (e) {
      toast(e.message || 'Fichier illisible');
    }
  });

  const effacer = conteneur.querySelector('#effacer');
  effacer.addEventListener('click', async () => {
    if (effacer.dataset.confirme !== 'oui') {
      effacer.dataset.confirme = 'oui';
      effacer.textContent = 'Appuie encore pour confirmer';
      return;
    }
    await toutRemplacer({});
    location.hash = '';
    location.reload();
  });
}
