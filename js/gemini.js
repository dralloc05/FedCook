// Appels à Gemini (offre gratuite de Google AI Studio) pour lire une photo.
// La clé API est tapée dans les réglages et reste dans le téléphone.

import { etat, MODELE_GEMINI_DEFAUT } from './etat.js';

// Réduit la photo (moins de données envoyées, réponse plus rapide).
export function photoEnBase64(fichier, tailleMax = 1280) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(fichier);
    img.onload = () => {
      const echelle = Math.min(1, tailleMax / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * echelle);
      canvas.height = Math.round(img.height * echelle);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      resolve({ base64: dataUrl.split(',')[1], dataUrl, canvas });
    };
    img.onerror = () => reject(new Error('Image illisible'));
    img.src = url;
  });
}

export function geminiConfigure() {
  return Boolean(etat.reglages.cleGemini);
}

export async function demanderGemini(consigne, base64) {
  const cle = etat.reglages.cleGemini;
  if (!cle) throw new Error('Ajoute ta clé Gemini dans Plus → Réglages.');
  const modele = etat.reglages.modeleGemini || MODELE_GEMINI_DEFAUT;
  const rep = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modele)}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cle },
    body: JSON.stringify({
      contents: [{ parts: [{ text: consigne }, { inline_data: { mime_type: 'image/jpeg', data: base64 } }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
    }),
  });
  const data = await rep.json().catch(() => ({}));
  if (!rep.ok) {
    const message = data?.error?.message || `erreur ${rep.status}`;
    if (rep.status === 429) throw new Error('Limite gratuite de Gemini atteinte pour le moment. Réessaie plus tard (le compteur du jour repart à 9h).');
    throw new Error(`Gemini : ${message}`);
  }
  const texte = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  try {
    return JSON.parse(texte);
  } catch (e) {
    const m = texte.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]);
    throw new Error('Réponse de Gemini illisible');
  }
}

export const CONSIGNE_FRIGO = `Tu regardes la photo d'un frigo, d'un congélateur ou d'un placard de cuisine.
Liste les aliments que tu peux identifier avec une bonne certitude. N'invente rien que tu ne vois pas.
Pour chaque aliment, estime une quantité raisonnable (exemple : une bouteille de lait entamée ≈ 500 ml, une boîte de 6 œufs = 6 pièces).
Réponds uniquement avec ce JSON :
{"produits":[{"nom":"nom lisible du produit","ingredient":"nom générique simple en français, au singulier, sans marque (ex : lardons, oeuf, lait, carotte)","qte":nombre,"unite":"g" ou "ml" ou "piece","confiance":nombre entre 0 et 1}]}`;

export const CONSIGNE_TICKET = `Tu regardes la photo d'un ticket de caisse E.Leclerc.
Extrais chaque article acheté. Ignore les lignes de TVA, de paiement, de carte de fidélité, de sous-total et de rendu monnaie.
Si une remise s'applique à un article, retire-la de son prix.
Réponds uniquement avec ce JSON :
{"articles":[{"libelle":"texte de la ligne du ticket","nom":"nom lisible du produit","ingredient":"nom générique simple en français, au singulier, sans marque (ex : lardons, oeuf, lait)","prix":prix total de la ligne en euros (nombre),"qte":quantité achetée (nombre, contenance totale si elle est indiquée),"unite":"g" ou "ml" ou "piece"}],"total":total payé en euros (nombre)}`;
