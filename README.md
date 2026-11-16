# AI Agent Chatbot · Claude + MCP Server + RAG + PostgreSQL + RENIEC

Implementación de la **Guía del Sprint 4 — Taller de Proyecto (URP)**. Es un chatbot que entiende preguntas en español, consulta datos reales en PostgreSQL y en RENIEC, y responde en segundos sin mostrar el SQL.

```
Usuario ─► React + Vite (Vercel) ─► Firebase Auth ─► Express (Render) ─► Claude API
                                                                         │
                                       ┌─────────────────────────────────┼──────────────────┐
                                       ▼                                 ▼                  ▼
                                RAG Retriever                     MCP Server (en memoria)
                          local / ChromaDB / pgvector     list_tables · describe_table · get_relationships
                                                          run_readonly_query · consultar_reniec_dni · consultar_sunat_ruc
                                                                  │                       │
                                                         SQL Validator +           Json.pe (RENIEC/SUNAT)
                                                         transacción READ ONLY
                                                                  │
                                                     PostgreSQL 17 (usuario chatbot_reader)
```

## Inicio rápido (local, sin cuentas)

Requisito: **Node.js 20+**. No hace falta instalar PostgreSQL ni Docker.

```bash
npm install                 # instala todo (monorepo con npm workspaces)
npm run setup               # crea backend/.env y frontend/.env de desarrollo
npm run chroma:setup        # opcional: ChromaDB local (Python 3.10+)
npm run db:dev              # Terminal 1: PostgreSQL 17 local con tablas y datos de prueba
npm run dev                 # Terminal 2: ChromaDB + backend (:3001) + frontend (:5173)
```

> **¿Lo instalas con Claude Code?** Ábrelo en esta carpeta y dile *"instala el proyecto siguiendo la guía"*. Claude lee `CLAUDE.md` y sigue [docs/GUIA_IMPLEMENTACION.md](docs/GUIA_IMPLEMENTACION.md), que incluye verificaciones y solución de problemas.

Abre <http://localhost:5173>.

En local se configura así:
- **Claude:** usa **tu Claude Code** (`CLAUDE_PROVIDER=code`), sin necesidad de API key.
- **Login:** está desactivado (`AUTH_DISABLED=true`).
- **RENIEC:** usa datos simulados (`RENIEC_MOCK=true`).

## Dos formas de conectar a Claude (`CLAUDE_PROVIDER`)

| | `code` (por defecto en local) | `api` (lo que pide la guía para desplegar) |
|---|---|---|
| Credencial | Tu sesión de Claude Code (la extensión de VS Code o la CLI) | `ANTHROPIC_API_KEY` de console.anthropic.com |
| Cómo funciona | El backend ejecuta `claude -p`, que solo tiene acceso al MCP Server (sin terminal ni archivos) | El backend llama a la Claude API con su propio bucle de herramientas |
| Velocidad | ~9–15 s por pregunta (incluye el arranque de Claude Code) | Más rápido |
| Dónde funciona | **Solo en tu PC.** No funciona en Render, y Anthropic no permite usar una suscripción para una app que usen otras personas. | En cualquier servidor (Render) |

El backend encuentra solo el `claude.exe` de la extensión de VS Code. Si no lo encuentra, define `CLAUDE_CODE_PATH`. Para cambiar al modo API pon `CLAUDE_PROVIDER=api` y tu `ANTHROPIC_API_KEY`.

## Interfaz y streaming

