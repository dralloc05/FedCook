#!/usr/bin/env python3
"""
Traduit une grosse base de recettes anglaises en recettes françaises pour l'appli,
avec l'API Claude (Haiku 5.5) en mode lot (Batch API : -50 %).

Étapes :
  1. python traduire_recettes.py preparer recettes.parquet --nombre 15000
  2. python traduire_recettes.py envoyer --test 100      (test sur 100 recettes)
  3. python traduire_recettes.py suivre                   (où en est le traitement)
  4. python traduire_recettes.py recuperer                (récupère, vérifie, ajoute à data/recettes.json)
  5. python traduire_recettes.py envoyer                  (le reste, après avoir vérifié le test)
  puis à nouveau suivre / recuperer.

Ton PC n'a pas besoin de rester allumé entre « envoyer » et « recuperer » :
le traitement se fait chez Anthropic, les résultats restent disponibles 29 jours.

Clé API : variable d'environnement ANTHROPIC_API_KEY (ne la mets jamais dans un fichier du dépôt).
Dépendances : pip install anthropic pandas pyarrow
"""

import argparse
import ast
import json
import random
import re
import sys
import unicodedata
from datetime import datetime, timezone
from pathlib import Path

ICI = Path(__file__).resolve().parent
RACINE = ICI.parent.parent
TRAVAIL = ICI / "travail"
A_TRADUIRE = TRAVAIL / "a_traduire.jsonl"
LOTS = TRAVAIL / "lots.json"
RESULTATS = TRAVAIL / "resultats"
RECETTES = RACINE / "data" / "recettes.json"
INGREDIENTS = RACINE / "data" / "ingredients.json"

MODELE = "claude-haiku-5-5"
MAX_TOKENS = 2500
TAILLE_LOT = 10000
# Prix du lot pour Haiku 5.5 (prompt < 100 000 tokens), en dollars par million de tokens.
PRIX_ENTREE = 0.05
PRIX_SORTIE = 0.25
# Estimation moyenne par recette, pour annoncer le coût avant d'envoyer.
TOKENS_ENTREE_ESTIMES = 1300
TOKENS_SORTIE_ESTIMES = 750

TYPES = {"plat", "entree", "accompagnement", "dessert", "petit-dej", "boisson", "sauce", "autre"}
REGIMES = {"vegetarien", "vegan", "sans_lactose", "sans_gluten", "sans_porc"}
MATERIEL = {"plaques", "four", "micro_ondes", "airfryer", "mixeur", "cocotte_minute", "robot", "barbecue"}
UNITES = {"g", "ml", "piece"}

MOTS_DESSERT = re.compile(
    r"\b(cake|cookie|cookies|brownie|brownies|pie|cupcake|muffin|muffins|frosting|icing|fudge|candy|"
    r"dessert|pudding|cheesecake|tart|tarte|sorbet|ice cream|smoothie|cocktail|punch|lemonade|jam|jelly|"
    r"glaze|syrup|truffles|bars|squares|cobbler|crisp|toffee|caramel|marshmallow|meringue|scones?)\b",
    re.I,
)

