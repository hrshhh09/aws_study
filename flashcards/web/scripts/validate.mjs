import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv/dist/2020.js';
const root = fileURLToPath(new URL('../../', import.meta.url));
const schema = JSON.parse(readFileSync(root + 'deck.schema.json', 'utf8'));
const validate = new Ajv({ allErrors: true }).compile(schema);
const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(root + 'decks').filter((f) => f.endsWith('.json') && f !== 'index.json').map((f) => root + 'decks/' + f);
let bad = 0;
const ids = new Map();
for (const f of files) {
  const errs = [];
  let deck;
  try { deck = JSON.parse(readFileSync(f, 'utf8')); } catch (e) { errs.push('JSON parse: ' + e.message); }
  if (deck && !validate(deck)) errs.push(...validate.errors.map((e) => `${e.instancePath || '/'} ${e.message}`));
  if (deck?.cards && deck?.deck) {
    const subs = new Set([...(deck.deck.subtopics ?? []).map((s) => s.id), 'patterns', 'pocket-card']);
    for (const c of deck.cards) {
      if (ids.has(c.id)) errs.push(`duplicate card id ${c.id} (also in ${ids.get(c.id)})`); else ids.set(c.id, f);
      if (!subs.has(c.subtopic)) errs.push(`${c.id}: unknown subtopic "${c.subtopic}"`);
      if (c.choices && c.choices.filter((x) => x.correct).length !== 1) errs.push(`${c.id}: MCQ must have exactly one correct choice`);
    }
  }
  if (errs.length) { bad++; console.log(`✗ ${f}\n  - ${errs.join('\n  - ')}`); } else console.log(`✓ ${f}`);
}
process.exit(bad ? 1 : 0);
