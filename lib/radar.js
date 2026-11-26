// Arma el radar (zócalo, notas, tendencias y clima) leyendo los RSS de los portales.
// No usa IA: no gasta créditos. Los titulares con IA se piden aparte, solo cuando un redactor elige una nota.
const FUENTES = [
  { src: "Radio 10", id: "r10", grupo: true, url: "https://www.radio10.com.ar/rss/pages/home.xml", max: 12 },
  { src: "Minuto Uno", id: "m1", grupo: true, url: "https://www.minutouno.com/rss/pages/home.xml", max: 8 },
  { src: "C5N", id: "c5n", grupo: true, url: "https://www.c5n.com/rss/pages/ultimas-noticias.xml", max: 8 },
  { src: "Ámbito", id: "ambito", grupo: true, url: "https://www.ambito.com/rss/pages/home.xml", max: 6 },
  { src: "La Nación", id: "ln", url: "https://www.lanacion.com.ar/arc/outboundfeeds/rss/?outputType=xml", max: 6 },
  { src: "Perfil", id: "perfil", url: "https://www.perfil.com/feed", max: 6 },
  { src: "Infobae", id: "infobae", url: "https://www.infobae.com/arc/outboundfeeds/rss/", max: 6,
    keep: u => /\/(politica|economia|sociedad|deportes|teleshow)\//.test(u) && !/\/(peru|mexico|espana|colombia|america)\//.test(u) },
];
// Fotos: solo de los portales del grupo (mismo criterio que el botón "Copiar nota R10").
export const GRUPO_HOST = /(^|\.)(radio10\.com\.ar|minutouno\.com|c5n\.com|ambito\.com)$/i;
function attr(xml, re) { const m = xml.match(re); return m ? decode(m[1]) : ""; }
export function rssImage(it) {
  const u = attr(it, /<media:content[^>]*\burl="([^"]+)"[^>]*>/i) || attr(it, /<media:thumbnail[^>]*\burl="([^"]+)"/i)
    || attr(it, /<enclosure[^>]*\burl="([^"]+)"[^>]*type="image/i) || attr(it, /<enclosure[^>]*type="image[^"]*"[^>]*\burl="([^"]+)"/i)
    || attr(decode(it), /<img[^>]*\bsrc="(https:[^"]+)"/i);
  return /^https:\/\//.test(u) ? u : "";
}
export function ogImage(html) {
  const u = attr(html, /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i)
    || attr(html, /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
    || attr(html, /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
  return /^https:\/\//.test(u) ? u : "";
}
const TRENDS = "https://trends.google.com/trending/rss?geo=AR";
const SMN = "https://ws.smn.gob.ar/map_items/weather";
const H8 = 8 * 3600e3;

const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ", Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú", Ntilde: "Ñ", uuml: "ü", iexcl: "¡", iquest: "¿", laquo: "«", raquo: "»", ldquo: "“", rdquo: "”", lsquo: "‘", rsquo: "’", hellip: "…", ndash: "–", mdash: "—", deg: "°" };
export function decode(s) {
  return String(s || "")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n] ?? m);
}
function clean(s) {
  s = String(s || "").replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  s = decode(s); // los feeds a veces escapan el HTML de la descripción
  return decode(s.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}
function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return m ? m[1] : "";
}
function iso(d) {
  const t = new Date(d);
  if (isNaN(t)) return null;
  const ar = new Date(t.getTime() - 3 * 3600e3); // hora de Buenos Aires (-03:00, sin horario de verano)
  return ar.toISOString().slice(0, 19) + "-03:00";
}
export function parseRss(xml) {
  return (xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || []).map(it => {
    let link = clean(tag(it, "link")) || clean(tag(it, "guid"));
    return { title: clean(tag(it, "title")), url: link, time: iso(clean(tag(it, "pubDate")) || clean(tag(it, "dc:date"))),
             desc: clean(tag(it, "description")).slice(0, 400), it };
  }).filter(x => x.title && /^https:\/\//.test(x.url) && x.time);
}
const SECC = [
  ["Policiales", /\/(policiales?|seguridad|policia)\b/],
  ["Deporte", /\/(deportes?|futbol|seleccion|olimpicos|tenis|basquet|rugby|automovilismo)\b/],
  ["Espectáculos", /\/(espectaculos?|teleshow|rating-cero|show|famosos|tv|television|musica|farandula|gente)\b/],
  ["Cultura", /\/(cultura|libros|arte|teatro|cine)\b/],
  ["Internacionales", /\/(internacional(es)?|mundo|el-mundo|america-latina)\b/],
  ["Economía", /\/(economia|finanzas|negocios|dolar|mercados|campo)\b/],
  ["Política", /\/(politica|elecciones|gobierno)\b/],
  ["Sociedad", /\/(sociedad|informacion-general|clima|salud|educacion|tecnologia|ciudad|actualidad|noticias|nacional|pais)\b/],
];
export function seccion(url, it = "") {
  const p = (() => { try { return new URL(url).pathname.toLowerCase(); } catch { return ""; } })();
  for (const [s, re] of SECC) if (re.test(p)) return s;
  const cat = clean(tag(it, "category")).toLowerCase();
  for (const [s, re] of SECC) if (re.test("/" + cat.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, "-"))) return s;
  return "Sociedad";
}
function idFor(f, url) {
  const n = (url.match(/\D(\d{6,})(?!.*\d{6,})/) || [])[1];
  if (n) return f.id + "-" + n;
  const seg = url.split("?")[0].split("/").filter(Boolean).pop() || "";
  return f.id + "-" + seg.replace(/[^a-z0-9]+/gi, "-").slice(0, 50);
}
async function get(url, ms = 9000) {
  const r = await fetch(url, { signal: AbortSignal.timeout(ms), headers: { "user-agent": "Mozilla/5.0 (R10 One Touch radar)", accept: "*/*" } });
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.text();
}
export function parseTrends(xml) {
  return (xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || []).slice(0, 8).map(it => ({
    title: clean(tag(it, "title")), traffic: clean(tag(it, "ht:approx_traffic")), time: iso(clean(tag(it, "pubDate"))), via: "google",
    news: (it.match(/<ht:news_item>[\s\S]*?<\/ht:news_item>/gi) || []).slice(0, 2).map(n => ({
      title: clean(tag(n, "ht:news_item_title")), url: clean(tag(n, "ht:news_item_url")), source: clean(tag(n, "ht:news_item_source")) }))
      .filter(n => /^https:\/\//.test(n.url)),
  })).filter(t => t.title && t.time);
}
export function parseClima(json, now) {
  const arr = JSON.parse(json);
  const s = arr.find(x => /capital federal/i.test(x.name || "")) || arr.find(x => /buenos aires/i.test(x.name || ""));
  if (!s || !s.weather) return null;
  return { temp: s.weather.temp, hum: s.weather.humidity, desc: s.weather.description, fuente: "SMN", time: now };
}

export async function buildRadar(nowMs = Date.now()) {
  const now = iso(nowMs);
  const fuentes = [], desact = [], items = [];
  const res = await Promise.allSettled(FUENTES.map(f => get(f.url)));
  res.forEach((r, i) => {
    const f = FUENTES[i];
    if (r.status !== "fulfilled") { desact.push(f.src + " (no respondió)"); return; }
    let list = parseRss(r.value).filter(x => new Date(x.time).getTime() <= nowMs + 10 * 60e3);
    if (f.keep) list = list.filter(x => f.keep(x.url));
    list.sort((a, b) => new Date(b.time) - new Date(a.time));
    list = list.slice(0, f.max);
    if (!list.length) { desact.push(f.src + " (sin notas)"); return; }
    fuentes.push(f.src);
    list.forEach(x => items.push({ ...x, f }));
  });
  const fresh = items.filter(x => nowMs - new Date(x.time).getTime() <= H8);
  const seen = new Set(), uniq = [];
  for (const x of fresh.sort((a, b) => new Date(b.time) - new Date(a.time))) if (!seen.has(x.url)) { seen.add(x.url); uniq.push(x); }

  const ticker = uniq.slice(0, 22).map(x => ({ src: x.f.src, title: x.title, url: x.url, time: x.time, via: "web" }));
  // Notas: hasta 18, buscando que haya de todas las secciones y de varios portales.
  const withSec = uniq.map(x => ({ ...x, seccion: seccion(x.url, x.it) }));
  const picked = [], used = new Set();
  for (const s of ["Política", "Economía", "Sociedad", "Deporte", "Espectáculos", "Cultura", "Policiales", "Internacionales"])
    for (const x of withSec.filter(y => y.seccion === s).slice(0, 2)) { picked.push(x); used.add(x.url); }
  for (const x of withSec) { if (picked.length >= 18) break; if (!used.has(x.url)) { picked.push(x); used.add(x.url); } }
  const notas = picked.slice(0, 18).sort((a, b) => new Date(b.time) - new Date(a.time)).map(x => ({
    id: idFor(x.f, x.url), src: x.f.src, via: "web", url: x.url, time: x.time, seccion: x.seccion, importante: false, title: x.title, desc: x.desc,
    ...(x.f.grupo ? { img: rssImage(x.it) } : {}) }));
  // Si el RSS no trae la foto, se busca la imagen principal (og:image) en la página de la nota. Solo portales del grupo.
  await Promise.allSettled(notas.filter(n => n.img === "").map(async n => { n.img = ogImage(await get(n.url, 6000)); }));
  notas.forEach(n => { if (!n.img) delete n.img; });

  let tendencias = [], clima = null;
  const [tr, cl] = await Promise.allSettled([get(TRENDS), get(SMN)]);
  if (tr.status === "fulfilled") { try { tendencias = parseTrends(tr.value).filter(t => nowMs - new Date(t.time).getTime() <= H8); } catch {} } else desact.push("Google Trends (no respondió)");
  if (cl.status === "fulfilled") { try { clima = parseClima(cl.value, now); } catch {} }
  return { updated: now, fuentes, desactualizadas: desact, clima, ticker, tendencias, notas };
}
