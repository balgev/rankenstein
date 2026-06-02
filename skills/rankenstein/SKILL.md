---
name: rankenstein-v2
description: Draft a research-first, on-brand, SEO + AEO-optimized blog post for a given brand and topic using the Rankenstein v2 engine. Runs proper keyword research with SERP-ownership-based keyword choice, an enforced adversarial outline critic, brand-voice-locked prose, validated + linked citations, history-aware dedup, and CMS-ready HTML with a content brief and image-generation prompts. Use whenever the user wants to write, draft, or generate a blog post, article, or SEO/AEO content for a specific brand — even if they only give a topic or a keyword. Also use it inside a scheduled task that produces a recurring blog post. Generic for any brand. The agent orchestrates the pipeline using subagents, so it runs natively in Cowork scheduled tasks and in Claude Code (no special runtime required).
---

# Rankenstein v2 — Research-First Blog Drafting Engine

Produce ONE publish-ready, on-brand blog post from a brand + a topic: research the keyword (including who owns the SERP and whether this brand can win it), commit to a sharp angle, harden the outline with an adversarial critic, write the prose, validate every citation, and output CMS-ready HTML with a content brief and image prompts. If pointed at the brand's project folder, also dedup against what the brand has already published.

## How to run this

**You are the orchestrator.** Work through the phases in order. For the parallel/heavy phases, **spawn subagents** (the Task/Agent capability) so independent work runs concurrently and your own context stays clean; do the lightweight judgment and the deterministic filtering/scoring/validation steps **yourself**. This needs no special runtime — it runs wherever subagents exist (Cowork chat and scheduled tasks, and Claude Code).

**Model tiers** (use what you have): strongest model (Opus-class) for the *angle*, *outline*, and *prose*; a faster model (Sonnet-class) for *research*, *SERP ownership*, *critique*, and *citation checks*; plain reasoning (no model) for the deterministic steps — keyword filtering, scoring, dedup math, assembling the brief, validators.

## Inputs

- **Brand context.** Load a `BRAND.md` from the project if one exists; otherwise run the first-run bootstrap in `bootstrap-interview.md` to build one from the brand's URL (template: `BRAND.template.md`). Read these from `BRAND.md`: `brand` (the name) and `url` from the frontmatter; the **Audience**, **Voice**, and **Brand facts** prose sections; and `voice_hard_rules` (banned words, em-dash/emoji policy), `competitors`, `facets`, `state_dir`, and `notify` from the frontmatter. If a field is absent, proceed without it (note lower confidence).
- **Topic + intent.** A seed keyword is enough — the engine does the real research and picks the final primary keyword itself.
- **`state_dir`** (optional). The brand's project folder. If provided (or present in `BRAND.md`), Phase 1 runs. If absent, this is a casual one-off — skip Phase 1, treat everything as net-new.

---

## Phase 1 — History (only if `state_dir` is given)

Spawn a subagent to build the brand's published-content history for dedup + internal linking:
- Glob `state_dir` for tracker files (`*.csv`, `*.xlsx`) and read ANY found, best-effort (any schema — extract title / keyword / url / intent however the columns are named; use python for `.xlsx`). **Do not modify these third-party trackers.**
- Also read the engine's own `rankenstein_history.csv` if present. If NO tracker or history file exists at all, create `rankenstein_history.csv` with header `date,primary_keyword,title,url_slug,intent,status`, and optionally seed it from the brand's `sitemap.xml` / blog index.
- Return the combined **covered** list: title + keyword + url + intent + (if a keyword provider is available) `parent_topic` per prior piece.

## Phase 2 — Keyword research (discover → filter → SERP ownership → choice)

**Provider discovery (concrete probe).** Find a keyword/SEO data tool by *capability*: scan the available tools (via ToolSearch in Claude Code, or the connected tools in Cowork) for any whose description offers keyword volume / difficulty / SERP / rankings — Ahrefs, SEMrush, BrightLocal, anything; the brand name does not matter. Make ONE minimal call to confirm it returns data. **Fall back to web search + estimate if** no such tool is connected, OR the call errors / returns nothing / is rate-limited. Try once, then fall back. Tag the keyword data `provider-verified` or `web-estimate` (lower confidence).

