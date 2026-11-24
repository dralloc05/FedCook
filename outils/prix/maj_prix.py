#!/usr/bin/env python3
"""
Met à jour data/prix.json avec les prix du Leclerc Drive de Carpentras,
via l'outil « E.Leclerc Drive Scraper » sur Apify (ratatoskr/leclerc-drive-scraper).

Lancé chaque semaine par GitHub Actions (voir .github/workflows/prix.yml).
Peut aussi se lancer à la main : APIFY_TOKEN=... python outils/prix/maj_prix.py

Pour rester dans les 5 $ gratuits par mois d'Apify :
- on ne cherche que les ingrédients les plus utilisés par les recettes (NB_INGREDIENTS),
- on garde peu de produits par ingrédient (PAR_INGREDIENT),
- après la première fois, on utilise le « suivi des changements » d'Apify :
  seuls les produits dont le prix a changé sont renvoyés et facturés,
- chaque lancement est plafonné (PLAFOND_USD).

Réglages (variables d'environnement, toutes facultatives sauf APIFY_TOKEN) :
  MAGASIN_ID       numéro à 6 chiffres du Drive (le plus sûr, une fois connu)
  MAGASIN          ville ou code postal si MAGASIN_ID est vide (défaut : Carpentras)
  NB_INGREDIENTS   nombre d'ingrédients suivis (défaut : 150)
  PAR_INGREDIENT   produits gardés par ingrédient (défaut : 3)
  PLAFOND_USD      dépense maximale par lancement (défaut : 1.5)
  TOUT_RECHARGER   mettre 1 pour tout redemander sans le suivi des changements

Sortie en erreur (code 1) si quelque chose cloche : GitHub t'envoie alors un e-mail.
"""

import json
import os
import re
import sys
import time
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

import requests

RACINE = Path(__file__).resolve().parent.parent.parent
PRIX = RACINE / "data" / "prix.json"
INGREDIENTS = RACINE / "data" / "ingredients.json"
RECETTES = RACINE / "data" / "recettes.json"

ACTEUR = "ratatoskr~leclerc-drive-scraper"
API = "https://api.apify.com/v2"
NOM_SUIVI = "appli-repas-carpentras"
IGNORES = {"eau", "sel", "poivre", "glacon", "glace pilee"}
MAX_PRODUITS_GARDES = 6

TOKEN = os.environ.get("APIFY_TOKEN", "").strip()
MAGASIN_ID = os.environ.get("MAGASIN_ID", "").strip()
MAGASIN = os.environ.get("MAGASIN", "").strip() or "Carpentras"
NB_INGREDIENTS = int(os.environ.get("NB_INGREDIENTS") or 150)
PAR_INGREDIENT = int(os.environ.get("PAR_INGREDIENT") or 3)
PLAFOND_USD = float(os.environ.get("PLAFOND_USD") or 1.5)
TOUT_RECHARGER = os.environ.get("TOUT_RECHARGER", "") == "1"


def normaliser(texte):
    t = unicodedata.normalize("NFD", str(texte).lower().replace("œ", "oe"))
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", t).strip()


