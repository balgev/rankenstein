# 🧟 Rankenstein v2.0

A **research-first, brand-agnostic blog-drafting engine** that runs as a Claude Code workflow.

Give it a brand and a topic. It does real keyword research (including **who owns the SERP** and whether you can realistically win it), debates the angle from four perspectives, runs an **adversarial editor on its own outline until it passes**, writes the piece, fact-checks and links every citation, and hands you CMS-ready HTML with a content brief and ready-to-generate image prompts.

No hardcoded SEO vendor. No hardcoded brand. Got Ahrefs? It uses Ahrefs. SEMrush, BrightLocal, anything that returns keyword data — it discovers it by capability and uses it. Nothing connected, or a provider errors out? It falls back to web research and flags the data as estimated.

---

## Why it's different from "write me a blog post"

Most AI blog tools fail at the same place: the jump from research to writing. They produce structurally-correct, editorially-empty content. Rankenstein forces the qualities that actually rank and get read:

- **Research-first keyword choice** — not "highest volume," but the best *winnable* keyword given **who owns that SERP** and how much authority your brand has (the authority gap). A KD-30 term is a layup for a DR-80 brand and a wall for a DR-20 shop; the engine scores it relative to *you*.
- **An adversarial editor that's actually enforced** — a critic agent stress-tests the outline against the live SERP, and the pipeline **loops back and fixes it** before a single paragraph is written. A critic you ignore is just wasted tokens.
- **Every claim sourced and linked** — a citation gate checks that each source is authoritative, resolves (200 OK), and actually supports the *specific* claim, with correct descriptive anchor text. Named-but-unlinked = fail.
- **Brand voice as hard rules** — banned words, tone, framing — enforced, not suggested.
- **Provider-agnostic + graceful** — discovers any connected SEO MCP by *capability*, and falls back to web search if none is connected **or** a provider errors / returns nothing / hits quota.

## How it works

```
Keyword Research  →  Angle   →  Outline   →  Draft    →  Validate
 discover            4 lenses    write +      Opus        citations +
 SERP ownership      → Opus      adversarial  prose,      content brief +
 multi-factor          judge     critic,      cites its   visible image
 choice + derived                LOOP-BACK    own         placeholders +
 length                          until pass   sources     scorecard
```

| Phase | What it does |
|-------|--------------|
| **Keyword Research** | discover candidates (volume/KD/intent, PLP junk excluded) → **SERP ownership** (who dominates + their authority + content depth) → **multi-factor choice** weighing volume × difficulty × intent × AEO × **winnability**, then **derives the word target** from competitor depth |
| **Angle** | four diverse-lens angles (contrarian / spec-led / buyer-decision / user-pain) → an Opus judge picks the ownable, clickable one |
| **Outline** | Opus outline → adversarial Sonnet critic → **enforced loop-back** (regenerates against the critique, up to 2 passes) |
| **Draft** | Opus prose, researches and cites its own sources with anchored links, 3 contextual images |
| **Validate** | citation gate (authority + resolves + supports + anchored) → assembles a visible Content Brief header → output validators |

## What you get

A single CMS-ready HTML file containing:

- a **visible Content Brief header** — article title, meta title (+ char count), meta description (+ char count), URL slug, primary + secondary keywords **with search volume**, the **SERP owner / winnability note**, and the derived word target
- the article — semantic HTML, AEO-structured, one `<h1>`, FAQ section, JSON-LD `Article` + `FAQPage` schema
- **3 image placeholders** as visible boxes, each carrying alt text, title, and a **ready-to-paste AI image-generation prompt** (plus a `data-image-prompt` attribute so a downstream agent can batch-generate them)
- inline, validated citation links
- a machine-readable result object: keyword research, SERP ownership, citation audit, and a validator scorecard

## Requirements

