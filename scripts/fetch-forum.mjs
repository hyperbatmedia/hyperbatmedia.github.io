// Lit le flux RSS du forum et écrit data/forum.json (5 derniers sujets).
// Lancé toutes les heures par GitHub (voir .github/workflows/forum.yml). Aucun service tiers.
import { writeFile, mkdir } from 'node:fs/promises';

const FEED = process.env.FORUM_FEED || 'https://retrogaminghyperbat.forumotion.com/feed/';
const OUT = 'data/forum.json';

const decode = (s) => s
  .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&amp;/g, '&');
const text = (s) => decode(s).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const tag = (block, names) => {
  for (const n of names) {
    const m = block.match(new RegExp('<' + n + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + n + '>', 'i'));
    if (m) return text(m[1]);
  }
  return '';
};

export function parseFeed(xml) {
  const items = [];
  for (const m of xml.matchAll(/<item[\s>][\s\S]*?<\/item>/gi)) {
    const b = m[0];
    const title = tag(b, ['title']);
    const link = tag(b, ['link']) || (b.match(/<guid[^>]*>([^<]+)<\/guid>/i) || [])[1] || '';
    const pub = tag(b, ['pubDate', 'dc:date']);
    const d = pub ? new Date(pub) : null;
    if (!title || !/^https:\/\//.test(link)) continue;
    items.push({
      title: title.slice(0, 140),
      link,
      date: d && !isNaN(d) ? d.toISOString() : '',
      author: tag(b, ['dc:creator', 'author']).slice(0, 60),
    });
  }
  return items.slice(0, 5);
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop());
if (isMain) {
  const res = await fetch(FEED, { headers: { 'User-Agent': 'RetroGamingHyperbat-home/1.0' } });
  if (!res.ok) throw new Error('Flux du forum : HTTP ' + res.status);
  const items = parseFeed(await res.text());
  if (!items.length) throw new Error('Flux du forum : aucun sujet trouvé (on garde l’ancien fichier)');
  await mkdir('data', { recursive: true });
  await writeFile(OUT, JSON.stringify({ updated: new Date().toISOString(), items }, null, 2) + '\n');
  console.log(items.length + ' sujets écrits dans ' + OUT);
}