La interfaz tiene la estética de terminal estilo Claude Code de la sección "Herramientas de IA" del portafolio:
- **Clawd 3D:** el mismo modelo de Blender (`frontend/public/clawd/`, con three.js r128), que reacciona al chat. Piensa cuando preguntas, teclea mientras consulta, se asusta si un SQL falla y festeja al terminar.
- **Panel en vivo:** muestra las herramientas MCP, el contexto RAG y el estado del sistema.
- **Conversación:** las respuestas llegan **en streaming** por `POST /api/chat/stream` (Server-Sent Events). Los eventos son `status`, `sources`, `tool` (running/ok/error), `delta` (texto token a token), `reset`, `done` y `error`.
- **Atajos:** `Esc` interrumpe (corta también el trabajo de Claude en el servidor), `Shift+Tab` muestra u oculta el SQL y `↑` recorre el historial. Comandos: `/help`, `/clear`, `/sql`, `/prompt`, `/rag`, `/audit` y `/demo`.
- **Auditoría:** `/audit` abre las últimas operaciones de `backend/logs/audit.log`. Cada usuario ve solo las suyas (`GET /api/audit/recent`).
- **Prompt de sistema:** el botón "✻ system prompt" de la barra superior (o `/prompt`) lo abre en una ventana de solo lectura, con números de línea y un botón para copiarlo. Lo sirve `GET /api/chat/system-prompt` (con login, igual que el chat). Se edita en `backend/src/services/aiAgent.service.js`.

`POST /api/chat` (sin streaming) sigue disponible para clientes simples.

En desarrollo, el backend vigila solo `backend/src` (`--watch-path`). En Windows, el simple hecho de que el MCP Server lea sus archivos cuenta como un "cambio" y reiniciaba el backend a mitad de una consulta. Si editas `mcp-server/` o `rag/`, reinicia `npm run dev` a mano.

| Script | Qué hace |
|---|---|
| `npm run db:dev` | PostgreSQL local (crea tablas, datos y `chatbot_reader` la primera vez). Usa `-- --reset` para recrear la base. |
| `npm run db:test` | Script del Módulo 3.8: conecta, lista las tablas, cuenta los registros y comprueba que sea de solo lectura. |
| `npm run test:mcp` | Llama a cada herramienta del MCP Server sin pasar por Claude. |
| `npm test` | Pruebas del SQL Validator y del flujo completo del agente, con un Claude simulado que no gasta créditos. |
| `npm run rag:index` | Vectoriza `rag/documents` (vuelve a correrlo cada vez que edites los documentos). |
| `npm run db:apply` | Ejecuta `sql/*.sql` con el usuario administrador (`DB_ADMIN_URL`), por ejemplo en Neon. |
| `npm run mcp` | MCP Server por stdio (para Claude Code / Claude Desktop). |

## Módulos de la guía → dónde están

| Módulo | Implementación |
|---|---|
| 0 · Json.pe | `mcp-server/src/services/reniec.service.js` (cuenta en app.json.pe → API Consulta → token) |
| 1–2 · Claude en VS Code | Abre esta carpeta con Claude Code: `.mcp.json` le da acceso a la BD mediante el MCP Server |
| 3 · PostgreSQL | `sql/create_readonly_user.sql`, `mcp-server/src/config/database.js`, `mcp-server/src/tools/*`, `backend/scripts/test-db.js` |
| 4 · RENIEC | `backend/src/routes/reniec.routes.js` + la herramienta `consultar_reniec_dni` |
| 5 · Variables y seguridad | `backend/.env.example`, `frontend/.env.example`, `.gitignore` |
| 6 · Arquitectura | Estructura de carpetas de abajo |
| 7 · Flujo de una pregunta | `backend/src/services/aiAgent.service.js` (pasos 3–9) y `frontend/src/components/*` |
| 8 · Checklist | Sección "Checklist" al final |

## Correcciones respecto a la guía

