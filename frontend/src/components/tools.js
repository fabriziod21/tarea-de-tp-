// Herramientas del MCP Server y cómo se muestran en la interfaz
export const TOOLS = [
  { name: 'list_tables', label: 'tablas', verb: 'Listando tablas' },
  { name: 'describe_table', label: 'esquema', verb: 'Leyendo el esquema' },
  { name: 'get_relationships', label: 'relaciones', verb: 'Revisando relaciones' },
  { name: 'run_readonly_query', label: 'consulta SQL', verb: 'Consultando PostgreSQL' },
  { name: 'consultar_reniec_dni', label: 'RENIEC', verb: 'Consultando RENIEC' },
  { name: 'consultar_sunat_ruc', label: 'SUNAT', verb: 'Consultando SUNAT' },
];

export const TOOL_BY_NAME = Object.fromEntries(TOOLS.map((t) => [t.name, t]));

/** Texto corto del resultado de una herramienta: "1 fila · 6 ms", "JUAN PEREZ GARCIA"... */
export function toolResultText(step) {
  if (step.state === 'running') return 'ejecutando…';
  if (step.state === 'error') return step.error || 'error';
  const parts = [];
  if (step.summary) parts.push(step.summary);
  if (typeof step.rowCount === 'number') parts.push(`${step.rowCount} fila${step.rowCount === 1 ? '' : 's'}${step.truncated ? ' (recortado)' : ''}`);
  if (typeof step.durationMs === 'number') parts.push(`${step.durationMs} ms`);
  return parts.join(' · ') || 'listo';
}
