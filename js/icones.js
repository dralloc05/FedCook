// Icônes dessinées (traits), utilisées dans tout l'appli.

const svg = (contenu, epaisseur = 2) =>
  `<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${epaisseur}" stroke-linecap="round" stroke-linejoin="round">${contenu}</svg>`;

export const ICONES = {
  reglages: svg('<path d="M4 7h10M18 7h2M4 17h2M10 17h10"></path><circle cx="16" cy="7" r="2"></circle><circle cx="8" cy="17" r="2"></circle>'),
  chevron: svg('<path d="M9 6l6 6-6 6"></path>', 2.2),
  bol: svg('<path d="M3 11h18a9 9 0 0 1-18 0z"></path><path d="M8 7c0-1 1-1.5 1-2.5M12 7c0-1 1-1.5 1-2.5M16 7c0-1 1-1.5 1-2.5"></path>', 1.8),
  poele: svg('<circle cx="10" cy="13" r="7"></circle><path d="M17 13h5"></path><path d="M7 11c1-1 2-1 3 0s2 1 3 0"></path>', 1.8),
  assiette: svg('<circle cx="12" cy="12" r="9"></circle><circle cx="12" cy="12" r="5"></circle>', 1.8),
  marmite: svg('<path d="M4 10h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z"></path><path d="M2 10h20M9 6h6M12 6V4"></path>', 1.8),
  codebarres: svg('<path d="M4 6v12M8 6v12M11 6v12M15 6v12M18 6v12M20 6v12"></path>'),
  ticket: svg('<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"></path><path d="M9 8h6M9 12h6"></path>'),
  frigo: svg('<rect x="5" y="2" width="14" height="20" rx="3"></rect><path d="M5 10h14M9 6v1M9 13v3"></path>'),
  plus: svg('<path d="M12 5v14M5 12h14"></path>', 2.2),
  coeur: svg('<path d="M12 20s-7-4.4-9-9a4.8 4.8 0 0 1 9-3 4.8 4.8 0 0 1 9 3c-2 4.6-9 9-9 9z"></path>'),
  coeurPlein: '<svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 20s-7-4.4-9-9a4.8 4.8 0 0 1 9-3 4.8 4.8 0 0 1 9 3c-2 4.6-9 9-9 9z"></path></svg>',
  livre: svg('<path d="M4 4h10a4 4 0 0 1 4 4v12H8a4 4 0 0 1-4-4z"></path><path d="M4 16a4 4 0 0 1 4-4h10"></path>'),
  graphique: svg('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"></path>'),
  profil: svg('<circle cx="12" cy="8" r="4"></circle><path d="M4 21a8 8 0 0 1 16 0"></path>'),
  sauvegarde: svg('<path d="M12 3v12M7 10l5 5 5-5"></path><path d="M4 17v3h16v-3"></path>'),
  lecture: '<svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"></path></svg>',
  horloge: svg('<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>'),
};

// Une icône de plat selon la recette, pour varier l'affichage.
const PLATS = ['bol', 'poele', 'assiette', 'marmite'];
export function iconePlat(id) {
  let h = 0;
  for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return ICONES[PLATS[h % PLATS.length]];
}
export function tuileNeutre(id) {
  let h = 7;
  for (const c of String(id)) h = (h * 17 + c.charCodeAt(0)) >>> 0;
  return h % 2 === 0;
}
