# Rankenstein v2.0 — First-Run Bootstrap Interview

**Purpose:** produce a confirmed `BRAND.md` with minimal friction the first time
Rankenstein runs in a project. Config is *generated with* the user, never demanded.

---

## Trigger
Run this flow when the skill is invoked **AND** no `BRAND.md` exists (check project root,
then `state_dir`). Once `BRAND.md` exists, skip straight to the pipeline. **Do not run on
every invocation.** Re-run only on (a) explicit user request, or (b) a drift signal (below).

## Hard guarantee
The flow never silently invents a brand and proceeds.
- **Interactive first-run:** always ends with a human-confirmed `BRAND.md`.
- **Headless first-run with no config:** STOP and notify via the `notify` channel —
  *"No brand config found. Run me interactively once to set up."* A scheduled run must
  not auto-guess a brand identity.

---

## Acquisition paths (offer in this order)

### Path 1 — URL bootstrap (default, lowest friction)
1. Ask: *"What's your website?"* (or read `url` if already in project knowledge).
2. `web_fetch` the homepage + about / products pages.
3. Infer a DRAFT config: brand, facets (from product/theme language), candidate
   competitors (from positioning/comparisons), voice tone, brand facts (certs, origin, USP).
4. Tag every inferred field `# inferred — confirm` so the user sees exactly what to check.

### Path 2 — Interview (no URL, or to fill gaps Path 1 couldn't infer)
Ask only what's still missing:
- Brand name + one-line description
- **Who do you write FOR, specifically?** (push for specificity — this powers the angle)
- 3-6 themes/facets you publish around
- Top 3 competitors (domains)
- Any words you NEVER use? Any formatting rules?
- Products/CTAs to link when relevant
- Any internal reports / stats / voice docs to cite?
- Where should drafts go, and how do you want to be notified?

### Path 3 — Ingest existing docs
If the project already holds brand material (knowledge files, a prior style guide,
existing trackers), read it and pre-fill the draft *before* asking anything.

---

## Confirm loop
1. Present the assembled draft `BRAND.md` in full; call out `# inferred` fields explicitly.
2. User edits / confirms.
3. Write `BRAND.md` to project root.
4. Initialize the state layer if absent (empty trackers / claimed-cluster store in `state_dir`).
5. Run the §5.4 capability probe once and **report** which firewall tier is available
   (Ahrefs / GSC / web-only). Do NOT store tool availability in config — it goes stale.

---

## Keep-in-loop (after first run)
- **Ask-when-unsure:** when a run finds a strong topic off the declared facets, ask via
  `notify` — *"Add '<facet>' as a facet? Y/N"* — never silently expand scope.
- **Drift check:** periodically (or on request) re-fetch the site and propose diffs
  (*"site added a product line — add as a facet?"*).
- **State currency is automatic:** every published cluster is appended to the state layer,
  so the brand's content memory is always current by construction.

---

## Degraded mode
No web access for the URL fetch → skip Path 1, go interview-only, and note the limitation.
