# CLAUDE.md — AI Agent Chatbot (Sprint 4, Taller de Proyecto URP)

Chatbot que responde en español preguntas sobre una base PostgreSQL: Claude + MCP Server (6 herramientas) + RAG (ChromaDB) + PostgreSQL de solo lectura + RENIEC/SUNAT (Json.pe). Monorepo con npm workspaces: `backend/` (Express), `mcp-server/`, `rag/`, `frontend/` (React + Vite), `sql/`, `scripts/`.

**Responde siempre en español.**

## Si te piden instalarlo o ponerlo a correr en esta máquina

Sigue **[docs/GUIA_IMPLEMENTACION.md](docs/GUIA_IMPLEMENTACION.md)** paso a paso, en orden, y verifica cada paso antes de pasar al siguiente. Resumen:

```bash
npm install
npm run setup          # crea backend/.env y frontend/.env de desarrollo (no sobrescribe)
npm run chroma:setup   # opcional: ChromaDB local (Python 3.10+)
npm run db:dev         # terminal 1 (se queda abierta): PostgreSQL local :5433
npm run dev            # terminal 2 (se queda abierta): ChromaDB :8000 + API :3001 + web :5173
npm test               # 17 pruebas, deben pasar todas
```

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run setup` | Crea los `.env` locales (Claude Code, sin login, RENIEC simulado) |
| `npm run db:dev` | PostgreSQL 17 embebido (sin Docker). La 1.ª vez crea tablas, datos y `chatbot_reader` |
| `npm run dev` | ChromaDB (si `RAG_PROVIDER=chroma`) + backend + frontend |
| `npm test` | Validador SQL + flujo del agente con un Claude simulado (no gasta créditos) |
| `npm run test:mcp` | Llama a cada herramienta MCP sin pasar por Claude |
| `npm run db:test` | Comprueba la conexión y que `chatbot_reader` sea de solo lectura |
| `npm run rag:index` | Vuelve a cargar `rag/documents/*.md` en la base vectorial |
| `npm run chroma:setup` | Instala ChromaDB en `.venv-chroma/` y activa `RAG_PROVIDER=chroma` |

## Dónde está cada cosa

- `backend/src/services/aiAgent.service.js`: el agente y el **prompt de sistema** (`SYSTEM_PROMPT`).
- `backend/src/services/claudeCode.service.js`: modo `CLAUDE_PROVIDER=code` (ejecuta `claude -p`).
- `mcp-server/src/tools/`: las 6 herramientas.
- `mcp-server/src/services/sqlValidator.service.js`: validador SQL.
- `rag/lib/`: embeddings y bases vectoriales (local / chroma / pgvector).
- `rag/documents/`: lo que sabe el RAG del negocio.
- `frontend/src/components/`: interfaz. `demoSteps.js` es el guion de la demo (`/demo` en el chat).
- `sql/`: `schema.sql`, `seed.sql`, `create_readonly_user.sql`, `pgvector.sql`, `demo_profesor.sql`.

## Reglas (importantes)

- **Nunca** subas ni muestres secretos. `backend/.env`, `frontend/.env` y `.vscode/settings.json` están en `.gitignore` y deben seguir así. Si hace falta un token (Json.pe, Firebase, Anthropic, Neon), pide al usuario que lo pegue **él mismo** en el `.env`, no en el chat.
- `chatbot_reader` debe seguir siendo **solo lectura**. No relajes el validador SQL ni los permisos para "arreglar" algo.
- `CLAUDE_PROVIDER=code` usa la suscripción de Claude del usuario y **solo vale para su PC** (términos de Anthropic). Para desplegar (Render) se usa `CLAUDE_PROVIDER=api` con `ANTHROPIC_API_KEY`.
- No ejecutes `npm run db:dev -- --reset` (borra la base local) ni `DELETE`/`DROP` sin que el usuario lo pida.
- El backend en desarrollo solo vigila `backend/src`. Si editas `mcp-server/` o `rag/`, reinicia `npm run dev`.
- En Windows, PowerShell 5.1 descarta los argumentos vacíos (`""`): para probar `claude -p` a mano usa `spawn` de Node, no PowerShell.
