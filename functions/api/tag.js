// POST /api/tag  { foto:{mimeType,data} }  ->  { nombre, tipo, color, hex, etiquetas[] }
import { json, error, revisarTopes, sumarUso, gemini, TOPES } from "./_lib.js";

const PROMPT = `Eres estilista de moda en México. Mira la foto de UNA prenda o accesorio y descríbela.
Responde SOLO con JSON:
{"nombre":"nombre corto en español, ej. Blusa blanca de botones","tipo":"top|bottom|falda|vestido|abrigo|calzado|accesorio","color":"color principal en español","hex":"#RRGGBB del color principal","etiquetas":["2 a 5 de: escuela, trabajo, salida casual, cita, fiesta, deporte, calor, templado, frío, lluvia"]}
Reglas de tipo: top = blusa/playera/camisa/top; bottom = pantalón/jeans/short/leggings; abrigo = chamarra/suéter/sudadera/saco; calzado = cualquier zapato; accesorio = bolsa/cinturón/joyería/gorra.
Si la foto no es una prenda o accesorio, o muestra a una persona sin que se distinga una prenda, responde {"error":"no_prenda"}.`;

export async function onRequestPost({ request, env }) {
  const { foto } = await request.json().catch(() => ({}));
  if (!foto || typeof foto.data !== "string" || !/^image\/(jpeg|png|webp)$/.test(foto.mimeType || ""))
    return error("foto_invalida", "Sube una foto JPG, PNG o WebP.");
  if (foto.data.length > 3_000_000) return error("foto_grande", "La foto es muy pesada.");
  const tope = await revisarTopes(env, request, "tag", TOPES.etiquetasPorIPDia);
  if (tope) return tope;
  try {
    const r = await gemini(env, {
      contents: [{ parts: [{ text: PROMPT }, { inlineData: { mimeType: foto.mimeType, data: foto.data } }] }],
      generationConfig: { responseMimeType: "application/json", temperature: 0.2 }
    });
    await sumarUso(env, request, "tag");
    return json(r);
  } catch (e) {
    console.log("tag error", e.message);
    return error("ia_fallo", "La IA no pudo reconocer la prenda. Puedes editarla a mano.", 502);
  }
}
