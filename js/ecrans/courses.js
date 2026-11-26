// Liste de courses du planning, chiffrée aux prix Leclerc, rangée par rayon.

import { etat, sauver, titre, toast, contextePrix, aller, libelleMagasin } from '../etat.js';
import { calculerCourses } from '../planning.js';
import { produitsPour, contenance, prixEffectif } from '../prix.js';
import { echapper, euros, normaliser, majuscule } from '../texte.js';
import { aujourdhui, afficherQuantite } from '../unites.js';
import { ajouter, nouvelId } from '../stock.js';
import { peremptionParDefaut } from '../peremption.js';
import { emplacementParDefaut } from './ajout-stock.js';

function calculer() {
  return calculerCourses({
    recettes: etat.recettes,
    profil: etat.profil,
    stock: etat.stock,
    ctxPrix: contextePrix(),
  }, etat.planning.repas);
}

function quantite(q, u) {
  return `${afficherQuantite(q, u)}${u === 'piece' ? ' pièce(s)' : ''}`;
}

export async function afficher(conteneur) {
  titre('Courses');
  if (!etat.planning) {
    conteneur.innerHTML = '<p class="vide">Pas encore de planning.</p><a class="bouton large" href="#/planning">Préparer un planning</a>';
    return;
  }
  dessiner(conteneur);
}

function dessiner(conteneur) {
  const res = calculer();
  const coches = new Set(etat.coches || []);
  const budget = etat.planning.budget || 0;
  const depasse = budget > 0 && res.total > budget + 0.01;
  const rayons = [...new Set(res.lignes.map((l) => l.rayon))];
  const ctx = contextePrix();

  const ligneHTML = (l) => {
    const cle = normaliser(l.nom);
    const fait = coches.has(cle);
    // « ≈ » : produit proche ou quantité estimée, le prix est une estimation.
    const produit = l.produit
      ? `${l.approx ? '≈ ' : ''}${echapper(l.produit.nom)}${l.produit.format ? ` · ${echapper(l.produit.format)}` : ''}`
      : l.source === 'ticket' ? 'Prix de ton dernier ticket' : 'Prix inconnu';
    const detailPrix = l.source === 'drive'
      ? `${l.paquets} × ${euros(prixEffectif(l.produit))}${l.produit.prixPromo ? ' <span class="pastille orange">promo</span>' : ''}`
      : l.source === 'ticket' ? 'estimation' : '';
    return `<div class="coche ${fait ? 'faite' : ''}">
      <input type="checkbox" data-cocher="${echapper(cle)}" ${fait ? 'checked' : ''} aria-label="Pris : ${echapper(l.nom)}">
      <div class="grandit">
        <div class="nom-course">${echapper(majuscule(l.nom))} <span class="doux" style="font-weight:600">· ${quantite(l.manque, l.unite)}</span></div>
        <div class="doux petit" style="margin-top:2px">${produit}${detailPrix ? ` · ${detailPrix}` : ''}</div>
        ${produitsPour(ctx, l.nom).length > 1 ? `<button class="lien-bouton" data-produits="${echapper(l.nom)}" style="margin-top:6px">Autre produit</button>` : ''}
        <div data-choix-zone="${echapper(cle)}"></div>
      </div>
      <div class="prix-ligne">${l.source === 'inconnu' ? '?' : euros(l.cout)}</div>
    </div>`;
  };

  conteneur.innerHTML = `
    <div class="carte">
      <span class="surtitre">Total estimé${libelleMagasin() ? ` · ${echapper(libelleMagasin())}` : ''}</span>
      <div class="total-ligne" style="margin-top:8px">
        <span class="gros-chiffre" style="${depasse ? 'color:var(--rouge)' : ''}">${euros(res.total)}</span>
        ${budget > 0 ? `<span class="doux" style="font-size:16px;font-weight:600">sur ${euros(budget)}</span>` : ''}
      </div>
      ${budget > 0 ? `<div class="jauge ${depasse ? 'depasse' : ''}" style="margin-bottom:4px"><div style="width:${Math.min(100, Math.round((res.total / budget) * 100))}%"></div></div>` : ''}
    </div>
    ${res.inconnus ? `<div class="alerte">${res.inconnus} produit(s) sans prix : le total est sous-estimé.</div>` : ''}
    ${!etat.prixData?.maj ? '<div class="alerte">Les prix du Drive ne sont pas encore récupérés. Les prix viennent de tes tickets quand ils sont connus.</div>' : ''}
    ${res.lignes.length === 0 ? '<p class="vide">Tout est déjà dans ton stock.</p>' : ''}
    ${rayons.map((r) => `<h2>${echapper(r)}</h2><div class="carte serree">${res.lignes.filter((l) => l.rayon === r).map(ligneHTML).join('')}</div>`).join('')}
    ${res.dejaEnStock.length ? `<details class="carte" style="margin-top:20px"><summary>Déjà dans ton stock (${res.dejaEnStock.length})</summary>
      <ul class="liste">${res.dejaEnStock.map((b) => `<li>${echapper(majuscule(b.nom))} <span class="doux petit">— ${quantite(b.qte, b.unite)}</span></li>`).join('')}</ul></details>` : ''}
    ${res.lignes.length ? `
      <div class="carte" style="margin-top:20px">
        <h3>Après les courses</h3>
        <p class="doux petit">Le plus précis : prends le ticket en photo, il remplit le stock avec les vrais prix. Sinon, « Courses faites » ajoute au stock ce qui est coché, avec les prix estimés.</p>
        <div class="boutons">
          <a class="bouton" href="#/ticket">Photo du ticket</a>
          <button class="secondaire" id="courses-faites">Courses faites</button>
        </div>
        <div id="confirmation"></div>
      </div>` : ''}
  `;

  conteneur.querySelectorAll('[data-cocher]').forEach((c) => {
    c.addEventListener('change', async () => {
      const ens = new Set(etat.coches || []);
      if (c.checked) ens.add(c.dataset.cocher); else ens.delete(c.dataset.cocher);
      etat.coches = [...ens];
      c.closest('.coche').classList.toggle('faite', c.checked);
      await sauver('coches');
    });
  });

  conteneur.querySelectorAll('[data-produits]').forEach((b) => {
    b.addEventListener('click', () => montrerChoix(conteneur, b.dataset.produits));
  });

  conteneur.querySelector('#courses-faites')?.addEventListener('click', () => {
    const n = res.lignes.filter((l) => coches.has(normaliser(l.nom))).length;
    const zone = conteneur.querySelector('#confirmation');
    if (n === 0) {
      zone.innerHTML = '<p class="alerte">Coche d\'abord les produits que tu as achetés.</p>';
      return;
    }
    const montant = res.lignes.filter((l) => coches.has(normaliser(l.nom))).reduce((s, l) => s + (l.cout || 0), 0);
    zone.innerHTML = `
      <label class="ligne" style="font-weight:400"><input type="checkbox" id="avec-depense" checked> Enregistrer la dépense (${euros(montant)} estimés)</label>
      <button class="large" id="valider-courses">Ajouter ${n} produit(s) au stock</button>`;
    zone.querySelector('#valider-courses').addEventListener('click', async () => {
      const auj = aujourdhui();
      let stock = etat.stock;
      for (const l of res.lignes) {
        if (!coches.has(normaliser(l.nom))) continue;
        stock = ajouter(stock, {
          id: nouvelId(),
          nom: l.produit ? l.produit.nom : majuscule(l.nom),
          ingredient: l.nom,
          qte: l.qteAchetee || l.manque,
          unite: l.uniteAchat || l.unite,
          gParPiece: l.g || null,
          emplacement: emplacementParDefaut(l.nom),
          peremption: peremptionParDefaut(l.nom, auj),
          ajout: auj,
          source: 'courses',
        });
      }
      etat.stock = stock;
      if (zone.querySelector('#avec-depense').checked) {
        etat.historique.depenses.push({ id: nouvelId(), date: auj, total: Math.round(montant * 100) / 100, source: 'estimation', lignes: [] });
      }
      etat.coches = [];
      await sauver('stock', 'historique', 'coches');
      toast('Stock mis à jour');
      aller('stock');
    });
  });
}

