// mcp-server/src/services/reniec.service.js
// Cliente de la API de Json.pe (RENIEC / SUNAT).
//
// Corrección de la guía: el endpoint real de Json.pe es
//   POST https://api.json.pe/api/dni   body: { "dni": "12345678" }
//   POST https://api.json.pe/api/ruc   body: { "ruc": "20552103816" }
// con el header Authorization: Bearer <token>   (docs.json.pe)
// La URL GET /v2/reniec/dni?numero=... de la guía corresponde a otro proveedor.
// Json.pe tampoco devuelve fecha de nacimiento, sexo ni estado civil.
require('../config/env');

const BASE_URL = (process.env.JSONPE_BASE_URL || 'https://api.json.pe').replace(/\/+$/, '');
const TIMEOUT_MS = 10000;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora: cada consulta real gasta 1 crédito

const cache = new Map();

class ReniecError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ReniecError';
    this.status = status;
  }
}

function isMock() {
  return process.env.RENIEC_MOCK === 'true';
}

function fromCache(key) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value;
  cache.delete(key);
  return null;
}

async function postJsonPe(endpoint, body) {
  const token = process.env.JSONPE_API_TOKEN;
  if (!token) {
    throw new ReniecError('Falta JSONPE_API_TOKEN en backend/.env (o activa RENIEC_MOCK=true para pruebas)', 500);
  }

  let response;
  try {
    response = await fetch(`${BASE_URL}/api/${endpoint}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new ReniecError(`No se pudo conectar con Json.pe: ${err.message}`, 502);
  }

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.success === false) {
    const message = payload.message || `Error al consultar Json.pe (HTTP ${response.status})`;
    throw new ReniecError(message, response.status === 404 ? 404 : 502);
  }
  return payload.data || payload;
}

// Datos ficticios para desarrollar sin gastar créditos (RENIEC_MOCK=true).
// Coinciden con los clientes de sql/seed.sql.
const MOCK_PERSONAS = {
  '12345678': ['JUAN', 'PEREZ', 'GARCIA'],
  '40112233': ['MARIA FERNANDA', 'QUISPE', 'HUAMAN'],
  '41223344': ['CARLOS ALBERTO', 'ROJAS', 'MENDOZA'],
};

function mockDni(dni) {
  const [nombres, paterno, materno] = MOCK_PERSONAS[dni] || ['PERSONA', 'DE', 'PRUEBA'];
  return {
    numero: dni,
    nombres,
    apellido_paterno: paterno,
    apellido_materno: materno,
    nombre_completo: `${paterno} ${materno}, ${nombres}`,
    codigo_verificacion: Number(dni.slice(-1)),
  };
}

/**
 * Consulta datos de una persona por DNI
 * @param {string} dni - Número de DNI (8 dígitos)
 */
async function consultarDNI(dni) {
  dni = String(dni || '').trim();
  if (!/^\d{8}$/.test(dni)) {
    throw new ReniecError('DNI inválido. Debe tener exactamente 8 dígitos.', 400);
  }

  const cached = fromCache(`dni:${dni}`);
  if (cached) return cached;

  const data = isMock() ? mockDni(dni) : await postJsonPe('dni', { dni });

  const nombres = data.nombres || '';
  const apellidoPaterno = data.apellido_paterno || '';
  const apellidoMaterno = data.apellido_materno || '';

  const result = {
    dni: data.numero || dni,
    nombres,
    apellidoPaterno,
    apellidoMaterno,
    nombreCompleto: [nombres, apellidoPaterno, apellidoMaterno].filter(Boolean).join(' '),
    codigoVerificacion: data.codigo_verificacion ?? null,
    fuente: isMock() ? 'RENIEC (datos simulados, RENIEC_MOCK=true)' : 'RENIEC vía Json.pe',
  };

  cache.set(`dni:${dni}`, { at: Date.now(), value: result });
  return result;
}

/**
 * Consulta datos de una empresa por RUC
 * @param {string} ruc - Número de RUC (11 dígitos)
 */
async function consultarRUC(ruc) {
  ruc = String(ruc || '').trim();
  if (!/^\d{11}$/.test(ruc)) {
    throw new ReniecError('RUC inválido. Debe tener exactamente 11 dígitos.', 400);
  }

  const cached = fromCache(`ruc:${ruc}`);
  if (cached) return cached;

  const data = isMock()
    ? { ruc, nombre_o_razon_social: 'EMPRESA DE PRUEBA S.A.C.', estado: 'ACTIVO', condicion: 'HABIDO', direccion_completa: 'AV. EJEMPLO 123, LIMA' }
    : await postJsonPe('ruc', { ruc });

  const result = {
    ruc: data.ruc || ruc,
    razonSocial: data.nombre_o_razon_social || '',
    estado: data.estado || '',
    condicion: data.condicion || '',
    direccion: data.direccion_completa || data.direccion || '',
    fuente: isMock() ? 'SUNAT (datos simulados, RENIEC_MOCK=true)' : 'SUNAT vía Json.pe',
  };

  cache.set(`ruc:${ruc}`, { at: Date.now(), value: result });
  return result;
}

module.exports = { consultarDNI, consultarRUC, ReniecError };
