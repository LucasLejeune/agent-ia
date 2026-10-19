# Décisions d'architecture

| # | Décision | Raison | Alternative écartée |
|---|---|---|---|
| 1 | Fastify | Logger pino intégré, rapide, TS natif | Express (moins de TS natif) |
| 2 | zod | Validation des entrées API, de la config et des arguments d'outils (le LLM peut se tromper) | Validation manuelle |
| 3 | better-sqlite3 | API synchrone simple, permet une 2e connexion `readonly` | sqlite3 (callbacks), ORM (trop lourd) |
| 4 | Client Ollama via `fetch` | 0 dépendance, timeout via `AbortSignal.timeout` | SDK `ollama` |
| 5 | Embeddings en BLOB Float32 + cosinus en application | Corpus petit, autorisé par le cahier, testable | sqlite-vec, base vectorielle |
| 6 | Chunking par caractères (800 / 100) avec coupe sur fin de ligne/phrase | Simple, déterministe, testable | Découpage par tokens |
| 7 | Hash SHA-256 par document | Évite de ré-embedder un fichier inchangé | Réindexer à chaque fois |
| 8 | Sécurité SQL en 3 couches : validateur (SELECT seul, allowlist de tables) + connexion `readonly` + `query_only` + LIMIT forcé | Défense en profondeur | Regex seule |
| 9 | Garde de chemin : `resolve` + `realpath` + préfixe `root + sep` | Bloque `../`, chemins absolus, symlinks et préfixes voisins | Simple `includes('..')` |
| 10 | Calculatrice par parseur récursif | Pas de `eval` | `mathjs`, `Function()` |
| 11 | Les erreurs d'outils sont renvoyées au modèle (jamais levées) | Le LLM peut se corriger ; l'API ne plante pas | Propager l'exception |
| 12 | Boucle d'outils bornée par `MAX_TOOL_ITERATIONS` | Évite les boucles infinies et coûts | Boucle libre |
| 13 | Historique LLM = messages user/assistant uniquement (20 derniers) | Contexte maîtrisé, simple | Rejouer les messages d'outils |
| 14 | RAG toujours exécuté avec seuil `RAG_MIN_SCORE` | Pas de sources parasites sur « Bonjour » | RAG exposé comme outil |