def lire_json(chemin, defaut):
    try:
        return json.loads(chemin.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return defaut


def ecrire_json(chemin, donnees):
    tmp = chemin.with_suffix(".tmp")
    tmp.write_text(json.dumps(donnees, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(chemin)


def ingredients_a_suivre():
    liste = lire_json(INGREDIENTS, None)
    if liste is None:
        # Pas encore de fichier ingredients.json : on compte à partir des recettes.
        compte = {}
        for r in lire_json(RECETTES, []):
            if r.get("type", "plat") != "plat":
                continue
            for ing in r.get("ingredients", []):
                if ing.get("qte", 0) > 0:
                    cle = normaliser(ing["nom"])
                    compte.setdefault(cle, {"nom": ing["nom"], "n": 0})["n"] += 1
        liste = sorted(compte.values(), key=lambda x: (-x["n"], x["nom"]))
    noms = []
    vus = set()
    for item in liste:
        n = normaliser(item["nom"])
        if n in IGNORES or n in vus:
            continue
        vus.add(n)
        noms.append(item["nom"])
        if len(noms) >= NB_INGREDIENTS:
            break
    return noms


def entetes():
    return {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}


def lancer(termes, suivi):
    entree = {"searchQueries": termes, "maxItems": PAR_INGREDIENT}
    if MAGASIN_ID:
        entree["storeId"] = MAGASIN_ID
    else:
        entree["storeSearch"] = MAGASIN
    if suivi:
        entree["watchName"] = NOM_SUIVI
        entree["onlyChanges"] = True
    rep = requests.post(
        f"{API}/acts/{ACTEUR}/runs",
        params={"maxTotalChargeUsd": PLAFOND_USD},
        headers=entetes(),
        json=entree,
        timeout=60,
    )
    if rep.status_code >= 400:
        sys.exit(f"Apify refuse le lancement ({rep.status_code}) : {rep.text[:400]}")
    run = rep.json()["data"]
    print(f"Lancement Apify {run['id']} : {len(termes)} ingrédient(s), suivi des changements : {'oui' if suivi else 'non'}")

    debut = time.time()
    while run["status"] in ("READY", "RUNNING"):
        if time.time() - debut > 45 * 60:
            sys.exit("Apify n'a pas fini en 45 minutes : abandon.")
        time.sleep(15)
        run = requests.get(f"{API}/actor-runs/{run['id']}", headers=entetes(), timeout=60).json()["data"]
    if run["status"] != "SUCCEEDED":
        sys.exit(f"Le lancement Apify a échoué : statut {run['status']}. Détails dans la console Apify.")

    items = requests.get(
        f"{API}/datasets/{run['defaultDatasetId']}/items",
        params={"clean": "true", "format": "json"},
        headers=entetes(),
        timeout=120,
    ).json()
    print(f"  {len(items)} produit(s) reçu(s)")
    return items


def nombre(v):
    try:
        n = float(v)
        return n if n == n else None
    except (TypeError, ValueError):
        return None


def vers_produit(item, aujourdhui):
    prix = nombre(item.get("price"))
    if prix is None or not (0 < prix < 500):
        return None
    promo = nombre(item.get("promoPrice"))
    if promo is not None and not (0 < promo < prix):
        promo = None
    return {
        "id": str(item.get("productId") or item.get("ean") or item.get("name")),
        "nom": (item.get("name") or "").strip(),
        "format": (item.get("pack") or "").strip(),
        "prix": round(prix, 2),
        "prixPromo": round(promo, 2) if promo else None,
        "prixUnite": nombre(item.get("unitPrice")),
        "prixUnitePromo": nombre(item.get("promoUnitPrice")),
        "unite": (item.get("unitPriceUnit") or "").strip().lower() or None,
        "enStock": item.get("inStock") is not False,
        "image": item.get("image"),
        "maj": aujourdhui,
    }


def fusionner(prix, items, termes):
    aujourdhui = datetime.now(timezone.utc).date().isoformat()
    par_terme = {normaliser(t): t for t in termes}
    recus = {}
    for item in items:
        terme = par_terme.get(normaliser(item.get("query") or ""))
        if not terme:
            continue
        produit = vers_produit(item, aujourdhui)
        if not produit or not produit["nom"]:
            continue
        recus.setdefault(terme, []).append(produit)
        if item.get("storeId"):
            prix["magasin"] = {"id": str(item["storeId"]), "nom": item.get("storeName") or ""}
    for terme, produits in recus.items():
        existants = {p["id"]: p for p in prix["ingredients"].get(terme, [])}
        for p in produits:
            existants[p["id"]] = p
        # Les plus récents d'abord, nombre limité.
        prix["ingredients"][terme] = sorted(existants.values(), key=lambda p: p.get("maj") or "", reverse=True)[:MAX_PRODUITS_GARDES]
    return recus


def main():
    if not TOKEN:
        sys.exit("APIFY_TOKEN manquant : ajoute-le dans les secrets du dépôt GitHub (Settings → Secrets and variables → Actions).")
    termes = ingredients_a_suivre()
    if not termes:
        sys.exit("Aucun ingrédient trouvé dans data/ingredients.json ou data/recettes.json.")
    prix = lire_json(PRIX, {"maj": None, "magasin": None, "ingredients": {}})
    prix.setdefault("ingredients", {})

    connus = {normaliser(k) for k, v in prix["ingredients"].items() if v}
    nouveaux = [t for t in termes if TOUT_RECHARGER or normaliser(t) not in connus]
    suivis = [t for t in termes if t not in nouveaux]

    problemes = []
    if nouveaux:
        items = lancer(nouveaux, suivi=False)
        recus = fusionner(prix, items, nouveaux)
        vides = [t for t in nouveaux if t not in recus]
        if len(nouveaux) >= 5 and not recus:
            problemes.append("Aucun produit reçu : le Drive n'a peut-être pas été trouvé, ou l'outil Apify ne fonctionne plus.")
        elif vides:
            print(f"  Sans résultat ({len(vides)}) : {', '.join(vides[:30])}{'…' if len(vides) > 30 else ''}")
    if suivis:
        items = lancer(suivis, suivi=True)
        recus = fusionner(prix, items, suivis)
        print(f"  {sum(len(v) for v in recus.values())} prix changé(s) depuis la dernière fois")

    magasin = prix.get("magasin") or {}
    if magasin.get("nom") and "carpentras" not in normaliser(magasin["nom"]) and not MAGASIN_ID:
        problemes.append(f"Le Drive trouvé est « {magasin['nom']} » ({magasin.get('id')}) et pas Carpentras : "
                         "mets le bon numéro dans la variable MAGASIN_ID du dépôt.")
    if problemes:
        for p in problemes:
            print("PROBLÈME :", p)
        print("data/prix.json n'a pas été modifié.")
        sys.exit(1)

    prix["maj"] = datetime.now(timezone.utc).isoformat(timespec="minutes")
    ecrire_json(PRIX, prix)
    nb = sum(len(v) for v in prix["ingredients"].values())
    print(f"data/prix.json : {len(prix['ingredients'])} ingrédients, {nb} produits — Drive {magasin.get('id', '?')} {magasin.get('nom', '')}")

if __name__ == "__main__":
    main()