| En la guía | Problema | Cómo quedó |
|---|---|---|
| `upper.includes('CREATE')` en el SQL Validator | Rechazaba columnas como `created_at`, `updated_at` o `deleted_at` | Compara palabras completas e ignora el contenido de textos e identificadores. Tiene pruebas en `mcp-server/test`. |
| Cualquier `;` se rechaza | Claude casi siempre termina el SQL con `;`, así que fallaban consultas válidas | Se quita el `;` final y se siguen bloqueando las sentencias múltiples |
| `require('../../backend/src/services/reniec.service')` | La ruta apuntaba a `mcp-server/backend/`, que no existe | El servicio vive en el MCP Server y el backend lo reutiliza |
| Las herramientas importan `../config/database` | No existía `mcp-server/src/config` | Ahora existe y `backend/src/config/database.js` lo reexporta |
| `GET /v2/reniec/dni?numero=` | Ese endpoint es de otro proveedor | Json.pe usa `POST https://api.json.pe/api/dni` con `{ "dni": "..." }` (docs.json.pe) |
| Tabla 4.1: fecha de nacimiento, sexo, estado civil | Json.pe no devuelve esos campos | Se usan los campos reales: nombres, apellidos y código de verificación |
| `claude-sonnet-4-5` | Modelo de una generación anterior | `claude-sonnet-5-5` (configurable con `CLAUDE_MODEL`) |
| `connectionTimeoutMillis: 2000` | Neon tarda más de 2 s cuando despierta | 15 s |
| `"Claude: Explain Code"`, `claude.apiKey` en settings.json | No son comandos ni ajustes de la extensión oficial | La extensión de Claude Code se configura iniciando sesión, sin pegar la API key |
| `LIMIT 100` solo si no hay `LIMIT` | Un `LIMIT 100000` lo saltaba, y también lo saltaba una columna llamada `limite` | La consulta se envuelve y nunca devuelve más de 100 filas |

Capas de seguridad agregadas:
- **Transacción `READ ONLY`:** cada consulta se ejecuta dentro de una, con un *timeout* de 10 s.
- **Usuario de la BD:** `chatbot_reader` tiene `default_transaction_read_only=on`.
- **Funciones bloqueadas:** `pg_sleep`, `pg_read_file`, `dblink` y similares.
- **Límite de preguntas:** por usuario, para proteger tus créditos.
- **Auditoría:** se registra en `backend/logs/audit.log`.
- **SQL oculto:** el SQL se quita de la respuesta salvo que el usuario lo pida o active "Mostrar SQL".
- **Solo temas del negocio:** el prompt de sistema (sección "Alcance" en `aiAgent.service.js`) hace que el asistente rechace en una o dos frases lo que no sea sobre la tienda, RENIEC o SUNAT (scripts, tareas, recetas, cultura general…), aunque le pidan ignorar sus reglas. A cambio, sugiere preguntas válidas. Si una pregunta mezcla temas, responde solo la parte del negocio.

## Base de datos en Neon (producción)

1. Crea un proyecto en <https://neon.tech> y copia la cadena de conexión del **dueño** en `DB_ADMIN_URL`.
2. Pon la contraseña que tendrá `chatbot_reader` en `DB_PASSWORD`. Neon exige que sea robusta.
3. Ejecuta `npm run db:apply`. Crea las tablas de ejemplo, carga los datos y crea `chatbot_reader`. Si ya tienes tus propias tablas, usa `npm run db:apply -- create_readonly_user.sql`.
4. Completa `DB_HOST`, `DB_NAME`, `DB_USER=chatbot_reader` y `DB_SSL=true`, y verifica con `npm run db:test`.

## RAG

