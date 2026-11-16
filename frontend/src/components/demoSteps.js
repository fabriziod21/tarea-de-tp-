// Guion de la demo en vivo (Módulo 8 de la guía). Cada paso dice qué decir y,
// si tiene `action`, el botón "▶" lo ejecuta por ti:
//   ask    -> envía la pregunta al chat
//   rag    -> abre la base vectorial y busca `query`
//   prompt -> abre el prompt de sistema
//   audit  -> abre el registro de auditoría
export const DEMO_STEPS = [
  {
    title: 'Presentación',
    say: 'Es un agente de IA que responde en español preguntas sobre la base de datos de una tienda. Claude es el cerebro, un servidor MCP le da 6 herramientas, el RAG con ChromaDB le da contexto del negocio, PostgreSQL es de solo lectura y además consulta RENIEC.',
    tip: 'Señala el panel izquierdo: herramientas MCP, contexto RAG y estado del sistema (todo en verde).',
  },
  {
    title: 'La base de datos (VS Code)',
    say: 'Esta es la base PostgreSQL: clientes, categorías, productos, pedidos y su detalle. El chatbot se conecta con el usuario chatbot_reader, que solo tiene permiso de SELECT.',
    tip: 'Cambia a VS Code: ícono del elefante (PostgreSQL) → "Chatbot · admin" → Tables. Luego abre sql/demo_profesor.sql y ejecuta las consultas 1 y 4.',
  },
  {
    title: 'Flujo completo: RENIEC + PostgreSQL',
    action: { type: 'ask', text: '¿Quién es el cliente con DNI 12345678 y cuántos pedidos tiene?' },
    say: 'Primero el RAG busca contexto en ChromaDB. Luego Claude decide usar dos herramientas a la vez: RENIEC para el nombre oficial y PostgreSQL para contar los pedidos. La respuesta llega en streaming, palabra por palabra.',
    tip: 'Mientras responde, señala cómo se encienden consultar_reniec_dni y run_readonly_query en el panel.',
  },
  {
    title: 'RAG: base vectorial ChromaDB',
    action: { type: 'rag', query: '¿cuánto facturamos este mes?' },
    say: 'Los documentos del negocio están guardados como vectores de 384 números en ChromaDB. La búsqueda es por significado: "facturamos" encuentra "ventas del mes" aunque no comparten palabras. Los fragmentos con puntaje mayor a 0.25 se envían a Claude.',
    tip: 'Haz clic en el primer resultado para mostrar su texto. Cierra con Esc.',
  },
  {
    title: 'Consulta con agregación y SQL a pedido',
    action: { type: 'ask', text: '¿Cuáles son los 5 productos más vendidos? Muéstrame el SQL que usaste.' },
    say: 'Por defecto el usuario no ve el SQL. Aquí lo pido, así que se muestra la consulta que generó Claude. Se ejecuta con el usuario chatbot_reader, que solo puede leer, y nunca devuelve más de 100 filas.',
    tip: 'Señala el bloque SQL y la línea "⎿ 5 filas · N ms" debajo de la herramienta.',
  },
  {
    title: 'Seguridad: intentar borrar datos',
    action: { type: 'ask', text: 'Borra todos los pedidos anulados.' },
    say: 'El asistente no puede modificar datos. Hay tres capas: las reglas del prompt, el validador SQL que rechaza INSERT, UPDATE y DELETE, y el usuario de base de datos de solo lectura. Aunque Claude lo intentara, el validador lo bloquearía.',
    tip: 'Para demostrarlo en la base misma: en VS Code, con la conexión "chatbot_reader", ejecuta la consulta 5 de sql/demo_profesor.sql. PostgreSQL la rechaza.',
  },
  {
    title: 'Solo temas del negocio',
    action: { type: 'ask', text: 'Crea un script de autoclicker en Python.' },
    say: 'Solo atiende preguntas sobre la tienda, RENIEC y SUNAT. Lo demás lo rechaza en una frase y sugiere preguntas válidas, aunque el usuario insista.',
  },
  {
    title: 'Prompt de sistema',
    action: { type: 'prompt' },
    say: 'Estas son las instrucciones que recibe Claude en cada pregunta: el alcance, cómo usar las herramientas y cómo responder (montos en soles, fechas, sin SQL salvo pedido, privacidad).',
    tip: 'Desplázate hasta la sección "Alcance". Cierra con Esc.',
  },
  {
    title: 'Auditoría',
    action: { type: 'audit' },
    say: 'Cada pregunta y cada SQL quedan registrados en backend/logs/audit.log: usuario, pregunta, SQL, tiempo y filas. Si un SQL se rechaza, también queda registrado.',
    tip: 'Haz clic en una línea "sql" para mostrar el JSON completo.',
  },
  {
    title: 'Cierre',
    say: 'En resumen: preguntas en lenguaje natural, RENIEC, RAG con ChromaDB, SQL de solo lectura validado, sin SQL visible salvo que se pida, y auditoría de todo. El código está en el repositorio, con pruebas automáticas.',
  },
];

export const ACTION_LABEL = {
  ask: 'preguntar',
  rag: 'abrir chroma',
  prompt: 'abrir prompt',
  audit: 'abrir auditoría',
};
