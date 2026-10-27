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

export async function gemini(env, body) {
  const model = env.GEMINI_TEXT_MODEL || "gemini-flash-latest";
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify(body)
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${data?.error?.message || "error"}`);
  const texto = (data?.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("");
  return JSON.parse(texto);
}
