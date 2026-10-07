# Flashcard website — implementation plan

## Goals
Load one or more deck JSON files (schema `deck.schema.json`), and let me study them interactively: flip cards, multiple-choice for scenario cards, filter, shuffle, track what I know. Zero backend, runs locally or on GitHub Pages.

## Stack
- **Vite + vanilla TypeScript** (or React if preferred) — static build, no server.
- `marked` (Markdown → HTML for `front`/`back`) + `DOMPurify`.
- `ajv` to validate decks against `deck.schema.json` at load time.
- `localStorage` for progress. No database.

## Folder layout
```
flashcards/
  deck.schema.json
  SYSTEM_PROMPT.md
  decks/
    index.json            # ["01-iam.json", "02-s3.json", ...]  (manifest)
    01-iam.json
  web/
    index.html
    src/
      main.ts             # router + bootstrap
      loader.ts           # fetch manifest + decks, ajv-validate, report errors
      store.ts            # progress state (localStorage)
      scheduler.ts        # Leitner box logic
      views/
        Home.ts           # deck list + progress bars
        Study.ts          # card session
        Browse.ts         # table/list of all cards with search
        Summary.ts        # end-of-session stats
      components/
        Card.ts           # flip card
        Choices.ts        # MCQ rendering
        Filters.ts
      styles.css
```
Vite `publicDir` points at `../decks` so decks are served as static files. Adding a new deck = drop JSON in `decks/` + add to `index.json` (or a tiny script `npm run manifest` that globs `decks/*.json`).

## Screens
1. **Home** — cards per deck: title, card count, % mastered, "due" count. Buttons: Study, Browse. Option "Study all decks".
2. **Study session**
   - Setup bar: filter by subtopic, type (`concept/compare/trap/scenario/signal/fact`), difficulty, tags; mode = *Due first* / *Shuffle* / *In order*; toggle "MCQ mode for scenario cards".
   - Card: front shown; **Space/click** flips (CSS 3D flip). Back shows `answer` (large), `explanation`, `mnemonic` (💡), `code` (monospace), `examTip` (badge), `sourceHeading` (small).
   - If `choices` present and MCQ mode on: render options; on click, mark right/wrong, show each `why`, then reveal back.
   - Grade buttons after flip: **Again (1) / Hard (2) / Good (3) / Easy (4)**.
   - Navigation: ← / → prev/next, progress bar "12 / 40", star/bookmark (S).
3. **Browse** — searchable list of all cards (front + answer), filter chips; click to open card.
4. **Summary** — correct %, cards per grade, weakest subtopics, "Restudy missed" button.

## Progress model (`store.ts`)
```ts
type CardProgress = { box: 0|1|2|3|4|5; lastSeen: number; due: number; seen: number; correct: number; starred?: boolean };
// localStorage key: "flashcards:v1" → { [cardId]: CardProgress }
```
Card IDs are globally unique (`iam-001`, `s3-014`), so progress survives deck regeneration as long as IDs are stable. Export/import progress as JSON (button on Home).

## Scheduling (Leitner, simple)
- Again → box 0 (due now, requeued within session after ~5 cards)
- Hard → box stays, due +1 day · Good → box+1 · Easy → box+2
- Box intervals: 0:0d, 1:1d, 2:3d, 3:7d, 4:14d, 5:30d. "Mastered" = box ≥ 4.

## Loading & validation (`loader.ts`)
1. fetch `decks/index.json` → fetch each deck.
2. Validate with ajv; also check: unique IDs across decks, subtopic refs exist, MCQ has exactly one correct.
3. Invalid deck → shown on Home with an error list (so I can re-prompt the generator agent), valid ones still load.

## Keyboard shortcuts
Space flip · 1–4 grade · ←/→ navigate · A–D pick MCQ choice · S star · / search.

## Build steps (milestones)
1. **M1** Scaffold Vite TS app, loader + validation, render one deck as a list (Browse).
2. **M2** Study view: flip card, Markdown rendering, keyboard nav, shuffle/filter.
3. **M3** MCQ mode for `choices`.
4. **M4** Progress + Leitner scheduling + Home progress bars + summary screen.
5. **M5** Polish: dark mode, mobile swipe (left = Again, right = Good), export/import progress, deploy to GitHub Pages.

## Generation workflow (other agent)
1. System prompt = `SYSTEM_PROMPT.md`; user message = DECK_ID + SOURCE_FILE + the .md content.
2. Save output to `decks/NN-name.json`; run `npm run validate` (ajv CLI against the schema).
3. If invalid, paste the errors back to the agent: "Fix these validation errors, output full JSON again."
4. Run `npm run manifest`, refresh the site.
