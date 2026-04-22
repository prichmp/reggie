# Reggie — Regex Utility Static Site

A RegExr-style static web app built with Vite + React + TypeScript. The user enters a regex, sees it syntax-highlighted, then pastes subject text into a large editor where matches are highlighted inline and hovered matches reveal group details. Two utilities — **Replace** and **List** — operate on the match set using user-supplied multiline templates.

## Tech Stack

- **Vite** (SPA, static build output — deployable to any static host)
- **React 18** + **TypeScript** (strict mode)
- **No runtime regex engine beyond the browser's native `RegExp`** — keeps the bundle small and matches user expectations of JS regex semantics.
- **CSS Modules** for component-scoped styling (no UI library — the surface is small).
- **Vitest** for unit tests on the regex parser and utility logic.

## Project Layout

```
reggie/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── main.tsx                 # React entry
│   ├── App.tsx                  # top-level layout + state
│   ├── components/
│   │   ├── RegexInput.tsx       # input field + flags + highlighted overlay
│   │   ├── SubjectEditor.tsx    # textarea + match-highlight overlay + hover tooltip
│   │   ├── MatchTooltip.tsx     # floating panel showing match + groups
│   │   ├── Toolbar.tsx          # tab switcher: Replace | List
│   │   ├── ReplacePanel.tsx     # replacement template input + output
│   │   └── ListPanel.tsx        # per-match template input + output
│   ├── lib/
│   │   ├── regexTokenizer.ts    # tokenize a regex source string for coloring
│   │   ├── runRegex.ts          # safely execute RegExp + collect matches/groups
│   │   ├── expandTemplate.ts    # shared back-reference expander ($&, $n, $<name>, $$)
│   │   ├── applyReplace.ts      # map matches → replaced subject via expandTemplate
│   │   └── applyList.ts         # expand per-match template for each match
│   ├── styles/
│   │   ├── tokens.css           # color palette for regex tokens + match highlights
│   │   └── app.module.css
│   └── types.ts                 # MatchResult, RegexToken, etc.
└── tests/
    ├── regexTokenizer.test.ts
    ├── runRegex.test.ts
    ├── expandTemplate.test.ts
    ├── applyReplace.test.ts
    └── applyList.test.ts
```

## Data Model (`src/types.ts`)

```ts
type RegexTokenKind =
  | "literal" | "metachar" | "charclass" | "group-open" | "group-close"
  | "quantifier" | "anchor" | "escape" | "alternation" | "flag" | "error";

interface RegexToken { kind: RegexTokenKind; text: string; start: number; end: number; }

interface MatchResult {
  index: number;           // start offset in subject
  end: number;             // end offset (exclusive)
  text: string;            // full match
  // group offsets come from RegExp's `d` flag (match.indices); if a group
  // did not participate in the match, text is null and index/end are -1.
  groups: Array<{ name?: string; index: number; end: number; text: string | null }>;
}
```

## Feature Breakdown

### 1. Regex input with syntax highlighting
- `<RegexInput>` renders a transparent `<input>` layered over a `<div>` that shows the tokenized, colored regex. The overlay mirrors the input's scroll/selection so the caret is visible.
- A small flags field (`g`, `i`, `m`, `s`, `u`, `y`) sits to the right. Internally we always compile with `g` and `d` (hasIndices) — `g` so we can enumerate all matches with `matchAll`, `d` so each group carries its start/end offsets. Both are applied regardless of the user's toggle state for `g`; a disabled `g` only affects the Replace utility's semantics (first-match vs all), not enumeration. If the user sets `y` without `g`, we still compile with `g` added (sticky + global has anchor-at-`lastIndex` semantics — documented inline next to the flag toggle).
- `regexTokenizer.ts` walks the source once and emits `RegexToken[]`. It recognizes groups (incl. named, non-capturing, lookaround), character classes (as a single token span with nested escapes inside), quantifiers, anchors, alternation, and backslash escapes. Unrecognized or unbalanced constructs emit an `error` token so the UI can underline them red.
- `RegExp` construction errors are caught and shown as a status line under the input (e.g. `Invalid regex: Unterminated character class`).

### 2. Subject textarea with inline match highlights
- `<SubjectEditor>` uses the classic "textarea + mirrored div" pattern: a `<textarea>` stacked on top of a `<div aria-hidden>` that re-renders the subject text with `<mark>` spans around each match. The two elements share font metrics, padding, and scroll position.
- `runRegex.ts` executes the user's `RegExp` against the subject via `matchAll` (always available — see flag policy above, `g` is always on internally). Group offsets come from `match.indices` / `match.indices.groups` (requires the `d` flag, also always on). `matchAll` handles `lastIndex` advancement for zero-width matches on its own — no manual bump needed. Execution runs in a Web Worker with a ~500ms timeout so a pathological regex (e.g. `(a+)+b`) can't freeze the tab; on timeout we surface "regex timed out" in the status line and keep the previous match set.
- Each `<mark>` has `data-match-index` so hover handlers can look up the corresponding `MatchResult`.
- Hit-testing: the textarea sits above the overlay and captures pointer events, so the `mousemove` listener is attached to the editor container. On move we map cursor coords to a character offset (via a hidden mirror `<div>` or `document.caretPositionFromPoint`) and binary-search `matches` by `index`/`end` to find the active match. `<MatchTooltip>` anchors to the match's bounding rect. The tooltip lists: match number, full match text, and each group (name or index, plus value — `null` groups shown as dim "—").
- Performance:
  - Match computation is debounced (~80ms) and capped (e.g. 10k matches).
  - The overlay renders only the marks whose range intersects the visible viewport (windowed), since 10k inline `<mark>` nodes janks scroll/typing even below the cap. Visible range is recomputed on scroll and on subject change.
  - `useMemo` keys are split: `(pattern, flags)` → compiled regex, `(compiledRegex, subject)` → matches, so edits to one don't invalidate the other.

