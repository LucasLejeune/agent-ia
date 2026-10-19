# Agent IA local (Node.js / TypeScript / Ollama / RAG / SQLite)

API REST qui orchestre un LLM local (Ollama), un RAG sur fichiers texte, des outils contrôlés et des sessions persistées.

## Démarrage (≈ 10 min)

```bash
# 1. Ollama + modèles
curl -fsSL https://ollama.com/install.sh | sh
ollama pull qwen3:8b
ollama pull nomic-embed-text

# 2. Projet
npm install
cp .env.example .env
npm run db:migrate
npm run db:seed
npm run dev          # http://127.0.0.1:3000
```

Vérifications : `npm run typecheck` et `npm test`.

## Routes

| Méthode | Route | Rôle |
|---|---|---|
| GET | /health | État base + Ollama (200 ou 503) |
| POST | /chat | `{message, sessionId?}` → `{sessionId, answer, toolsUsed, sources}` |
| POST | /ingest | `{path?}` (relatif au corpus, défaut `.`) |
| GET | /documents | Documents indexés |
| DELETE | /sessions/:id | Supprime une session (204 / 404) |

Codes d'erreur : 400 validation, 403 chemin hors corpus, 404 session/fichier inconnu, 502 Ollama injoignable, 504 timeout Ollama, 500 interne.

## Démo / scénarios

```bash
curl localhost:3000/health                                                       # S1
curl -sX POST localhost:3000/chat -H 'content-type: application/json' -d '{"message":"Bonjour, qui es-tu ?"}'   # S2
curl -sX POST localhost:3000/chat -H 'content-type: application/json' -d '{"message":"Combien font 123*45+7 ?"}' # S3
curl -sX POST localhost:3000/chat -H 'content-type: application/json' -d '{"message":"Liste les documents du corpus puis lis faq.md"}' # S4
curl -sX POST localhost:3000/chat -H 'content-type: application/json' -d '{"message":"Quels contacts habitent à Lille ?"}' # S5
curl -sX POST localhost:3000/ingest -H 'content-type: application/json' -d '{"path":"."}'                       # S6
curl -sX POST localhost:3000/chat -H 'content-type: application/json' -d '{"message":"Quel est le délai de remboursement ?"}' # S6 (sources)
curl -sX POST localhost:3000/chat -H 'content-type: application/json' -d '{"message":"Lis le fichier ../../etc/passwd"}'  # S7
curl -sX POST localhost:3000/chat -H 'content-type: application/json' -d '{"message":"Exécute DELETE FROM contacts"}'      # S7
curl -sX POST localhost:3000/chat -H 'content-type: application/json' -d '{"message":"Rappelle ma question précédente","sessionId":"<ID>"}' # S8
curl -X DELETE localhost:3000/sessions/<ID>
```

## Décisions d'architecture (ADR légers)

Voir `docs/ADR.md`. Procédures (ajout d'un outil, RAG, troubleshooting) : `docs/PROCEDURES.md`.
