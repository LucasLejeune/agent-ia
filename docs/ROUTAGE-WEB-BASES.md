# Routage, recherche web et 3 bases de données

## Routage (éviter les appels d'outils inutiles)
Avant la boucle d'outils, un routeur (1 appel LLM court, sortie JSON) décide quels groupes d'outils sont nécessaires : `sql`, `documents`, `web`, `calc`, ou aucun.
- Les outils non retenus ne sont **pas exposés** au modèle : il ne peut pas les appeler.
- Le RAG (embedding + recherche) ne tourne que si `documents` est retenu.
- Une expression purement arithmétique est routée par règle (sans appel LLM).
- Si le routeur échoue (JSON invalide), repli : tous les outils sont exposés.
- Garde-fou : un appel d'outil identique (même nom, mêmes arguments) dans la même requête est refusé.
- Défense en profondeur : `registry.execute` refuse aussi un outil hors groupes.
Le champ `route` de la réponse montre la décision (intents, bases, raison, source).

## Recherche web
Fournisseurs : `searxng` (local, sans clé) ou `ollama` (API web_search, clé OLLAMA_API_KEY). `none` désactive l'outil.
Sécurité : pas d'outil "fetch URL" (pas de SSRF), URLs http(s) seulement, contenu borné, résultats marqués comme données non fiables. La requête quitte la machine : l'outil est décrit au modèle comme ne devant jamais contenir de données internes.

## 3 bases de données (SQLite)
| Base | Tables |
|---|---|
| sales | customers, orders, order_items, payments, shipments, returns, reviews, contacts |
| catalog | categories, suppliers, products |
| hr | departments, employees |
Pas de clés étrangères entre fichiers : références logiques (order_items.product_id -> catalog.products.id, orders.employee_id -> hr.employees.id). L'outil `sql_query` prend un paramètre `database` ; une question croisée = une requête par base. `npm run db:check` vérifie l'intégrité inter-bases via ATTACH (script uniquement, jamais depuis l'outil).
Droits : user = catalog (3 tables) + sales.reviews ; admin = tout. Le routeur restreint en plus les bases utiles à la question.
