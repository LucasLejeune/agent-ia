# Base métier, documents PDF et vérification

## Base de données (13 tables métier)
categories, suppliers, products, departments, employees, customers, orders, order_items, payments, shipments, reviews, returns, contacts.
Données de démo reproductibles : `scripts/seed-business.sql` (60 commandes, 134 lignes, 25 clients, 12 produits).
Contrôle d'intégrité : `npm run db:check` (totaux, paiements, remboursements, clés étrangères).

## Droits SQL par rôle
| Rôle | Tables accessibles |
|---|---|
| user | categories, suppliers, products, reviews |
| admin | les 13 tables métier |
Les tables internes (users, auth_tokens, sessions, messages, documents, chunks, document_access) ne sont jamais accessibles par l'outil SQL.

## Documents
Dossier `documents/` (CORPUS_DIR) : 6 PDF + faq.md, politique.txt, produits.csv, config.json.
Les PDF sont lus page par page (unpdf) : chaque chunk garde son numéro de page, repris dans `sources`.

## Vérification des réponses (ADR)
1. Prompt : interdiction d'inventer un chiffre, citation obligatoire des sources.
2. Contrôle déterministe : chaque nombre de la réponse doit apparaître dans les preuves (résultats d'outils, extraits, question).
3. Juge LLM : second appel (format JSON) qui confronte la réponse aux preuves.
4. Résultat : champ `verification` = `verified` | `warning` | `not_checked`.
5. Évaluation : `npm run eval` compare les réponses à des valeurs calculées directement en SQL.
Limites : petits entiers (<= 10) ignorés ; un calcul fait par le modèle sans outil est signalé ; le juge est un petit modèle, donc imparfait.
