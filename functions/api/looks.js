// POST /api/looks  { ocasion, clima, prendas:[{id,nombre,tipo,color,etiquetas}] }  ->  { outfits[], falta }
import { json, error, revisarTopes, sumarUso, gemini, TOPES } from "./_lib.js";

const limpio = (s, n) => String(s || "").replace(/[`]/g, "'").slice(0, n);

export async function onRequestPost({ request, env }) {
  const b = await request.json().catch(() => ({}));
  const prendas = (Array.isArray(b.prendas) ? b.prendas : []).slice(0, 150).map((p) => ({
    id: limpio(p.id, 20), nombre: limpio(p.nombre, 40), tipo: limpio(p.tipo, 12), color: limpio(p.color, 24),
    etiquetas: (Array.isArray(p.etiquetas) ? p.etiquetas : []).slice(0, 8).map((t) => limpio(t, 20))
  }));
  if (prendas.length < 3) return error("pocas_prendas", "Agrega al menos 3 prendas.");
  const tope = await revisarTopes(env, request, "looks", TOPES.outfitsPorIPDia);
  if (tope) return tope;

  const prompt = `Eres estilista de moda en México. Arma 3 outfits distintos SOLO con estas prendas del clóset de la usuaria.
Ocasión: ${limpio(b.ocasion, 30) || "casual"}. Clima: ${limpio(b.clima, 20) || "templado"}.
Clóset (JSON): ${JSON.stringify(prendas)}
Reglas: cada outfit lleva (parte de arriba + pantalón o falda) o un vestido, más zapatos; agrega abrigo si el clima es frío o lluvia; un accesorio opcional. Usa solo ids que existan. Combina colores con criterio y explica en una frase por qué funciona. Español de México, cercano y breve.
Además sugiere UNA prenda que le falta para sacarle más provecho a su clóset (algo concreto y fácil de conseguir).
Responde SOLO con JSON:
{"outfits":[{"titulo":"nombre corto y con estilo","ids":["id1","id2","id3"],"porque":"1 frase","tip":"tip de estilo corto"}],"falta":{"nombre":"ej. Cinturón café delgado","porque":"1 frase","busqueda":"2 a 5 palabras para buscar en Mercado Libre"}}`;
  try {
    const r = await gemini(env, { contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.8 } });
    await sumarUso(env, request, "looks");
    return json(r);
  } catch (e) {
    console.log("looks error", e.message);
    return error("ia_fallo", "La IA no respondió.", 502);
  }
}