1. **Discover** (subagent): pull matching / related / question candidates with volume, KD, intent — return them **RAW**. Do NOT ask the subagent to self-filter; that proved unreliable.
2. **Filter (you, deterministically):** drop any candidate whose keyword matches a PLP/SKU pattern — colors, sizes, "for sale / buy / price / cheap", "near me" / city names, or competitor-brand terms. This is a hard rule you apply yourself, not a judgment you delegate.
3. **SERP ownership** (spawn a subagent per top ~3–4 candidate, in parallel): who owns this SERP (dominant domains + authority), how deep the ranking content runs, and — using the **authority gap** — can a brand of *this* DR realistically rank? (Giant-owned SERP = "no" for a small brand, "yes" for a strong one.)
4. **Choose** (you, strongest model). Pick the primary keyword + 4–6 secondaries on volume × KD × intent × AEO potential × **winnability**. Then dedup against the covered list (Phase 1):
   - **Cannibalization firewall (preferred, when a provider is available):** reject a candidate if it shares a `parent_topic` with a covered post, OR its top-10 SERP overlaps heavily (~30%+) with a covered post's SERP. Intent-aware: same parent_topic + **same** intent → reject; **different** intent → allow as a spoke.
   - **Fallback (no provider):** dedup on title/keyword overlap + intent + semantic similarity.
   - Set the decision: **net-new** (uncovered) · **refresh** (covered same-intent → don't self-compete; recommend updating the existing URL and pick the best *uncovered* keyword instead) · **spoke** (covered different-intent → write it, internally link to the existing page).
   - **If every strong candidate is already covered same-intent:** do NOT draft a near-duplicate — output a refresh recommendation (the existing URL + what to update) and stop.
   Finally, derive the word target by matching/modestly exceeding competitor depth (clamp 1500–3500), and set a meta title (50–60 chars, primary keyword near the front).

## Phase 3 — Angle (judge-panel)

Spawn 4 subagents in parallel, each locked to ONE lens — contrarian (what everyone gets wrong), spec/data-led, buyer-decision, user/maker-pain — each returning a single-sentence angle. Then **you** (strongest model) judge: pick the most ownable, expertise-revealing angle that still reads as a clickable subject line. The angle is the reason this article deserves to exist; don't skip it.

## Phase 4 — Outline + ENFORCED critic loop-back

Write an AEO-structured outline (strongest model): working title, slug (max 4–5 words), meta description, an explicit opening hook, 4–7 H2s each with a reason to exist, 5 FAQs from real "people also ask" questions; weave in the secondaries.

Then spawn a **critic subagent**: adversarially stress-test the outline against the live SERP — generic/saturated sections, missing sub-questions, weak hook, premature single-brand promo, missing high-PAA FAQs, slug too long. It returns `pass` or `revise` + specific issues. **If `revise`: regenerate the outline fixing every issue, then re-critique. Repeat until it passes (cap ~3 rounds). Never proceed to Draft on an outline whose final verdict is `revise`** — if it still fails after the cap, surface the unresolved issues and stop rather than drafting a weak post. A critic whose verdict you ignore is wasted work.

## Phase 5 — Draft (the prose)

Strongest model. Write ~the derived word target, do NOT pad. Apply the brand voice rules below.

- **Research + cite your own sources** (web search/fetch). Wrap every factual/statistical claim in an inline `<a href>` with **descriptive anchor text** (never a bare URL). For financial/legal/health claims, cite ONLY high-authority sources (.gov / official bodies). Verify each URL loads before citing. **Do not state a factual claim you can't cite** — cut it or soften it.
- **Images — exactly 3** (one near the top, two in the body), each carrying a complete, ready-to-paste **AI image-generation prompt** (subject + composition + style + lighting + mood; "no text, no watermark"; aspect ratio). If an image-gen tool is connected, generate from the prompt and use the real `src`. Otherwise emit a **visible placeholder** (a dashed `<figure>`/`<div>` showing "IMAGE PLACEHOLDER", the alt, the title, and the prompt) — **never an empty `<img src="">`**. Put the prompt in a `data-image-prompt` attribute on every `<figure>` (HTML-escape it). Every image needs non-empty `alt` AND `title`.
- **Internal links:** where genuinely relevant, link to the brand's existing pages from the Phase 1 history (hub-and-spoke).
- Semantic HTML: one `<h1>`, the FAQ section, JSON-LD `Article` + `FAQPage` blocks at the end.

## Phase 6 — Validate (gates — fix before shipping)

- **Citation gate (W2):** spawn one subagent per cited source, in parallel — confirm it loads (200), is authoritative for that claim (per claim type), and *actually supports the specific claim*, with correct anchor text. Also scan the prose for **uncited** factual/statistical claims. Any failed or missing citation is **blocking**: remove the source and rewrite the sentence, or replace it. Do not ship a failed/unsupported claim.
- **Brand-voice gate:** scan the draft for any `voice_hard_rules.banned_words`, em dashes, and emojis in headings. Every hit is blocking — fix before shipping.
- **Content Brief header (assemble yourself, prepend to the article):** a visible block with article title, meta title (+ char count), meta description (+ char count), URL slug, primary + secondary keywords **with volume**, the **SERP owner / winnability** note, the derived word target, the **history check** (net-new / refresh → URL / spoke), and the keyword-data source (provider-verified vs web-estimate).
- **Structural checks:** word count vs target (COMPUTE it — never trust your own estimate); slug ≤ 5 words; exactly one `<h1>`; JSON-LD parses; exactly 3 images, each visible with non-empty `alt` + `title` + a `data-image-prompt`, zero empty `src`; every claim linked.

## Phase 7 — Output

- Save the article as CMS-ready `.html` (and `.docx` if the user wants it). **Never auto-publish.**
- If `state_dir` was given, **append** this draft to `rankenstein_history.csv` (`date, primary_keyword, title, url_slug, intent, status=drafted`) — append-only; never rewrite third-party trackers. (Worst case on interruption is a missing row, not corruption.)
- Notify via the brand's configured channel if one exists (e.g. Telegram): topic + keyword + headline + word count, history decision, citations cited, and the file link.
- Report the brand-voice and citation gate results and any structural flags honestly. Do not ship silently.

---

## Brand voice (strict)

No em dashes. No emojis in headings. Honor every hard rule in the brand's `BRAND.md` (`voice_hard_rules`: banned words, framing, terminology). Treat the brand as ONE honest entry among its peers — never a hard sell, never more glowing than competitors; let specificity do the persuading.

## Failure modes

- No keyword/SERP provider (or it errors/empties) → web search + estimate, flagged `web-estimate`; dedup falls back to title/keyword/intent + semantic similarity.
- No `state_dir` → skip history; everything is net-new.
- Every strong candidate already covered same-intent → recommend a **refresh**; do NOT draft a near-duplicate.
- A subagent fails → retry once, else proceed with degraded data and note it in the brief.

## Bundled files

- `BRAND.template.md` — brand-config template (frontmatter + prose).
- `bootstrap-interview.md` — first-run flow to build a `BRAND.md` from a URL.