- **Claude Code** with the Workflow orchestration capability (this engine is a `.workflow.js` script run via the Workflow tool).
- **Opus + Sonnet** access — the pipeline tiers models deliberately (Opus for angle/outline/prose; Sonnet for research/critique/validation).
- *Optional but recommended:* a connected SEO MCP (Ahrefs, SEMrush, BrightLocal, …) for verified keyword + SERP data. Without one it degrades to web-estimated data, clearly flagged.

## Install

Two ways, depending on which app you use:

### Claude Cowork (desktop app) — upload the skill file

Cowork has no command line. Install it through **Customize → Skills → Upload skill**:

1. **Download [`rankenstein.skill`](https://github.com/balgev/rankenstein/releases/latest)** (or `rankenstein.zip`) from the latest Release.
2. In Cowork open **Customize → Skills → Upload skill** and drop the file in.
3. Ask Claude to draft a blog post for a brand to trigger it.

> The **Skills** uploader takes a `.skill` / `.zip` (with `SKILL.md` inside) — *not* a `.plugin`. (A `.plugin` file is also attached to the Release for the separate **Personal plugins** section, if you prefer that route.)

### Claude Code — use the command path

The repo is its own plugin marketplace, so it's two lines in the Claude Code terminal:

```
/plugin marketplace add balgev/rankenstein
/plugin install rankenstein@rankenstein
```

(Or by hand: copy `skills/rankenstein/` into `~/.claude/skills/rankenstein/`.)

## Usage

Once installed, just ask Claude to draft a post:

> "Draft a blog post for my brand (example.com) about &lt;topic&gt;."

The skill gathers your brand context (or runs the first-run bootstrap from your URL), then runs the engine and saves a CMS-ready `.html`. See [`skills/rankenstein/SKILL.md`](skills/rankenstein/SKILL.md).

### Run the engine directly

The engine is `skills/rankenstein/rankenstein-v2-drafting.workflow.js`, run via the Workflow tool with your brand + topic:

```js
{
  brand: { name, url, facts, audience, voice },
  topic: { topic, seed_keyword, intent },   // a seed keyword is enough — the engine chooses the final primary
  target_words: null                          // null = derive from SERP competitor depth
}
```

Or fill the `INPUT` block at the top of the script. It **fails loud** if no real brand/topic is provided — there are no silent sample-brand defaults.

### Brand config

Define your brand once in a `BRAND.md` (see [`BRAND.template.md`](skills/rankenstein/BRAND.template.md)) — frontmatter for the machine-read fields (facets, competitors, voice hard-rules) plus prose for audience and voice. Or let the **first-run bootstrap interview** build one from your URL (see [`bootstrap-interview.md`](skills/rankenstein/bootstrap-interview.md)).

## History-aware (no tracker required)

Point it at a `state_dir` (your brand's project folder) and the **History phase** kicks in: it reads any existing trackers (CSV/XLSX, any schema) and/or self-discovers your published footprint from your sitemap, then **dedups against it** — turning each candidate into a `net-new`, `refresh` (you already own it → update instead), or `spoke` (write it + internally link to your existing page) decision. It logs each draft to its own `rankenstein_history.csv` and never rewrites your trackers. No `state_dir` (a casual one-off)? It skips all of that. Zero setup for the common case.

## What it does NOT do

- **Topic discovery & cross-brand orchestration.** It researches and chooses the *keyword* for a given topic, but a **routine** still adds value if you want it to pick topics from scratch, dedup against *unpublished/in-flight* drafts held outside the engine, or run across many brands on a schedule.
- **Publish.** It drafts. Publishing is yours.

## Cost

A full run is ~17–19 model agents (~500–700k tokens) — the research and validation are real fan-outs, not single prompts. Depth over speed, on purpose.

## Design & build log

The full architecture, every design decision, and the findings from an independent Codex review plus multiple live validation runs are in **[DESIGN.md](DESIGN.md)**. It reads as the engineering log of how this was built and de-risked.

## License

[MIT](LICENSE).
