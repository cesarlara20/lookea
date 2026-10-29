// GET /api/salud  ->  diagnóstico de la IA y la base de datos (no muestra tu clave)
// Prueba todos los modelos al mismo tiempo, con máximo 12 segundos cada uno.
import { json, MODELOS, llamar } from "./_lib.js";
export async function onRequestGet({ env }) {
  const out = { clave_configurada: !!env.GEMINI_API_KEY, base_de_datos_conectada: !!env.DB, modelos: [] };
  if (env.GEMINI_API_KEY) out.modelos = await Promise.all(MODELOS(env).map(async (modelo) => {
    try { await llamar(env, modelo, { contents: [{ parts: [{ text: "Responde solo: ok" }] }] }, 12000); return { modelo, estado: "FUNCIONA" }; }
    catch (e) { return { modelo, estado: "FALLA", codigo: e.status || 0, detalle: String(e.google || e.message).slice(0, 200) }; }
  }));
  out.resumen = !out.clave_configurada ? "Falta GEMINI_API_KEY en Cloudflare" : out.modelos.some((m) => m.estado === "FUNCIONA") ? "La IA funciona ✅" : "Ningún modelo responde";
  return json(out);
}