- **Documentos:** están en `rag/documents/*.md` (tablas, reglas de negocio, ejemplos SQL y glosario). Edítalos con la información de **tu** proyecto y corre `npm run rag:index`.
- **Embeddings:** se generan localmente con transformers.js; Claude no genera embeddings. El modelo por defecto es `paraphrase-multilingual-MiniLM-L12-v2`, de la misma familia y dimensión (384) que el `all-MiniLM-L6-v2` de la guía, pero encuentra mucho mejor los textos en español. Para usar el de la guía, configura `EMBEDDING_MODEL=Xenova/all-MiniLM-L6-v2`.
- **`RAG_PROVIDER`:**
  - `chroma` (desarrollo, como pide la guía): ChromaDB corre en tu PC, sin cuenta ni Docker.
    1. `npm run chroma:setup` (una sola vez). Crea `.venv-chroma/` con Python 3.10+ e instala `chromadb`.
    2. Pon `RAG_PROVIDER=chroma` en `backend/.env`.
    3. `npm run dev` enciende ChromaDB en `http://127.0.0.1:8000` junto con la API y la web. Los vectores quedan en `chroma_db/`.
    4. `npm run rag:index` carga los documentos (repítelo cuando cambies `rag/documents/`).
  - `pgvector` (producción en Neon): ejecuta antes `npm run db:apply -- pgvector.sql`.
  - `local`: índice JSON, sin servidores. Funciona en Render Free.
  - Si ChromaDB o pgvector fallan, el sistema usa el índice local como respaldo, y el panel del chat muestra `local (respaldo)`.
- **Ver la base vectorial:** ChromaDB no trae interfaz para ver los datos (solo su API en `http://127.0.0.1:8000/docs`). Por eso el chat incluye un visor: el botón "◆ chroma" de la barra superior, `/rag`, o "ver base ↗" en el panel lateral.
  - Muestra cada fragmento agrupado por documento, con el inicio de su vector.
  - Permite buscar por significado sin llamar a Claude. Indica qué fragmentos se enviarían a Claude (puntaje ≥ 0.25).
  - Lo sirven `GET /api/rag/documents` y `POST /api/rag/search`, ambos con login.

## Despliegue

**Backend en Render**
- Crea un *Web Service* con *Root Directory* vacío.
- Build: `npm install && npm run rag:index`. Start: `npm start`.
- Copia las variables de `backend/.env.example` con `NODE_ENV=production` y `CORS_ORIGIN=https://tu-app.vercel.app`.
- En producción `AUTH_DISABLED` se ignora siempre.

**Frontend en Vercel**
- *Root Directory* `frontend`, framework Vite.
- Variables `VITE_FIREBASE_*` y `VITE_API_URL=https://tu-api.onrender.com`.

**Firebase**
- Activa *Authentication* con los proveedores Google y Correo/contraseña.
- Agrega tu dominio de Vercel en *Authorized domains*.
- Genera la clave de la cuenta de servicio para `FIREBASE_*` del backend.

## Estructura

```
├── backend/          Express: /api/chat, /api/reniec, agente con Claude, auditoría
│   ├── src/services/ aiAgent · mcpClient · ragRetriever · responseFormatter · firebaseAuth · reniec · sqlValidator
│   ├── scripts/      test-db.js · test-mcp.js
│   └── test/         prueba de punta a punta con un Claude simulado
├── mcp-server/       MCP Server (SDK oficial) — en memoria para el backend, stdio para Claude Code
│   ├── src/tools/    listTables · describeTable · getRelationships · runReadonlyQuery · reniecQuery · sunatQuery
│   └── src/services/ postgres · sqlValidator · reniec (Json.pe)
├── frontend/         React + Vite: Login, ChatWindow, MessageBubble, ChatInput
├── rag/              documents/ · lib/ (embeddings, local/chroma/pgvector) · scripts/
├── sql/              schema · seed · create_readonly_user · pgvector
└── scripts/          dev-db.mjs (PostgreSQL local) · apply-sql.js
```

## Checklist (Módulo 8)

