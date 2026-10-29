// GET /api/salud  ->  diagnóstico de la IA y la base de datos (no muestra tu clave)
import { json, MODELOS, llamar } from "./_lib.js";
export async function onRequestGet({ env }) {
  const out = { clave_configurada: !!env.GEMINI_API_KEY, base_de_datos_conectada: !!env.DB, modelos: [] };
  if (env.GEMINI_API_KEY) for (const modelo of MODELOS(env)) {
    try { await llamar(env, modelo, { contents: [{ parts: [{ text: "Responde solo: ok" }] }] }); out.modelos.push({ modelo, estado: "FUNCIONA" }); }
    catch (e) { out.modelos.push({ modelo, estado: "FALLA", codigo: e.status || 0, detalle: String(e.google || e.message).slice(0, 200) }); }
  }
  out.resumen = !out.clave_configurada ? "Falta GEMINI_API_KEY en Cloudflare" : out.modelos.some((m) => m.estado === "FUNCIONA") ? "La IA funciona ✅" : "Ningún modelo responde";
  return json(out);
}
