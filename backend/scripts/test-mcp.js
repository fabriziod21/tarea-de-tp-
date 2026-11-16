// backend/scripts/test-mcp.js
//   node backend/scripts/test-mcp.js
// Prueba el MCP Server SIN Claude: se conecta por el mismo canal en memoria
// que usa el backend, lista las herramientas y llama a cada una.
const { getMcpClient, closeMcpClient } = require('../src/services/mcpClient.service');
const { closePool } = require('../src/config/database');

async function call(client, name, args = {}) {
  const result = await client.callTool({ name, arguments: args });
  const text = result.content.map((c) => c.text).join('\n');
  const status = result.isError ? '✖ error' : '✔ ok';
  console.log(`\n${status}  ${name}(${JSON.stringify(args)})`);
  console.log('   ' + text.slice(0, 400).replace(/\n/g, '\n   ') + (text.length > 400 ? ' …' : ''));
  return result;
}

async function main() {
  const client = await getMcpClient();
  const { tools } = await client.listTools();
  console.log('Herramientas expuestas por el MCP Server:');
  for (const t of tools) console.log(`  - ${t.name}: ${t.description.split('.')[0]}`);

  await call(client, 'list_tables');
  await call(client, 'describe_table', { table_name: 'pedidos' });
  await call(client, 'get_relationships', { table_name: 'pedidos' });
  await call(client, 'run_readonly_query', {
    sql: "SELECT c.nombres, c.apellido_paterno, COUNT(p.id) AS pedidos FROM clientes c JOIN pedidos p ON p.cliente_id = c.id WHERE c.dni = '12345678' GROUP BY c.id;",
  });
  await call(client, 'run_readonly_query', { sql: 'SELECT * FROM pedidos' }); // se recorta a 100 filas
  await call(client, 'run_readonly_query', { sql: 'DELETE FROM pedidos' }); // debe rechazarse
  await call(client, 'run_readonly_query', { sql: 'SELECT columna_que_no_existe FROM clientes' }); // error de PostgreSQL
  await call(client, 'consultar_reniec_dni', { dni: '12345678' });
  await call(client, 'consultar_reniec_dni', { dni: '123' }); // validación de entrada
}

main()
  .catch((err) => {
    console.error('Error:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeMcpClient();
    await closePool();
  });
