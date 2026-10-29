// Lookea · utilidades del backend (este archivo no es una ruta)
export const TOPES = {
  etiquetasPorIPDia: 60,   // fotos de prendas que una persona puede analizar al día
  outfitsPorIPDia: 25,     // veces que puede pedir outfits al día
  globalPorDia: 1200       // tope total de llamadas a la IA al día (protege tu cuota gratis)
};
export const json = (d, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
export const error = (codigo, mensaje, s = 400) => json({ error: codigo, mensaje }, s);
export const hoy = () => new Date().toISOString().slice(0, 10);
export const ipDe = (r) => r.headers.get("cf-connecting-ip") || "sin-ip";

export async function contar(env, clave, sumar = 0) {
  if (!env.DB) return 0;
  const k = "lookea:" + clave;
  const n = parseInt((await env.DB.get(k)) || "0", 10);
  if (sumar) await env.DB.put(k, String(n + sumar), { expirationTtl: 60 * 60 * 48 });
  return n + sumar;
}

// revisa topes; regresa un Response de error o null si puede seguir
export async function revisarTopes(env, request, tipo, porIP) {
  const d = hoy(), ip = ipDe(request);
  if ((await contar(env, `${d}:global`)) >= TOPES.globalPorDia)
    return error("tope_global", "Lookea está muy solicitada hoy. Intenta de nuevo mañana.", 429);
  if ((await contar(env, `${d}:${tipo}:${ip}`)) >= porIP)
    return error("tope_persona", "Llegaste al límite de hoy. Vuelve mañana.", 429);
  return null;
}
export async function sumarUso(env, request, tipo) {
  const d = hoy(), ip = ipDe(request);
  await contar(env, `${d}:global`, 1);
  await contar(env, `${d}:${tipo}:${ip}`, 1);
}

const MODELOS = (env) => [...new Set([env.GEMINI_TEXT_MODEL, "gemini-flash-lite-latest", "gemini-3.5-flash-lite", "gemini-flash-latest", "gemini-3.8-flash"].filter(Boolean))];

function leerJSON(texto) {
  const t = String(texto || "").trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  try { return JSON.parse(t); } catch (_) {}
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) return JSON.parse(t.slice(a, b + 1));
  throw new Error("La IA no regresó JSON válido");
}

async function llamar(env, model, body, ms = 30000) {
  let r;
  try {
    r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY }, body: JSON.stringify(body),
      signal: AbortSignal.timeout(ms)
    });
  } catch (e) {
    throw Object.assign(new Error(`Gemini (${model}): tardó demasiado o no respondió`), { status: 0, google: "timeout" });
  }
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(`Gemini ${r.status} (${model}): ${data?.error?.message || "error"}`), { status: r.status, google: data?.error?.message || "" });
  return data;
}

// Pide JSON a Gemini probando varios modelos si uno falla
export async function gemini(env, body) {
  let ultimo;
  for (const modelo of MODELOS(env)) {
    try {
      const data = await llamar(env, modelo, body);
      const texto = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
      if (!texto) throw new Error("Respuesta vacía");
      return leerJSON(texto);
    } catch (e) {
      ultimo = e; console.log("gemini intento fallido", e.message);
      if ((e.status === 400 && /api key/i.test(e.google || "")) || e.status === 401 || e.status === 403) break;
    }
  }
  throw ultimo || new Error("Sin modelos");
}
export { MODELOS, llamar };
