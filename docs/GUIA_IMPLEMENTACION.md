# Guía de implementación: dejar el chatbot corriendo en una máquina nueva

> **Para Claude Code:** lee esta guía completa antes de empezar. Ejecuta los pasos **en orden**, comprueba el resultado esperado de cada uno y no avances si algo falla: busca primero la solución en la sección 9. Habla con el usuario en español. Las cosas que requieren crear cuentas o pegar secretos (sección 8) las hace **el usuario**, no tú.

**Resultado final:** en http://localhost:5173 se abre el chat. Responde preguntas como *"¿Quién es el cliente con DNI 12345678 y cuántos pedidos tiene?"*, con PostgreSQL local, ChromaDB local y el Claude Code del propio usuario como cerebro (sin API key).

---

## 1. Requisitos

Compruébalos y dile al usuario qué falta **antes** de instalar nada:

| Requisito | Cómo comprobarlo | Obligatorio |
|---|---|---|
| Node.js **20 o superior** (probado con 24) | `node --version` | Sí |
| npm 10+ | `npm --version` | Sí |
| Claude Code instalado **y con sesión iniciada** (CLI `claude` o la extensión de VS Code) | `claude --version`, o que exista la extensión `anthropic.claude-code` en VS Code | Sí, para `CLAUDE_PROVIDER=code` |
| Python **3.10+** | `python --version` (Windows) o `python3 --version` | Solo para ChromaDB (si no hay, el RAG usa un índice local) |
| ~2 GB libres de disco y ~3 GB de RAM libres | — | Sí |

No hace falta instalar PostgreSQL ni Docker: el proyecto trae un PostgreSQL 17 embebido.

Puertos que se usan: **5433** (PostgreSQL), **8000** (ChromaDB), **3001** (API) y **5173** (web). Si alguno está ocupado, mira la sección 9.

## 2. Instalar dependencias

```bash
npm install
```

- Tarda unos minutos e instala los 4 workspaces.
- Si npm avisa de **scripts de instalación bloqueados**, ejecuta `npm approve-scripts` y aprueba: `onnxruntime-node`, `protobufjs`, `@firebase/util` y `@embedded-postgres/<tu-plataforma>`. Después vuelve a correr `npm install`.

**Esperado:** termina sin errores (los avisos `deprecated` no importan).

## 3. Configuración local

```bash
npm run setup
```

Crea `backend/.env` y `frontend/.env` con valores de desarrollo:
- `CLAUDE_PROVIDER=code`
- `AUTH_DISABLED=true`
- `RENIEC_MOCK=true`
- PostgreSQL en `localhost:5433`
- una contraseña aleatoria para `chatbot_reader`

**Nunca sobrescribe** un `.env` que ya exista.

**Esperado:** `✔ backend/.env creado` y `✔ frontend/.env creado`.

## 4. ChromaDB (recomendado: es lo que pide la guía del curso)

```bash
npm run chroma:setup
```

- Crea `.venv-chroma/` con Python, instala `chromadb` (varios cientos de MB) y cambia `RAG_PROVIDER` a `chroma` en `backend/.env`.
- **No necesita cuenta ni Docker.** La web de Chroma Cloud no hace falta; si muestra `SIGNUPS_DISABLED`, ignórala.
- Si no hay Python, **sáltate este paso**: el RAG funciona igual con `RAG_PROVIDER=local`.

**Esperado:** `✔ ChromaDB instalado` y `✔ backend/.env: RAG_PROVIDER=local -> chroma`.

## 5. Arrancar (dos procesos que se quedan corriendo)

Ejecútalos **en segundo plano** (son servidores, no terminan) y en este orden:

**Proceso 1: base de datos**
```bash
npm run db:dev
```
La primera vez crea la base `chatbot_urp`, 5 tablas (clientes, categorias, productos, pedidos, detalle_pedido), datos de prueba y el usuario `chatbot_reader`.