CONSIGNE = """Tu convertis une recette (souvent en anglais, parfois américaine) en recette française pour une appli personnelle de planning de repas.
Les courses se font dans un supermarché E.Leclerc en France.

Réponds UNIQUEMENT avec un objet JSON, sans texte autour, de cette forme :
{
  "ok": true,
  "titre": "titre court et naturel en français",
  "type": "plat" | "entree" | "accompagnement" | "dessert" | "petit-dej" | "boisson" | "sauce" | "autre",
  "portions": nombre de personnes (entier),
  "temps": temps total en minutes (entier),
  "regimes": liste parmi ["vegetarien", "vegan", "sans_lactose", "sans_gluten", "sans_porc"],
  "materiel": liste parmi ["plaques", "four", "micro_ondes", "airfryer", "mixeur", "cocotte_minute", "robot", "barbecue"],
  "ingredients": [{"nom": "...", "qte": nombre, "unite": "g" | "ml" | "piece", "g": poids d'une pièce en grammes (seulement si unite = piece)}],
  "etapes": [{"texte": "...", "min": durée en minutes si l'étape comporte une attente ou une cuisson}]
}

Règles :
- "type" = "plat" seulement pour un plat principal qui fait un repas de midi ou du soir.
- Ingrédients : nom générique en français, en minuscules, comme on le cherche en magasin, sans marque ni préparation
  (« oignon » et pas « oignon émincé », « lardons », « crème fraîche », « viande hachée de bœuf », « oeuf »).
  La préparation (émincer, râper…) va dans les étapes.
- Convertis toutes les unités américaines en système métrique : cup, oz, lb, quart, stick of butter, etc.
  Cuillère à soupe ≈ 15 ml (ou 15 g pour un solide), cuillère à café ≈ 5 ml (ou 5 g), pincée ≈ 0,5 g.
  Pour les liquides, utilise "ml". Pour les solides vendus au poids, utilise "g".
  Pour ce qui se compte (œufs, oignons, gousses d'ail, citrons, tranches, pavés…), utilise "piece" avec "g" = poids moyen d'une pièce.
- Sel, poivre et épices « selon le goût » : qte = 0.
- Remplace un produit introuvable en France par un équivalent courant chez Leclerc. S'il n'y a pas d'équivalent simple
  (ex. « cream of mushroom soup » en conserve, « Bisquick »), réponds {"ok": false, "raison": "..."}.
- "regimes" : mets seulement ce qui est vrai pour TOUS les ingrédients. vegan implique vegetarien.
  sans_gluten exclut farine de blé, pâtes, pain, chapelure, semoule, sauce soja classique, bière.
  sans_lactose exclut lait, beurre, crème, fromage, yaourt.
- "materiel" : seulement ce qui est vraiment nécessaire (une poêle ou une casserole = "plaques").
- Étapes : réécris-les clairement en français, à l'infinitif (« Faire revenir… »), une action principale par étape, avec les températures en °C.
- Si ce n'est pas une vraie recette, si elle est incomplète ou incompréhensible, réponds {"ok": false, "raison": "..."}."""


# ---------- Outils ----------

def ecrire_json(chemin, donnees):
    chemin.parent.mkdir(parents=True, exist_ok=True)
    tmp = chemin.with_suffix(chemin.suffix + ".tmp")
    tmp.write_text(json.dumps(donnees, ensure_ascii=False, indent=1), encoding="utf-8")
    tmp.replace(chemin)


def lire_json(chemin, defaut):
    if not chemin.exists():
        return defaut
    return json.loads(chemin.read_text(encoding="utf-8"))


def dollars(montant):
    return f"{montant:.2f} $" if montant >= 1 else f"{montant:.3f} $"


def normaliser(texte):
    t = unicodedata.normalize("NFD", str(texte).lower().replace("œ", "oe"))
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", t).strip()


def client_anthropic():
    try:
        import anthropic
    except ImportError:
        sys.exit("Installe d'abord la bibliothèque : pip install anthropic")
    try:
        return anthropic.Anthropic()
    except Exception as e:  # clé absente
        sys.exit(f"Impossible de créer le client Anthropic ({e}). As-tu défini ANTHROPIC_API_KEY ?")


def en_liste(valeur):
    """Les colonnes contiennent souvent des listes écrites en texte : '["a", "b"]'."""
    if valeur is None:
        return []
    if isinstance(valeur, (list, tuple)):
        return [str(v) for v in valeur]
    if hasattr(valeur, "tolist"):
        return [str(v) for v in valeur.tolist()]
    texte = str(valeur).strip()
    if texte.startswith("["):
        for lecteur in (json.loads, ast.literal_eval):
            try:
                return [str(v) for v in lecteur(texte)]
            except Exception:
                pass
    return [l.strip() for l in re.split(r"\n|\r", texte) if l.strip()]


# ---------- 1. Préparer ----------

def lire_base(fichier):
    try:
        import pandas as pd
    except ImportError:
        sys.exit("Installe d'abord : pip install pandas pyarrow")
    chemin = Path(fichier)
    if chemin.suffix == ".parquet":
        return pd.read_parquet(chemin)
    if chemin.suffix == ".csv":
        return pd.read_csv(chemin)
    if chemin.suffix == ".jsonl":
        return pd.read_json(chemin, lines=True)
    if chemin.suffix == ".json":
        return pd.read_json(chemin)
    sys.exit("Format non pris en charge : utilise un fichier .parquet, .csv, .json ou .jsonl")


def trouver_colonne(colonnes, candidats):
    basse = {c.lower(): c for c in colonnes}
    for cand in candidats:
        if cand in basse:
            return basse[cand]
    return None


