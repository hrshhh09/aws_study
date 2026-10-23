// Sequentially generate flashcard decks via an OpenAI-compatible proxy (copilot-api).
// Usage (from flashcards/web):  node scripts/generate.mjs [03-EC2 06-VPC ...]
// Env: API_URL (default http://localhost:4140), MODEL (default claude-sonnet-5.5), FORCE=1 to overwrite.
import { readFileSync, writeFileSync, readdirSync, existsSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const FC = fileURLToPath(new URL('../../', import.meta.url));            // flashcards/
const GUIDES = fileURLToPath(new URL('../../../aws-saa-c03-guides/topic-guides/', import.meta.url));
const API = process.env.API_URL ?? 'http://localhost:4140';
const MODEL = process.env.MODEL ?? 'claude-sonnet-5.5';
const MAX_TRIES = 3;

const sp = readFileSync(FC + 'SYSTEM_PROMPT.md', 'utf8');
const SYSTEM = sp.slice(sp.indexOf('## Part B')) +
  '\n\nOVERRIDE: In this session output the COMPLETE deck as ONE JSON object ' +
  '{"schemaVersion":"1.0","deck":{…},"cards":[…]} — header and all cards for the whole guide. JSON only, no fences.';
const example = readFileSync(FC + 'decks/07-route53.json', 'utf8').split('\n').slice(0, 4).join('\n');

const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const deckId = (f) => kebab(f.replace(/\.md$/, ''));

const existing = new Set(readdirSync(FC + 'decks').filter((f) => !f.includes('sample')).map((f) => f.slice(0, 2)));
let files = process.argv.slice(2).map((a) => a.replace(/\.md$/, '') + '.md');
if (!files.length) files = readdirSync(GUIDES).filter((f) => /^\d\d-/.test(f) && f !== '00-README.md').sort();

async function chat(messages) {
  const r = await fetch(API + '/v1/chat/completions', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, messages, max_tokens: 64000, temperature: 0.2 }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const c = (await r.json()).choices[0];
  return { text: c.message.content ?? '', finish: c.finish_reason };
}
// Keep asking the model to continue while output is truncated or JSON is incomplete.
async function chatFull(messages) {
  let text = '';
  for (let i = 0; i < 8; i++) {
    const { text: part, finish } = await chat(i ? [...messages, { role: 'assistant', content: text },
      { role: 'user', content: 'Your output was cut off. Continue EXACTLY from the last character, no repetition, no fences.' }] : messages);
    text += i ? part.replace(/^```(json)?\n?/, '') : part;
    const done = (() => { try { JSON.parse(extract(text)); return true; } catch { return false; } })();
    if (done) break;
    if (finish !== 'length' && i > 0 && !part.trim()) break;
    console.log(`  …continuing (${text.length} chars, finish=${finish})`);
  }
  return text;
}
const extract = (t) => t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1);

for (const f of files) {
  const id = deckId(f);
  const out = FC + 'decks/' + id + '.json';
  if (!process.env.FORCE && existing.has(f.slice(0, 2))) { console.log(`skip ${id} (exists)`); continue; }
  const src = readFileSync(GUIDES + f, 'utf8');
  const messages = [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: `DECK_ID=${id}\nSECTION=${parseInt(f)}\nSOURCE_FILE=topic-guides/${f}\n\nFormat example (first lines of another deck):\n${example}\n\nNotes:\n${src}` },
  ];
  console.log(`\n▶ ${f} → ${id} (${src.split('\n').length} lines, ${MODEL})`);
  let ok = false;
  for (let t = 1; t <= MAX_TRIES && !ok; t++) {
    let text;
    try { text = await chatFull(messages); } catch (e) { console.log(`  try ${t}: ${e.message}`); continue; }
    const json = extract(text);
    try { writeFileSync(out, JSON.stringify(JSON.parse(json)).replace(/\},\{"id"/g, '},\n{"id"') + '\n'); }
    catch (e) { writeFileSync(out, json); }
    try {
      execFileSync('node', [FC + 'web/scripts/validate.mjs', out], { encoding: 'utf8' });
      ok = true;
      console.log(`  ✓ valid, ${JSON.parse(readFileSync(out, 'utf8')).cards.length} cards`);
    } catch (e) {
      const errs = (e.stdout || e.message).slice(0, 3000);
      console.log(`  try ${t} invalid:\n${errs}`);
      messages.push({ role: 'assistant', content: json }, { role: 'user', content: `Validation errors:\n${errs}\nReturn the full corrected deck JSON only.` });
    }
  }
  if (!ok) console.log(`  ✗ ${id} FAILED — left invalid file for inspection`);
  if (ok && id === '01-iam' && existsSync(FC + 'decks/01-iam.sample.json')) unlinkSync(FC + 'decks/01-iam.sample.json');
}
execFileSync('node', [FC + 'web/scripts/manifest.mjs'], { stdio: 'inherit' });