**Esperado:** `PostgreSQL local listo en localhost:5433 (base de datos: chatbot_urp)`.

**Proceso 2: ChromaDB + backend + frontend**
```bash
npm run dev
```

**Esperado** (puede tardar ~30 s la primera vez, porque descarga el modelo de embeddings, de ~120 MB):
```
[chroma] ✔ ChromaDB escuchando en http://127.0.0.1:8000 · datos en chroma_db/
[api] API escuchando en http://127.0.0.1:3001
[api]   Claude: Claude Code (sonnet) · RAG: chroma · Auth: DESACTIVADA (dev)
[api]   Claude Code: <ruta al ejecutable de claude>   (si dice "⚠ No se encontró Claude Code", ver sección 9)
[api]   MCP Server conectado (en memoria)
[api]   RAG listo
[web]   ➜  Local:   http://localhost:5173/
```

Si ChromaDB está vacío, el backend carga solo los documentos de `rag/documents/` la primera vez (`[rag] chroma está vacío: cargando...`).

## 6. Verificar

Haz todas estas comprobaciones e informa al usuario del resultado de cada una:

1. **Estado del sistema**
   ```bash
   curl http://localhost:3001/api/health
   ```
   Esperado: `"db":"ok"`, `"claude":"claude-code (local)"`, `"rag":"chroma"` (o `"local"`), `"reniec":"simulado"`.

2. **Pruebas automáticas** (no gastan créditos):
   ```bash
   npm test
   ```
   Esperado: `tests 17 · pass 17 · fail 0`.

3. **Herramientas MCP sin Claude:** `npm run test:mcp`. Debe listar las tablas y responder cada herramienta.

4. **Base de solo lectura:** `npm run db:test`. Esperado: `✔ Solo lectura confirmado (intento de UPDATE rechazado: ...)`.

5. **Una pregunta real** (usa una vez el Claude Code del usuario, ~10 s). Con Node, que funciona igual en todos los sistemas:
   ```bash
   node -e "fetch('http://localhost:3001/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({message:'¿Cuántos clientes hay?'})}).then(r=>r.json()).then(d=>console.log(d.reply||d.error))"
   ```
   Esperado: una respuesta que diga que hay **15 clientes**.

6. **Abrir la web:** http://localhost:5173. En el panel izquierdo, "sistema" debe estar en verde. Para probar la demo guiada, escribe `/demo` en el chat.

## 7. Ver la base de datos en VS Code (para mostrarla al profesor)

1. Instala la extensión oficial: `code --install-extension ms-ossdata.vscode-pgsql`. El proyecto ya la recomienda en `.vscode/extensions.json`.
2. Si VS Code muestra **Restricted Mode**, confía en la carpeta (Manage → Trust).
3. Ícono del elefante → **Add Connection** → pestaña **Connection String** → pega:
   ```
   postgresql://postgres:postgres_dev@localhost:5433/chatbot_urp?sslmode=disable
   ```
   Es el admin local de desarrollo. La contraseña `postgres_dev` está fijada en `scripts/dev-db.mjs` y solo sirve en esta PC.
4. Las tablas están en **chatbot_urp → Schemas → public → Tables**, no en "System".
   - Clic derecho sobre una tabla → **Select Top 1000** para ver los datos.
   - Clic derecho sobre la base → **Visualize Schema** para ver el diagrama.
5. `sql/demo_profesor.sql` tiene consultas listas. Para probar la conexión como `chatbot_reader`, la contraseña es `DB_PASSWORD` de `backend/.env`.

## 8. Lo que tiene que hacer el usuario (cuentas y secretos)

Con lo anterior todo funciona en local. Para cumplir el checklist completo del curso faltan cuentas que **solo el usuario puede crear**. Explícale cada una y pídele que pegue los valores **directamente en el `.env`**, nunca en el chat:

