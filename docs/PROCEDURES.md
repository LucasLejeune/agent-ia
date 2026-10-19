# Procédures

## Setup
Voir README. Prérequis : Node >= 20, Ollama lancé (`ollama serve`), modèles tirés (`ollama list`).
Si `better-sqlite3` ne s'installe pas : `sudo apt install -y build-essential python3`.

## Ajouter un outil
1. Créer l'outil avec `defineTool({ name, description, parameters (JSON schema), schema (zod), run })` dans `src/tools/index.ts` (ou un nouveau fichier).
2. L'enregistrer : `registry.register(monOutil)`.
3. Écrire un test dans `tests/`.
4. La description doit dire clairement QUAND utiliser l'outil : le modèle choisit à partir d'elle.
Règle : un outil ne doit jamais exécuter de shell ni accéder au disque/SQL sans garde.

## Pipeline RAG
Fichier du corpus → lecture (JSON reformaté) → hash → chunking (`CHUNK_SIZE`/`CHUNK_OVERLAP`) → embeddings Ollama par lots de 16 → stockage (`chunks.embedding`).
Question → embedding → cosinus avec tous les chunks → filtre `RAG_MIN_SCORE` → top `RAG_TOP_K` → injection dans le prompt système → `sources` dans la réponse.
Ré-indexer : modifier le fichier puis `POST /ingest`. Changer de modèle d'embeddings : vider `documents` (cascade sur `chunks`) puis ré-ingérer.

## API et tests
`npm test` (chunking, similarité, calculatrice, garde SQL, garde de chemin) et `npm run typecheck`.

## Troubleshooting
| Symptôme | Cause / solution |
|---|---|
| /health : ollama=false | `ollama serve`, vérifier `OLLAMA_URL` |
| 502 « Erreur Ollama 404 » | Modèle non tiré : `ollama pull <modèle>` |
| 504 timeout | Modèle trop lent : augmenter `LLM_TIMEOUT_MS` ou prendre un modèle plus petit |
| Le modèle n'appelle jamais d'outil | Modèle sans tool calling : prendre `qwen3` ou `llama3.1` |
| sources vides | Pas d'ingest, ou `RAG_MIN_SCORE` trop haut |
| `SQLITE_CANTOPEN` | Lancer `npm run db:migrate` |
| Sous WSL, curl impossible | Utiliser 127.0.0.1 et vérifier que le service tourne dans le même WSL |
