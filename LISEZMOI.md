# FedCook — appli perso de planning de repas

Appli web (installable sur Android) qui propose les repas du midi et du soir pour 1 à 7 jours,
à partir de ce qu'il y a dans le frigo et les placards, avec la liste de courses chiffrée
aux prix du Leclerc Drive de Carpentras.

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

Le site Leclerc Drive bloque les programmes automatiques. On passe donc par l'outil
« E.Leclerc Drive Scraper » sur Apify, qui sait le lire. Le plan gratuit d'Apify donne 5 $ par mois.

1. Crée un compte sur https://apify.com (plan gratuit, sans carte).
2. Récupère ton jeton : **Console Apify → Settings → API & Integrations → Personal API tokens**.
3. Dans ton dépôt GitHub : **Settings → Secrets and variables → Actions → New repository secret**,
   nom `APIFY_TOKEN`, valeur = ton jeton.
4. Onglet **Actions → Prix Leclerc → Run workflow** pour le premier lancement.
5. Ouvre le lancement terminé et lis la ligne `data/prix.json : … — Drive XXXXXX Carpentras`.
   Copie ce numéro à 6 chiffres dans une variable : **Settings → Secrets and variables → Actions → Variables
   → New repository variable**, nom `MAGASIN_ID`. Comme ça, on est sûr de toujours viser ton Drive.

Ensuite, ça tourne tout seul chaque lundi matin. Si un lancement échoue (Drive introuvable,
outil Apify en panne…), GitHub t'envoie un e-mail et `data/prix.json` n'est pas modifié.

**Coût** : le premier lancement relève environ 150 ingrédients × 3 produits = 450 produits
(environ 0,75 $). Les semaines suivantes, seuls les prix qui ont changé sont facturés.
Chaque lancement est plafonné à 1,50 $. Si ton compte Apify sert aussi à autre chose,
les 5 $ gratuits sont partagés. Quand le crédit est épuisé, Apify bloque jusqu'au mois suivant, sans facture.

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

## Limites connues

- 1 ml est compté comme 1 g pour passer de l'un à l'autre (approximation).
- Les prix du Drive peuvent différer de ceux du magasin : le prix de ton dernier ticket sert pour les produits sans prix Drive.
- Les quantités vues sur une photo du frigo sont des estimations : vérifie-les avant d'ajouter.
- Le choix du produit Leclerc pour un ingrédient est automatique (le moins cher au kilo parmi les premiers résultats) ;
  tu peux le changer dans la liste de courses (« Autre produit »), l'appli s'en souvient.