def texte_recette(ligne, cols):
    if cols["texte"]:
        return str(ligne[cols["texte"]]).strip(), str(ligne[cols["texte"]]).strip().split("\n")[0][:120]
    titre = str(ligne[cols["titre"]]).strip() if cols["titre"] else ""
    ingredients = en_liste(ligne[cols["ingredients"]]) if cols["ingredients"] else []
    etapes = en_liste(ligne[cols["etapes"]]) if cols["etapes"] else []
    texte = f"{titre}\n\nIngredients:\n" + "\n".join(f"- {i}" for i in ingredients)
    texte += "\n\nDirections:\n" + "\n".join(f"{n}. {e}" for n, e in enumerate(etapes, 1))
    return texte, titre


def preparer(args):
    df = lire_base(args.fichier)
    colonnes = list(df.columns)
    cols = {
        "titre": trouver_colonne(colonnes, ["title", "name", "recipe_name", "titre", "recipe_title"]),
        "ingredients": trouver_colonne(colonnes, ["ingredients", "ingredient", "ingredients_list", "ingredient_list"]),
        "etapes": trouver_colonne(colonnes, ["directions", "instructions", "steps", "method", "preparation", "etapes"]),
        "texte": None,
    }
    if not (cols["titre"] and cols["ingredients"] and cols["etapes"]):
        texte = trouver_colonne(colonnes, ["input", "text", "recipe", "content"])
        if not texte and len(colonnes) == 1:
            texte = colonnes[0]
        if not texte:
            sys.exit(f"Je ne reconnais pas les colonnes de ce fichier : {colonnes}")
        cols = {"titre": None, "ingredients": None, "etapes": None, "texte": texte}
    print(f"{len(df)} recettes dans le fichier. Colonnes utilisées : {cols}")

    rng = random.Random(args.graine)
    ordre = list(range(len(df)))
    rng.shuffle(ordre)

    deja = {json.loads(l)["titre_norm"] for l in A_TRADUIRE.read_text(encoding="utf-8").splitlines()} if A_TRADUIRE.exists() else set()
    gardees = []
    vus = set(deja)
    for i in ordre:
        if len(gardees) >= args.nombre:
            break
        texte, titre = texte_recette(df.iloc[i], cols)
        if not (250 <= len(texte) <= 3500):
            continue
        if MOTS_DESSERT.search(titre or texte[:120]):
            continue
        tn = normaliser(titre or texte[:80])
        if not tn or tn in vus:
            continue
        vus.add(tn)
        gardees.append({"id": f"r{len(deja) + len(gardees):06d}", "titre_norm": tn, "texte": texte})

    TRAVAIL.mkdir(parents=True, exist_ok=True)
    with A_TRADUIRE.open("a", encoding="utf-8") as f:
        for g in gardees:
            f.write(json.dumps(g, ensure_ascii=False) + "\n")
    print(f"{len(gardees)} recettes ajoutées à {A_TRADUIRE.relative_to(RACINE)} (desserts et doublons écartés).")
    print("Étape suivante : python traduire_recettes.py envoyer --test 100")


# ---------- 2. Envoyer ----------

def envoyer(args):
    if not A_TRADUIRE.exists():
        sys.exit("Lance d'abord : python traduire_recettes.py preparer <fichier>")
    lots = lire_json(LOTS, {"lots": []})
    envoyes = {i for lot in lots["lots"] for i in lot["ids"]}
    a_faire = [json.loads(l) for l in A_TRADUIRE.read_text(encoding="utf-8").splitlines()]
    a_faire = [r for r in a_faire if r["id"] not in envoyes]
    if args.test:
        a_faire = a_faire[: args.test]
    if not a_faire:
        print("Rien à envoyer : tout est déjà parti.")
        return

    cout = len(a_faire) * (TOKENS_ENTREE_ESTIMES * PRIX_ENTREE + TOKENS_SORTIE_ESTIMES * PRIX_SORTIE) / 1_000_000
    print(f"{len(a_faire)} recettes à envoyer, coût estimé : environ {dollars(cout)} (modèle {MODELE}, en lot).")
    if not args.oui and input("On envoie ? (o/n) ").strip().lower() not in ("o", "oui", "y"):
        print("Annulé.")
        return

    client = client_anthropic()
    for debut in range(0, len(a_faire), TAILLE_LOT):
        morceau = a_faire[debut: debut + TAILLE_LOT]
        requetes = [
            {
                "custom_id": r["id"],
                "params": {
                    "model": MODELE,
                    "max_tokens": MAX_TOKENS,
                    "system": CONSIGNE,
                    "messages": [{"role": "user", "content": r["texte"]}],
                },
            }
            for r in morceau
        ]
        lot = client.messages.batches.create(requests=requetes)
        lots["lots"].append({
            "id": lot.id,
            "ids": [r["id"] for r in morceau],
            "cree": datetime.now(timezone.utc).isoformat(),
            "recupere": False,
        })
        ecrire_json(LOTS, lots)
        print(f"Lot envoyé : {lot.id} ({len(morceau)} recettes)")
    print("Le traitement prend généralement moins d'une heure, 24 heures au maximum.")
    print("Tu peux éteindre ton PC. Ensuite : python traduire_recettes.py suivre")