function montrerChoix(conteneur, nom) {
  const cle = normaliser(nom);
  const zone = conteneur.querySelector(`[data-choix-zone="${CSS.escape(cle)}"]`);
  if (!zone) return;
  if (zone.innerHTML) { zone.innerHTML = ''; return; }
  const produits = produitsPour(contextePrix(), nom);
  zone.innerHTML = `<ul class="liste">${produits.map((p) => {
    const c = contenance(p);
    const parKg = c && c.unite !== 'piece' ? ` · ${euros((prixEffectif(p) / c.qte) * 1000)}/${c.unite === 'g' ? 'kg' : 'L'}` : '';
    const choisi = String(etat.choix[cle]) === String(p.id);
    return `<li><label class="ligne" style="font-weight:400;margin:0">
      <input type="radio" name="choix-${echapper(cle)}" value="${echapper(p.id)}" ${choisi ? 'checked' : ''}>
      <span class="grandit">${echapper(p.nom)}${p.format ? ` <span class="doux petit">${echapper(p.format)}</span>` : ''}<br>
      <span class="doux petit">${euros(prixEffectif(p))}${parKg}${p.enStock === false ? ' · indisponible' : ''}</span></span>
    </label></li>`;
  }).join('')}
  <li><button class="petit secondaire" data-auto>Le moins cher au kilo (automatique)</button></li></ul>`;
  zone.querySelectorAll('input[type="radio"]').forEach((r) => {
    r.addEventListener('change', async () => {
      etat.choix = { ...etat.choix, [cle]: r.value };
      await sauver('choix');
      dessiner(conteneur);
    });
  });
  zone.querySelector('[data-auto]').addEventListener('click', async () => {
    const copie = { ...etat.choix };
    delete copie[cle];
    etat.choix = copie;
    await sauver('choix');
    dessiner(conteneur);
  });
}
