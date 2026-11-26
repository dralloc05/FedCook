# FedCook — appli perso de planning de repas

Appli web (installable sur Android) qui propose les repas du midi et du soir pour 1 à 7 jours,
à partir de ce qu'il y a dans le frigo et les placards, avec la liste de courses chiffrée
aux prix des Leclerc Drive voisins de Carpentras.

Tout est gratuit sauf la traduction des recettes (environ 3 à 6 $, une seule fois, sur ton crédit Claude).

## Ce que contient le dossier

| Dossier / fichier | Rôle |
| --- | --- |
| `index.html`, `css/`, `js/` | L'appli (aucune installation, aucun serveur) |
| `data/recettes.json` | Les recettes (30 recettes d'exemple pour tester, puis les recettes traduites) |
| `data/prix.json` | Les prix Leclerc, mis à jour chaque semaine automatiquement |
| `outils/recettes/traduire_recettes.py` | Script qui traduit une grosse base de recettes avec l'API Claude |
| `outils/prix/maj_prix.py` | Programme qui récupère les prix via Apify |
| `.github/workflows/` | Les tâches automatiques de GitHub (publier l'appli, prix du lundi) |
| `tests/tests.js` | Tests de la logique : `node tests/tests.js` |

---

## 1. Mettre l'appli en ligne (GitHub Pages)

1. Crée un dépôt **public** sur GitHub, ici `FedCook`.
2. Envoie tous les fichiers du dossier dedans. En ligne de commande, depuis le dossier :
   ```
   git init
   git add .
   git commit -m "Première version"
   git branch -M main
   git remote add origin https://github.com/TON-PSEUDO/FedCook.git
   git push -u origin main
   ```
   Le dossier `.github` est caché sur certains ordinateurs : vérifie qu'il est bien parti
   (il doit apparaître dans le dépôt sur github.com).
3. Sur github.com, dans le dépôt : **Settings → Pages → Build and deployment → Source : GitHub Actions**.
4. Va dans l'onglet **Actions**, ouvre « Publier l'appli » et clique **Run workflow** (la première fois seulement).
5. Après une minute, l'appli est en ligne à l'adresse `https://TON-PSEUDO.github.io/FedCook/`.

## 2. L'installer sur ton téléphone

1. Ouvre l'adresse dans **Chrome** sur ton Android.
2. Menu ⋮ → **Ajouter à l'écran d'accueil** (ou **Installer l'application**).
3. Au premier lancement, réponds aux questions (restrictions, goûts, matériel, produits de base).

Le scan de code-barres utilise le lecteur intégré à Chrome sur Android. Avec un autre navigateur,
tu peux taper le code à la main.

## 3. La photo du frigo et la lecture des tickets par Gemini

1. Va sur https://aistudio.google.com/apikey, connecte-toi avec ton compte Google, **Create API key**.
   N'ajoute pas de carte bancaire : le projet resterait sur l'offre gratuite.
2. Dans l'appli : **Plus → Réglages**, colle la clé, **Enregistrer**.

La clé reste dans ton téléphone, jamais dans le dépôt. Sur l'offre gratuite, Google peut utiliser
les photos envoyées pour améliorer ses produits, et le nombre de requêtes par jour est limité
(environ 500 par jour pour les modèles Flash-Lite, d'après les relevés de développeurs ; ça change parfois).
Le modèle par défaut est `gemini-3.5-flash-lite` ; tu peux le changer dans les réglages si Google le retire.

La lecture du ticket marche aussi sans Gemini (bouton « Lire le ticket », avec Tesseract, directement dans le téléphone).

## 4. Les prix du Leclerc Drive (Apify, chaque lundi)

Il n'y a pas de Leclerc Drive à Carpentras : on relève les prix de 2 ou 3 Drives voisins
et l'appli utilise leur **moyenne**. Une promo n'est gardée que si tous les Drives l'affichent.

Le site Leclerc Drive bloque les programmes automatiques. On passe donc par l'outil
« E.Leclerc Drive Scraper » sur Apify, qui sait le lire. Le plan gratuit d'Apify donne 5 $ par mois.

1. Crée un compte sur https://apify.com (plan gratuit, sans carte).
2. Récupère ton jeton : **Console Apify → Settings → API & Integrations → Personal API tokens**.
3. Dans ton dépôt GitHub : **Settings → Secrets and variables → Actions → New repository secret**,
   nom `APIFY_TOKEN`, valeur = ton jeton.
4. Trouve les numéros des Drives : sur leclercdrive.fr, tape 84200, ouvre chaque Drive voisin ;
   le numéro à 6 chiffres est dans l'adresse de la page, après `magasin-`.
5. **Settings → Secrets and variables → Actions → Variables → New repository variable**,
   nom `MAGASIN_ID`, valeur = les numéros séparés par des virgules (ex. : `123456, 234567`).
6. Onglet **Actions → Prix Leclerc → Run workflow** pour le premier lancement.

Ensuite, ça tourne tout seul chaque lundi matin. Si un Drive échoue, GitHub t'envoie un e-mail :
les prix des autres Drives sont quand même enregistrés. `data/prix-drives.json` garde les prix
de chaque Drive, `data/prix.json` la moyenne que l'appli lit.

**Coût** : le premier lancement relève environ 150 ingrédients × 3 produits = 450 produits
par Drive (environ 0,60 à 0,75 $ par Drive). Les semaines suivantes, seuls les prix qui ont changé
sont facturés. Chaque lancement est plafonné à 1,50 $. Avec 5 $ gratuits par mois, reste à 2 ou 3 Drives.
Si ton compte Apify sert aussi à autre chose, les 5 $ sont partagés. Quand le crédit est épuisé,
Apify bloque jusqu'au mois suivant, sans facture.

Réglages possibles (variables du dépôt) : `NB_INGREDIENTS` (150), `PAR_INGREDIENT` (3), `PLAFOND_USD` (1.5).

## 5. Les recettes (API Claude, une seule fois)

Sur ton PC, avec Python installé :

1. Installe les bibliothèques :
   ```
   pip install -r outils/recettes/requirements.txt
   ```
2. Télécharge une base de recettes anglaises. Par exemple, sur
   https://huggingface.co/datasets/corbt/all-recipes → **Files and versions → data**,
   télécharge un seul fichier `.parquet` (environ 130 Mo, plusieurs centaines de milliers de recettes).
   La licence de cette base n'est pas indiquée : garde le résultat pour ton usage perso.
3. Mets ta clé API Claude dans le terminal (jamais dans un fichier du dépôt). Sous Windows (PowerShell) :
   ```
   $env:ANTHROPIC_API_KEY="ta-clé"
   ```
4. Choisis les recettes (desserts et doublons écartés automatiquement) :
   ```
   python outils/recettes/traduire_recettes.py preparer chemin/vers/fichier.parquet --nombre 15000
   ```
5. Test sur 100 recettes :
   ```
   python outils/recettes/traduire_recettes.py envoyer --test 100
   python outils/recettes/traduire_recettes.py suivre
   python outils/recettes/traduire_recettes.py recuperer
   ```
   `recuperer` affiche le coût estimé. Vérifie le vrai montant dans la console Claude,
   et regarde quelques recettes dans l'appli (envoie d'abord `data/` sur GitHub).
6. Si c'est bon, envoie le reste, puis récupère le lendemain :
   ```
   python outils/recettes/traduire_recettes.py envoyer
   python outils/recettes/traduire_recettes.py recuperer
   ```
   Ton PC peut rester éteint entre les deux : le traitement se fait chez Anthropic
   (moins de 24 heures) et les résultats restent disponibles 29 jours.
7. Envoie les nouvelles recettes sur GitHub :
   ```
   git add data/recettes.json data/ingredients.json
   git commit -m "Recettes traduites"
   git push
   ```
8. Relance **Actions → Prix Leclerc → Run workflow** pour récupérer les prix des nouveaux ingrédients.

## 6. Mettre à jour le code de l'appli

Après chaque modification du code, change `VERSION` en haut de `sw.js` (`v1` → `v2`…),
sinon le téléphone peut garder l'ancienne version en cache.

## 7. Sauvegarde

Tes données (stock, profil, historique) sont dans le navigateur du téléphone.
**Plus → Réglages → Télécharger une sauvegarde** de temps en temps, et surtout avant de passer à la version APK.

## 8. L'APK Android

Le dossier `android/` contient une petite appli Android qui affiche le site dans une fenêtre
(caméra, photos, sauvegarde et bouton retour gérés). GitHub la construit : workflow « APK Android ».
Quand le site change, l'APK se met à jour tout seul : pas besoin de le refaire.

1. Secrets du dépôt (une seule fois) : `ANDROID_KEYSTORE_B64` et `ANDROID_KEY_PASSWORD`
   (la clé de signature). Garde-les : sans la même clé, impossible de mettre l'appli à jour
   sans la désinstaller.
2. Actions → APK Android → Run workflow (il se lance aussi quand `android/` change).
3. Sur le téléphone : https://github.com/dralloc05/FedCook/releases/download/apk/FedCook.apk
4. Les données de l'APK sont séparées de celles de Chrome : sauvegarde dans la version Chrome,
   puis Réglages → Restaurer dans l'APK.

## 9. Recettes ajoutées à la main et plats tendance

- `data/recettes-maison.json` : tes recettes à toi (les French tacos, par exemple). Même format que
  `recettes.json`, mais dans un fichier à part : la traduction ne l'écrase jamais.
- Le planning met en avant les plats populaires ou tendance (liste des familles dans `js/popularite.js`,
  à compléter si un plat te manque) et évite deux plats de la même famille dans la semaine.
- Les préparations de base (pâte à pizza, sauces, riz nature, purée seule…) ne sont jamais proposées comme repas.

## 10. Formats de data/prix.json acceptés

- Relevé par ingrédient (`ingredients`), celui du workflow « Prix Leclerc » ;
- ou catalogue complet du magasin (`produits`, avec `nom`, `format`, `prix`, `prixUnite`, `unite`, `rayon`,
  `famille`, `sousFamille`) : l'appli cherche elle-même les produits de chaque ingrédient (`js/catalogue.js`).

## Limites connues

- 1 ml est compté comme 1 g pour passer de l'un à l'autre (approximation).
- Les prix du Drive peuvent différer de ceux du magasin : le prix de ton dernier ticket sert pour les produits sans prix Drive.
- Les quantités vues sur une photo du frigo sont des estimations : vérifie-les avant d'ajouter.
- Le choix du produit Leclerc pour un ingrédient est automatique (le moins cher au kilo parmi les premiers résultats) ;
  tu peux le changer dans la liste de courses (« Autre produit »), l'appli s'en souvient.