# ---------- 3. Suivre ----------

def suivre(args):
    lots = lire_json(LOTS, {"lots": []})
    if not lots["lots"]:
        print("Aucun lot envoyé.")
        return
    client = client_anthropic()
    for lot in lots["lots"]:
        if lot.get("recupere"):
            print(f"{lot['id']} : déjà récupéré")
            continue
        b = client.messages.batches.retrieve(lot["id"])
        c = b.request_counts
        print(f"{lot['id']} : {b.processing_status} — en cours {c.processing}, réussies {c.succeeded}, "
              f"erreurs {c.errored}, expirées {c.expired}, annulées {c.canceled}")
    print("Quand un lot est « ended » : python traduire_recettes.py recuperer")


# ---------- 4. Récupérer ----------

def extraire_json(texte):
    texte = texte.strip()
    if texte.startswith("```"):
        texte = re.sub(r"^```(?:json)?\s*|\s*```$", "", texte)
    try:
        return json.loads(texte)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", texte, re.S)
        if m:
            return json.loads(m.group(0))
        raise


def nombre(v, defaut=None):
    try:
        n = float(v)
        return n if n == n else defaut
    except (TypeError, ValueError):
        return defaut


def valider(obj, ident):
    """Vérifie et nettoie une recette renvoyée par Claude. Renvoie None si elle est inutilisable."""
    if not isinstance(obj, dict) or obj.get("ok") is not True:
        return None
    titre = str(obj.get("titre") or "").strip()
    type_ = obj.get("type") if obj.get("type") in TYPES else "autre"
    portions = int(round(nombre(obj.get("portions"), 4) or 4))
    temps = int(round(nombre(obj.get("temps"), 0) or 0))
    if not titre or not (1 <= portions <= 20):
        return None
    ingredients = []
    for ing in obj.get("ingredients") or []:
        if not isinstance(ing, dict):
            continue
        nom = str(ing.get("nom") or "").strip().lower()
        qte = nombre(ing.get("qte"), 0) or 0
        unite = ing.get("unite") if ing.get("unite") in UNITES else None
        if not nom or unite is None or qte < 0:
            continue
        propre = {"nom": nom, "qte": round(qte, 2), "unite": unite}
        if unite == "piece":
            g = nombre(ing.get("g"))
            if g and 0 < g < 5000:
                propre["g"] = round(g)
        ingredients.append(propre)
    etapes = []
    for e in obj.get("etapes") or []:
        texte = str(e.get("texte") if isinstance(e, dict) else e or "").strip()
        if not texte:
            continue
        propre = {"texte": texte}
        if isinstance(e, dict):
            m = nombre(e.get("min"))
            if m and 0 < m < 24 * 60:
                propre["min"] = int(round(m))
        etapes.append(propre)
    if len(ingredients) < 2 or not etapes:
        return None
    regimes = sorted({r for r in obj.get("regimes") or [] if r in REGIMES})
    if "vegan" in regimes and "vegetarien" not in regimes:
        regimes.append("vegetarien")
    materiel = sorted({m for m in obj.get("materiel") or [] if m in MATERIEL})
    return {
        "id": f"t{ident}",
        "titre": titre[0].upper() + titre[1:],
        "type": type_,
        "portions": portions,
        "temps": temps,
        "regimes": sorted(regimes),
        "materiel": materiel,
        "ingredients": ingredients,
        "etapes": etapes,
        "source": "traduction",
    }