| Qué | Dónde se consigue | Qué cambia en `.env` |
|---|---|---|
| Login con Google (Firebase) | console.firebase.google.com → proyecto → Authentication → activar Google; configuración web y cuenta de servicio | `frontend/.env`: `VITE_FIREBASE_*` y `VITE_AUTH_DISABLED=false`. `backend/.env`: `FIREBASE_*` y `AUTH_DISABLED=false` |
| RENIEC/SUNAT reales | json.pe (100 créditos/mes gratis; **un solo token** sirve para DNI y RUC) | `backend/.env`: `JSONPE_API_TOKEN=...` y `RENIEC_MOCK=false` |
| Base en la nube | neon.tech (incluye pgvector) | Ver la sección "Base de datos en Neon" del README |
| Desplegar (Render/Vercel) | console.anthropic.com → API key | `CLAUDE_PROVIDER=api` y `ANTHROPIC_API_KEY=...` |

Después de editar el `.env`, reinicia `npm run dev`.

## 9. Problemas comunes

| Síntoma | Causa | Solución |
|---|---|---|
| `password authentication failed for user "chatbot_reader"` | La base local se creó con otra contraseña (otra máquina o un `.env` anterior) | `npm run db:dev -- --reset`. **Borra la base local**: pide permiso al usuario |
| `db:dev` dice que hay un `postmaster.pid` o que el puerto 5433 está en uso | PostgreSQL quedó abierto o la PC se apagó de golpe | Si no hay un proceso `postgres` corriendo, borra `.dev-db/data/postmaster.pid` y vuelve a intentar |
| `EADDRINUSE` en 3001, 5173 o 8000 | Otro `npm run dev` sigue abierto | Ciérralo (o termina el proceso que usa ese puerto) |
| `⚠ No se encontró Claude Code` al arrancar, o `No se pudo ejecutar Claude Code` al preguntar | Claude Code no está instalado o no está en el PATH | Instálalo e inicia sesión; o define `CLAUDE_CODE_PATH=<ruta al ejecutable>` en `backend/.env` |
| `Claude Code no respondió (...). ¿Iniciaste sesión en Claude Code?` | Sesión de Claude Code cerrada | El usuario abre Claude Code e inicia sesión (`claude` en una terminal o la extensión) |
| `Llegaste al límite de uso de tu cuenta de Claude` | Límite de la suscripción | Esperar, o usar `CLAUDE_PROVIDER=api` con una API key |
| `[chroma] ✖ ChromaDB no está instalado` | No se corrió `npm run chroma:setup` | Córrelo, o deja `RAG_PROVIDER=local` (funciona igual) |
| El panel dice `rag: local (respaldo)` | ChromaDB apagado | Revisa la línea `[chroma]` de `npm run dev` |
| La primera pregunta tarda mucho | Descarga del modelo de embeddings (~120 MB, una sola vez) | Esperar; las siguientes son rápidas |
| La pregunta se queda "pensando" | El backend se reinició a mitad de la consulta | No edites archivos durante una consulta; el chat avisa tras 45 s |
| `npm install` no deja ejecutar scripts | npm 11 bloquea los scripts de instalación | `npm approve-scripts` (sección 2) |
| La PC se pone lenta | Embeddings + Claude Code + servidores | Cierra programas pesados; no ejecutes instalaciones grandes con todo encendido |

## 10. Reglas para Claude durante la instalación

- No subas a git ni muestres en el chat el contenido de `backend/.env`, `frontend/.env` ni `.vscode/settings.json`.
- No cambies `CLAUDE_PROVIDER=code` a un despliegue público: la suscripción de Claude es personal.
- No modifiques `sql/create_readonly_user.sql` ni el validador SQL para dar más permisos al bot.
- No borres `.dev-db/`, `chroma_db/` ni la base local sin permiso del usuario.
- Al terminar, resume al usuario qué quedó funcionando, qué falta de la sección 8 y cómo arrancarlo otra vez (`npm run db:dev` + `npm run dev`).
