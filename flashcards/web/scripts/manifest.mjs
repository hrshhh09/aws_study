import { readdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const dir = fileURLToPath(new URL('../../decks/', import.meta.url));
const files = readdirSync(dir).filter((f) => f.endsWith('.json') && f !== 'index.json').sort();
writeFileSync(dir + 'index.json', JSON.stringify(files, null, 2) + '\n');
console.log(`manifest: ${files.length} deck(s)`);
