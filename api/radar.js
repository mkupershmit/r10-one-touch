import { buildRadar } from "../lib/radar.js";
export default async function handler(req, res) {
  try {
    const d = await buildRadar();
    // La CDN de Vercel guarda el resultado 1 minuto: si 20 redactores tocan "Actualizar" a la vez, los portales se leen una sola vez.
    res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
    res.status(200).json(d);
  } catch (e) {
    res.status(500).json({ error: "No se pudo armar el radar" });
  }
}