def ecrire_ingredients(recettes):
    compte = {}
    for r in recettes:
        if r.get("type") != "plat":
            continue
        for ing in r.get("ingredients", []):
            if ing.get("qte", 0) <= 0:
                continue
            cle = normaliser(ing["nom"])
            if cle not in compte:
                compte[cle] = {"nom": ing["nom"], "n": 0}
            compte[cle]["n"] += 1
    liste = sorted(compte.values(), key=lambda x: (-x["n"], x["nom"]))
    ecrire_json(INGREDIENTS, liste)
    return liste


def recuperer(args):
    lots = lire_json(LOTS, {"lots": []})
    client = client_anthropic()
    recettes = lire_json(RECETTES, [])
    par_id = {r["id"]: r for r in recettes}
    titres = {normaliser(r["titre"]) for r in recettes}
    tokens_entree = tokens_sortie = 0
    ajoutees = refusees = erreurs = 0

    for lot in lots["lots"]:
        if lot.get("recupere"):
            continue
        b = client.messages.batches.retrieve(lot["id"])
        if b.processing_status != "ended":
            print(f"{lot['id']} : pas encore terminé ({b.processing_status}).")
            continue
        RESULTATS.mkdir(parents=True, exist_ok=True)
        brut = RESULTATS / f"{lot['id']}.jsonl"
        with brut.open("w", encoding="utf-8") as sortie:
            for res in client.messages.batches.results(lot["id"]):
                if res.result.type != "succeeded":
                    erreurs += 1
                    continue
                msg = res.result.message
                tokens_entree += msg.usage.input_tokens
                tokens_sortie += msg.usage.output_tokens
                texte = "".join(bloc.text for bloc in msg.content if getattr(bloc, "type", "") == "text")
                sortie.write(json.dumps({"id": res.custom_id, "texte": texte}, ensure_ascii=False) + "\n")
                try:
                    recette = valider(extraire_json(texte), res.custom_id)
                except Exception:
                    recette = None
                if recette is None:
                    refusees += 1
                    continue
                tn = normaliser(recette["titre"])
                if tn in titres:
                    refusees += 1
                    continue
                titres.add(tn)
                par_id[recette["id"]] = recette
                ajoutees += 1
        lot["recupere"] = True
        ecrire_json(LOTS, lots)

    recettes = list(par_id.values())
    ecrire_json(RECETTES, recettes)
    ingredients = ecrire_ingredients(recettes)
    cout = (tokens_entree * PRIX_ENTREE + tokens_sortie * PRIX_SORTIE) / 1_000_000
    plats = sum(1 for r in recettes if r.get("type") == "plat")
    print(f"Ajoutées : {ajoutees} · écartées (inutilisables ou doublons) : {refusees} · erreurs : {erreurs}")
    print(f"data/recettes.json : {len(recettes)} recettes, dont {plats} plats · {len(ingredients)} ingrédients différents")
    if tokens_entree:
        print(f"Tokens : {tokens_entree} en entrée, {tokens_sortie} en sortie → environ {dollars(cout)} "
              f"(vérifie le montant exact dans la console Claude)")
    print("Pense à envoyer data/recettes.json et data/ingredients.json sur GitHub (git add, commit, push).")


# ---------- Ligne de commande ----------

def main():
    p = argparse.ArgumentParser(description="Traduction des recettes avec l'API Claude (en lot).")
    sous = p.add_subparsers(dest="commande", required=True)
    a = sous.add_parser("preparer", help="choisir les recettes à traduire dans un fichier")
    a.add_argument("fichier")
    a.add_argument("--nombre", type=int, default=15000)
    a.add_argument("--graine", type=int, default=42)
    a.set_defaults(fonction=preparer)
    a = sous.add_parser("envoyer", help="envoyer un lot à l'API Claude")
    a.add_argument("--test", type=int, default=0, help="n'envoyer que ce nombre de recettes")
    a.add_argument("--oui", action="store_true", help="ne pas demander de confirmation")
    a.set_defaults(fonction=envoyer)
    sous.add_parser("suivre", help="voir où en sont les lots").set_defaults(fonction=suivre)
    sous.add_parser("recuperer", help="récupérer et vérifier les recettes traduites").set_defaults(fonction=recuperer)
    args = p.parse_args()
    args.fonction(args)


if __name__ == "__main__":
    main()