- [ ] Claude conectado. En local, `CLAUDE_PROVIDER=code` con tu Claude Code. Para desplegar, `CLAUDE_PROVIDER=api` + `ANTHROPIC_API_KEY`. Abriendo la carpeta con Claude Code, aparece el MCP `postgres-chatbot` en `/mcp`.
- [ ] Neon creado, tablas cargadas y `chatbot_reader` solo con SELECT. `npm run db:test` muestra "Solo lectura confirmado".
- [ ] Token de Json.pe en `.env` y `RENIEC_MOCK=false`. `GET /api/reniec/dni/:numero` responde.
- [ ] `.env` fuera de git y `.env.example` sin valores reales.
- [ ] `npm test` en verde: el validador rechaza INSERT/UPDATE/DELETE y siempre aplica el tope de 100 filas.
- [ ] Login con Google funcionando. Cada request lleva el token de Firebase.
- [ ] El chatbot responde en lenguaje natural, consulta RENIEC por DNI y registra todo en `backend/logs/audit.log`.

## Demo en vivo

El chat trae una **demo guiada**: el botón "▶ demo" de la pantalla de bienvenida, o `/demo`. Una barra verde muestra el paso actual, **qué decir** y un botón **▶** que ejecuta el paso (hace la pregunta o abre la ventana correspondiente). "siguiente ›" avanza y "ocultar guion" esconde las notas si no quieres que se vean. El guion está en `frontend/src/components/demoSteps.js`.

**Antes de presentar (5 min):**
1. Terminal 1: `npm run db:dev`. Terminal 2: `npm run dev`. Espera a ver "RAG listo" y "ChromaDB escuchando".
2. Abre http://localhost:5173 y revisa que el panel "sistema" esté en verde (postgres, claude, rag: chroma).
3. Haz una pregunta de calentamiento: la primera tarda más porque carga el modelo.
4. Cierra Discord, Steam y las pestañas que no uses: el modelo de embeddings y Claude Code necesitan RAM.

**Guion (10 pasos):**

| # | Paso | Qué hace el botón ▶ | Qué decir |
|---|---|---|---|
| 1 | Presentación | — | Agente de IA: Claude + MCP (6 herramientas) + RAG con ChromaDB + PostgreSQL de solo lectura + RENIEC |
| 2 | Base de datos | — (cambias a VS Code) | Las 5 tablas; el bot usa `chatbot_reader`, que solo tiene SELECT |
| 3 | Flujo completo | Pregunta por el DNI 12345678 | RAG da contexto; Claude usa RENIEC y SQL a la vez; respuesta en streaming |
| 4 | RAG | Abre ChromaDB y busca "¿cuánto facturamos este mes?" | Vectores de 384 números; búsqueda por significado; ≥ 0.25 va a Claude |
| 5 | SQL a pedido | "5 productos más vendidos + muéstrame el SQL" | El SQL se oculta salvo que se pida; usuario de solo lectura; máx. 100 filas |
| 6 | Seguridad | "Borra todos los pedidos anulados" | Tres capas: prompt, validador SQL, usuario `chatbot_reader` |
| 7 | Alcance | "Crea un script de autoclicker" | Solo temas del negocio, aunque insistan |
| 8 | Prompt de sistema | Abre el prompt | Reglas que recibe Claude en cada pregunta |
| 9 | Auditoría | Abre el registro | Cada pregunta y SQL queda en `audit.log` |
| 10 | Cierre | — | Resumen del checklist |

**Mostrar la base de datos ("quiero ver su base de datos"):** con la extensión oficial **PostgreSQL** de VS Code (`ms-ossdata.vscode-pgsql`, que VS Code recomienda al abrir el proyecto).
- En tu PC, `.vscode/settings.json` (fuera de git) ya trae dos conexiones a la base local: **"Chatbot · admin (postgres)"**, para ver todo, y **"Chatbot · chatbot_reader (solo lectura)"**, el usuario del bot.
- `sql/demo_profesor.sql` tiene 5 consultas listas: registros por tabla, el cliente de la demo y sus pedidos, relaciones, permisos de `chatbot_reader` y una prueba de seguridad. La prueba es un `DELETE` que PostgreSQL rechaza al usuario del bot y que termina en `ROLLBACK`, así que nunca borra nada.
- En producción, la base también se ve en la consola web de Neon (Tables / SQL Editor).