### 3. Replace utility (`<ReplacePanel>`)
- User enters a multiline replacement template. Supported back-references: `$&`, `$1`…`$n`, `$<name>`, `$$`. We intentionally do **not** support `` $` `` and `$'` so Replace and List share identical semantics via `expandTemplate`.
- Output is computed by walking the cached `MatchResult[]` and splicing each match's expanded template into the subject — i.e. we do **not** call `String.prototype.replace` directly, because doing so would bypass the shared expander and silently support `` $` `` / `$'`. Rendered in a read-only multiline preview with a copy-to-clipboard button.
- Template input is a `<textarea>` (newlines preserved). Output is debounced (~80ms) on both template and subject changes.

### 4. List utility (`<ListPanel>`)
- User enters a per-match template (multiline). For each match, we expand the template via `lib/expandTemplate.ts` (same function Replace uses) and concatenate results with a user-selectable separator (default: newline).
- Output shown in a read-only textarea with copy-to-clipboard, debounced alongside Replace.

### 5. Toolbar / tabs
- A single `<Toolbar>` switches between Replace and List panels. Only one is visible at a time to keep the layout simple. Both panels read from the same computed `MatchResult[]`, so switching is instant.

## UI Sketch

```
┌──────────────────────────────────────────────────────────┐
│  /  (?<word>\w+)\s+\1  /  gim   [✗ invalid / N matches]  │  ← RegexInput
├──────────────────────────────────────────────────────────┤
│                                                          │
│   Subject text with [matches] highlighted inline,        │  ← SubjectEditor
│   hovering one pops a tooltip with groups.               │
│                                                          │
├──────────────────────────────────────────────────────────┤
│   [ Replace ] [ List ]                                   │  ← Toolbar
│   template textarea  →  output textarea                  │
└──────────────────────────────────────────────────────────┘
```

## State Management

All state lives in `App.tsx` via `useState` + `useMemo` — the app is small enough that Context or Redux would be overkill.

- `pattern: string`, `flags: string`
- `subject: string`
- `mode: "replace" | "list"`, `replaceTemplate: string`, `listTemplate: string`, `listSeparator: string`
- Derived via `useMemo`: `compiledRegex | Error`, `matches: MatchResult[]`, `replaceOutput`, `listOutput`.

## Implementation Order

1. **Scaffold** — `npm create vite@latest reggie -- --template react-ts`, strip boilerplate, set up CSS tokens, Vitest config.
2. **`regexTokenizer` + tests** — pure function, easy to TDD.
3. **`RegexInput`** — wire input → tokenizer → colored overlay. Handle invalid-regex error display.
4. **`runRegex` + tests** — enumerate matches including groups, handle zero-width matches.
5. **`SubjectEditor`** — mirrored textarea/div overlay with `<mark>` spans and scroll sync.
6. **`MatchTooltip`** — hover tracking + positioning (flip when near viewport edges).
7. **`expandTemplate` + tests** — shared back-reference expansion.
8. **`ReplacePanel`** and **`ListPanel`** — consume matches and templates.
9. **`Toolbar`** — tab switching.
10. **Polish** — keyboard focus order, copy buttons, large-input perf cap, empty states.

## Open Questions / Decisions to Confirm

- **Regex engine**: stick with native `RegExp`, or add a PCRE-compatible WASM engine later for lookbehind-heavy patterns on older browsers? Native is simpler and sufficient for modern targets — recommend starting native.
- **Persistence**: save pattern/subject to `localStorage` so reloads don't wipe work? Small addition, worth it. Skip persisting `subject` if it exceeds ~1MB to stay well under the ~5MB quota.
- **Shareable URL**: encode state in the URL hash? Nice-to-have, defer past v1.
- **Cheat sheet panel** (RegExr has one): defer past v1 unless requested.

## Definition of Done (v1)

- `npm run dev` launches the app; typing a regex highlights it and highlights matches in the subject live.
- Hovering a match shows a tooltip with the full match and every group.
- Replace and List tabs both produce correct output for valid regexes.
- Invalid regexes show a clear error and don't crash the app.
- `npm run build` produces a fully static `dist/` deployable to GitHub Pages / Netlify / S3.
- Unit tests pass for `regexTokenizer`, `runRegex`, `expandTemplate`, `applyReplace`, and `applyList`.
