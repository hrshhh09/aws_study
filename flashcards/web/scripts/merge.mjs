// Usage: node web/scripts/merge.mjs <DECK_ID>
// Merges decks/<id>.part0.json (header) + part1..n (card arrays) → decks/<id>.json
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const dir = fileURLToPath(new URL('../../decks/', import.meta.url));
const id = process.argv[2];
if (!id) { console.error('usage: merge.mjs <DECK_ID>'); process.exit(1); }
const strip = (s) => s.trim().replace(/^```(?:json)?\s*/, '').replace(/```\s*$/, '');
const parts = readdirSync(dir)
  .map((f) => [f, f.match(new RegExp(`^${id}\\.part(\\d+)\\.json$`))])
  .filter(([, m]) => m).sort((a, b) => a[1][1] - b[1][1]).map(([f]) => f);
if (!parts.length) { console.error(`no ${id}.partN.json files in ${dir}`); process.exit(1); }
const deck = JSON.parse(strip(readFileSync(dir + parts[0], 'utf8')));
const prefix = id.replace(/^\d+-/, '');
const cards = parts.slice(1).flatMap((f) => JSON.parse(strip(readFileSync(dir + f, 'utf8'))));
cards.forEach((c, i) => { c.id = `${prefix}-${String(i + 1).padStart(3, '0')}`; }); // renumber to fix any gaps/overlaps
deck.cards = cards;
writeFileSync(dir + id + '.json', JSON.stringify(deck, null, 2) + '\n');
console.log(`✓ ${id}.json — ${cards.length} cards from ${parts.length - 1} chunk(s)`);
