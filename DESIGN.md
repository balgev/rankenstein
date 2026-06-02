# Rankenstein v2.0 — Design Doc

**Status:** Brainstorm captured, nothing built yet
**Last updated:** 2026-06-01
**Owner:** Gev

> This is the **build/design workspace** for Rankenstein v2.0 — a **brand-agnostic,
> reusable** skill+workflow for any tenant (e.g. a kids-apparel brand, a construction
> company, a SaaS). The engine carries **no tenant-specific content**. Each tenant's
> filled-in `BRAND.md` lives in that tenant's own project (e.g.
> `<that-brand>/BRAND.md`), never in the engine.

---

## 1. What v2.0 is

An upgrade of the existing `rankenstein-blog` skill that:

1. **Absorbs topic discovery** (Option A). v2.0 takes a brand + themes, *discovers*
   the topic (rotation + multi-source research + cannibalization firewall), then
   drafts it. Discovery and drafting in one engine.
2. **Is workflow-orchestrated** for headless runs — parallel fan-out, model
   tiering, and agent-gates replacing the human checkpoints.
3. **Stays reusable** — generic engine, brand specifics read from project config.
4. **Fixes cannibalization** at the keyword-cluster level (the real bug), not via
   bucket reshuffling.

The current public Rankenstein (drafting pipeline you hand a topic to) is what the
LinkedIn community adopted. v2.0 must **not lose** that interactive experience.

---

## 2. The three-layer architecture

The whole game is drawing the line between generic engine and per-tenant data.

| Layer | Holds | Generic? | Examples |
|-------|-------|----------|----------|
| **1. Rankenstein v2.0 (engine)** | pipeline, workflow orchestration, model tiering, cannibalization-firewall *mechanism*, agent-gate logic | YES — shared, versioned | "fan out citation validation", "reject if parent_topic collides", "Opus for angle" |
| **2. Brand config (per project)** | the *inputs* the engine consumes (data, not logic) | NO — per tenant | facets/themes, competitors, voice rules, internal sources, tracker paths, notify channel |
| **3. Scheduled trigger (per instance)** | thin trigger: cadence + which project | NO — per tenant | "Mondays 9PM, run v2.0 on the &lt;brand&gt; project" |

**Discipline:** the engine hardcodes nothing brand-specific. Today's scheduled-task
prompt hardcodes the 6 pillars, competitors (`mightlyworld.com`, `wearpact.com`,
`coloredorganics.com`), Reddit subs, the SJ report, `GTM_Runs/` path, Telegram chat.
**All of that moves to Layer 2.**

Voice rules split:
- **Generic anti-AI-tells → engine:** no em dashes, no "let's dive in", no "in
  today's fast-paced world".
- **Brand voice → Layer 2:** tone (e.g. "warm, local, plain-spoken"), banned words, a
  certification number to cite, how to refer to a manufacturing partner, etc.

**Payoff:** ship v2.0 once, every tenant inherits the upgrade. No hand-patching N tasks.

### 2.5 Layer 2 detail — Brand Config (format & lifecycle)

**Decision:** declared config = `BRAND.md` (YAML frontmatter for machine-read fields +
markdown prose for voice/audience nuance). Accumulated state stays in the trackers /
state layer (engine-owned, append-only). **Never mix declared config with accumulated state.**

- **Frontmatter (workflow reads deterministically):** brand, url, facets, competitors,
  voice_hard_rules (banned_words, em_dashes, emojis_in_headings), state_dir, notify.
  (No `commercial_links` / bundles — not a Rankenstein concern.)
- **Prose (LLM reads for nuance):** Audience (specific), Voice, Brand facts to weave in,
  Source material.
- **Keep OUT of config:** tool stack / capability ("I have Ahrefs") — auto-detected at
  runtime (§5.4), never declared (goes stale on token expiry).

**Acquisition = first-run bootstrap interview** (see `bootstrap-interview.md`): fires
when the skill runs with no `BRAND.md`. Default path auto-drafts from the user's URL;
falls back to a short interview / ingesting existing docs. Output is a human-confirmed
`BRAND.md`. Config is generated *with* the user, not demanded from them. A headless
first-run with no config **STOPS + notifies** (never auto-guesses a brand).

**Keep-in-loop:** (1) human — ask-when-unsure via `notify` ("add this facet? Y/N"),
drift re-confirm on site change; (2) currency — the state layer accumulates every
published cluster automatically, so brand memory is current by construction.

**Artifacts in this folder (generic engine):** `BRAND.template.md` (documented blank),
`bootstrap-interview.md` (the first-run flow spec). A tenant's populated `BRAND.md`
(= bootstrap output for that brand) lives in **that tenant's own project**, not here —
it's tenant data, not engine.

---

## 3. Dual-mode delivery (do NOT go pure-workflow)

A skill and a workflow are different artifacts:
- **Skill** = `SKILL.md` prose instructions, runs in main loop, supports human checkpoints.
- **Workflow** = JS orchestration script, deterministic fan-out of subagents, headless.

A pure workflow throws away the interactive human checkpoints the community loves.
So:

- **Interactive mode → the skill.** Phased, with human steering ("present the angle,
  present the outline"). Community keeps what they adopted.
- **Headless mode (routine / Cowork schedule) → the workflow.** Human gates become
  **critic agents** (separate fresh-context reviewers, prompted to find the problem,
  not rubber-stamp).

The skill detects context and **dispatches to the workflow** when running unattended.
One methodology, two vehicles.

### The "present to the user" → "present to a critic agent" reframe
In a scheduled run, the skill's human checkpoints are currently **silent no-ops**
(no human at 9PM, so it just proceeds — losing all four quality gates). v2.0 converts
each gate into a **separate adversarial subagent**:

| Phase gate | Interactive | Scheduled today | v2.0 headless |
|-----------|-------------|-----------------|---------------|
| keyword map | present to user | silently skipped | critic vets primary-kw + dedup |
| format | present to user | silently skipped | critic challenges format choice |
| angle | present to user | silently skipped | **judge panel** (diverse lenses → pick) |
| outline | present to user | silently skipped | critic stress-tests section logic |

> Key rule: a critic must be a **separate** agent, not the author reviewing itself
> (same context rubber-stamps).

---

## 4. The 7 phases × workflow shape × model tier

"Workflow" = the script is the top-level conductor. Most steps are single `agent()`
calls in sequence; fan-out only where it pays; deterministic bits are plain JS.

| Phase | Shape | Tier | Notes |
|-------|-------|------|-------|
| 0 — deterministic transforms (scoring, threshold filters, sort/top-N, string-dedup) | **plain JS, no agent** | — | the floor is *no model* |
| 1 — Keyword discovery (Ahrefs pulls) | single agents, parallelizable across call types | **Haiku** | mechanical fetch + light filter |
| 2A — SERP overview (Ahrefs) | single agent | Haiku/Sonnet | |
| 2B — Competitor deep-read (top 3 articles) | **fan-out (parallel)** | **Sonnet** | comprehension + extract brief |
| 3 — Intent/format decision | barrier → single decision | Sonnet | needs all of P2 |
| 4 — **Angle** | **judge panel** (N diverse lenses → adversarial pick) | **Opus** | highest-taste; fails *silently*; keep a lightweight async human glance (Telegram FYI) |
| 5 — Outline | single isolated agent (+ critic agent) | **Opus** | not fan-out, but isolation + model tier still help |
| 6 — Draft prose | single coherent author | **Opus** | never split |
| 6 — Citation validation (per source: authority/URL/relevance) | **fan-out (parallel)** | URL+domain = **Haiku**, relevance read = **Sonnet** | the cleanest, lowest-risk, highest-value first workflow |
| 7 — CMS HTML output | single act | Sonnet | mechanical-ish; JSON-LD correctness matters |

### Model tiering ladder (match tier to judgment-density)
| Tier | Use for |
|------|---------|
| **No model (JS)** | deterministic transforms |
| **Haiku 4.5** | language, no judgment, cheap if wrong (tool pulls, URL+domain checks, tagging) |
| **Sonnet 4.6** | comprehension + moderate judgment (briefs, vernacular, semantic dedup, citation relevance, critic gates) |
| **Opus 4.8** | taste + high-stakes generation (angle, outline, prose, angle judge-panel) |

> Haiku's risk = **silent low quality**. Use only where a mistake is bounded/verifiable.
> Never on semantic dedup, critics, or anything generative.

---

## 4.5 Output layer — the four emissions per run

A run emits FOUR distinct things; don't conflate them.

| # | Emission | Format | Notes |
|---|----------|--------|-------|
| 1 | **Draft article** | **`.html` + `.docx` (both, always)** | HTML = CMS-ready semantic + JSON-LD schema; DOCX = readable/shareable review copy |
| 2 | **Run brief** | `.md`/`.docx` (human) + `.json` (machine) | provenance + transparency: chosen topic/facet, **firewall tier + dedup confidence**, rejected candidates + why, source mix, angle + judge verdict, citation audit table |
| 3 | **State writes** | append to production tracker + claimed-cluster store | append-only, backup/verify; makes next run smarter |
| 4 | **Notification** | `notify` channel | digest + the **angle FYI kill-switch** (async human review) |

**Locked decisions:**
- **No publishing. Ever.** The skill drafts only. Publishing is the user's own job on
  their end, outside the skill — no CMS push, no API, no auto-publish path. Removes
  brand/legal risk and keeps the skill generic.
- **Article in both HTML and DOCX**, every run.
- **Slugs: max 4-5 words.** The url_slug is a SHORT alias, not the headline. Long title →
  still a tight 4-5 word slug. E.g. *"How to Spot Greenwashing in Kids Clothing: A 2026
  Parent's Field Test"* → `spot-greenwashing-kids-clothing`.
- **No bundles / commercial-link config** — removed from the generic skill. (Engine may
  still *suggest* internal links as HTML comments, but there is no `commercial_links` field.)

### Images — capability-tiered (generate if possible, else placeholder)
Rankenstein Phase 7 already writes an IMAGE BRIEF + suggested filename + alt for each of
the 3 placements (1 cover + 2 in-text). v2.0 reuses those briefs as generation prompts:

| Tier | If available | Output |
|------|-------------|--------|
| 1 | an image-gen tool is connected (e.g. **Nano Banana Pro** / any image model) | generate the 3 images from the briefs, embed real `src` |
| 2 | no image-gen | **VISIBLE placeholder box** (rendered) — NOT an empty `<img>` |

Config: `images: auto` (detect → generate, else placeholder). **Every image — generated OR
placeholder — carries both `alt` and `title`** (accessibility + SEO).

> **Corrected from a read of the EZ workflow draft (2026-06-01):** empty-`src` `<img>` tags
> render as **nothing/broken-image** in a browser, so a human reviewer sees no images and
> assumes the engine skipped them (exactly Codex #9). Tier-2 placeholders MUST be a
> **visible** rendered block — a dashed `<figure>`/`<div>` showing "IMAGE PLACEHOLDER" + the
> alt + the title + the art brief, all on-screen. Never emit empty `<img src="">`. The
> validator counts visible placeholders + generated images and **fails** if any empty-`src`
> remains.

### Content Brief header (visible, prepended to the article)

Every draft is prepended with a **visible** `<header class="content-brief">` block (assembled
deterministically in JS, not by the prose agent) so the reviewer sees the SEO essentials
before the article:
- **Article title** (working title / H1)
- **Meta title** (SEO title tag, 50-60 chars) + live char count
- **Meta description** + live char count
- **URL slug**
- **Primary keyword** + secondary keywords, each **with search volume** (and KD when available)
- **Keyword data source** flag (provider-verified vs web-estimated)

This is fed by a **proper Keyword Research phase baked into the engine** (Gev's call,
2026-06-01 — keyword *choice* belongs in Rankenstein, not the routine). Three stages:
1. **Discover** — matching/related/question terms with volume/KD/intent via the §5.6
   capability layer (any provider, else web estimate, flagged); PLP/branded junk hard-excluded.
2. **SERP ownership** — for the top candidates, who OWNS the SERP (dominant domains + their
   authority) and how deep their content runs.
3. **Multi-factor choice** — pick primary + secondaries on volume × KD × intent × AEO ×
   **winnability** (§5.5 authority gap: can a brand of *this* authority outrank the SERP
   owner?), and **derive the length target** from competitor depth (clamp 1500-3500).

The Content Brief header surfaces the chosen keywords + volume, the **SERP owner /
winnability note**, and the derived word target. (Dedup-vs-history stays the routine's job;
keyword *research and choice* is the engine's.)

---

## 5. Cannibalization redesign (the real root-cause fix)

**Diagnosis:** fixed narrow pillars + forced 6-week return = keyword depletion within
each pillar → later posts cannibalize earlier ones. Rotation *schedules*
cannibalization, it doesn't prevent it. Evidence: 4 Material/Health posts in one
cluster; Week 3 skipped (`made in usa kids clothing` vs `kids clothes made in usa`).

**The proposed "rotate industries instead of topics" idea:** directionally right
(bigger buckets deplete slower) but incomplete — it adds no firewall and makes
collisions harder to see. Also: streetwear/kids/LA/USA/patches/sustainability are
**facets of one product** (every post is several at once), so they're **tags, not
rotation lanes**.

**The fix — three stacked changes:**

1. **Cluster-level dedup firewall (data, not vibes), with explicit precedence.**
   Reject a candidate when EITHER:
   - its top-10 `serp-overview` URLs overlap > threshold with an existing post's SERP
     — **intent is irrelevant** here; if Google already conflates the queries they
     cannibalize; OR
   - its Ahrefs `parent_topic` matches an existing post **AND the search intent is the
     same** (same `parent_topic` + *different* intent is allowed — that's a spoke, see #2).

   Catches the *silent* collisions string-matching misses. **This is the missing piece.**
   **Scope:** dedup runs against ALL claimed clusters — `published` AND `drafted` (a draft
   claims its cluster so two drafts can't collide); unpublished claims **expire after
   ~12 weeks** so abandoned drafts don't lock topics forever. SERP snapshots are stored
   dated, and your own brand domain is excluded from the overlap math.
   (See resolutions #1, #4, #5.)
2. **Hub-and-spoke: "own the cluster" not "avoid the topic".** Classify an **intent**
   dimension (informational / commercial / DIY / comparison) for BOTH the candidate and
   the existing posts. Same topic / `parent_topic` is allowed when intent differs —
   builds topical authority instead of scattering it. (Precedence in #1 governs the boundary.)
3. **Adaptive coverage, not periodic rotation.** Keep the 6 facets as a **coverage
   balancer**: each week bias discovery toward the *thinnest-covered* facet in the
   published library. Self-correcting (currently health-heavy: 4 of 11).

Keep the Ahrefs discovery *freedom* (find hidden gems) — just gate output through the
firewall. The SERP-overlap firewall is itself a **parallel-verify workflow**: per
candidate, fan out → pull SERP → compare vs library → `{candidate, overlap%, verdict}`
→ barrier → keep clean ones. Makes the Week-3 class of bug structurally impossible.

### 5.4 Graceful degradation — the tiered firewall (most users have NO Ahrefs)

Capability-detection + fallback is already in the current skill ("if Ahrefs fails,
switch to web search silently, do not retry") and is the **right** architecture for a
reusable multi-tenant skill — not a problem, a requirement. Robustness rule: treat ALL
Ahrefs failure modes the same (not connected / no token / quota / timeout / empty =
"unavailable → fall back, move on"). **One try, no retry loops** (bad in a headless run).

**The trap to avoid:** the fallback must cover the *firewall*, not just discovery.
Otherwise "no Ahrefs" silently means "no cannibalization firewall" — for exactly the
users who most need v2.0's headline feature. Most firewall signal IS recoverable:

| Tier | Available | Clustering (parent_topic) | SERP overlap | Strength |
|------|-----------|---------------------------|--------------|----------|
| 1 | Ahrefs | `parent_topic` exact | `serp-overview` top-10 | precise |
| 2 | GSC (free, more users have it) | — | GSC directly shows own pages cannibalizing a query | strong for **dedup-vs-history** |
| 3 | Web search only | LLM semantic clustering (proxy) | **live-search candidate + existing kws, compare top URLs** | directional but real teeth |
| 4 | Nothing | string/semantic title overlap (today) | — | weakest |

Key realizations:
- **SERP overlap survives without Ahrefs** — "do these two queries return the same
  pages?" is answerable by running the searches and comparing URLs. Lose DR/traffic,
  keep the collision signal (the part that matters).
- **GSC is a free, underrated firewall** for dedup-vs-history (shows your own pages
  competing for one query). More users have GSC than Ahrefs.
- `parent_topic` is the only truly proprietary piece; degrades to semantic clustering.
- So the firewall **never fully turns off** — it just loses precision as tools drop.

**Transparency:** each run reports its tier + firewall confidence, e.g. *"Degraded
mode: no Ahrefs. SERP-overlap via web search, clustering via semantic match. Dedup
confidence: medium."* Keeps it honest across tenants with different tool stacks.

In the workflow this is a cheap deterministic preflight: probe Ahrefs/GSC once, set a
capability flag, branch which source + firewall agents get spawned.

### 5.5 Candidate-pool hygiene & competitive calibration (dry-run findings, 2026-06-01)

Two rules surfaced from the first real dry run:

**A. Hard-exclude PLP/SKU keywords from the BLOG candidate pool.** Keyword tools flood the
pool with category-page (PLP) terms — color/variant modifiers ("green &lt;product&gt;"),
sizes, "for sale / buy / price / cheap", local ("near me", city names), and
competitor-branded queries ("&lt;competitor&gt; &lt;product&gt;"). These are product/collection-page targets,
**not blog topics**. The §1C rubric's soft "commercial fit" demotion is not enough —
**hard-exclude** these patterns from the blog pool before scoring. They can feed PLP/SEO
work elsewhere, never blog discovery.

> **POC correction (discovery fan-out, 2026-06-01):** the filter MUST live in the
> deterministic JS layer, and **source agents must return RAW candidates** (do not tell
> them to pre-filter). In the POC the agents self-filtered, so the JS hard-exclude caught
> 0 — meaning the "guarantee" was really soft, non-deterministic agent judgment. Put the
> hard gate in code; let agents over-return.

**A2. Intent-aware routing — blog vs the brand's OWN category page (new cannibalization
flavor).** The POC's winner was a head category term (commercial/category intent).
For a *seller*, that term belongs to a **product/collection page**, and a blog pillar on it
can cannibalize the brand's OWN PLP. The §5 firewall only checks blog-vs-blog, so it is
blind to this. Discovery must route by intent: head commercial/PLP terms go to "PLP
recommendation," OR the blog is forced to target the *informational* angle and **internally
link to** (not compete with) the category page. Also: **tag agent-estimated metrics as
low-confidence** — a web-trend agent guessed "9,500 vol" with no Ahrefs backing; never
score estimates equal to verified data.

**B. Competitive calibration is RELATIVE to the tenant's own authority — NOT "always go
long-tail".** A category often has a dominant DR-heavy educator (one big site that owns
the niche's content). The firewall only dedups your OWN history, so it gives zero protection against
walking into a giant's turf. But the fix is **not** a blanket "bias to long-tail" — that
wrongly assumes the tenant is the underdog. A high-authority enterprise tenant can and
should win short-tail too. Calibrate by the **gap between tenant authority and the SERP**:
- **Winnability = f(KD, tenant_DR, SERP DR spread)**, not absolute KD. A KD-30 term is
  brutal for a DR-20 shop and a layup for a DR-80 brand — same keyword, different score by
  who's asking. This makes the §1C "KD inverse" term **relative**, not fixed.
- Strong tenants pursue short-tail they can win; only weaker tenants get steered to
  long-tail/niche. Ambition is matched to the brand, per run.
- Degrades across tiers: **T1 Ahrefs** = tenant `site-explorer-domain-rating` + per-result
  `domain_rating` from `serp-overview`; **T2 GSC** = does the tenant already rank for
  adjacent terms (proven authority)?; **T3 web-only** = bootstrap heuristic/question
  ("established high-traffic brand vs newer/niche?"), low confidence.

The dominant competitor is just one input; the deciding factor is the authority gap.

### 5.6 Capability-first data layer — discover ANY provider by capability, fall back to web

**Hardcode NOTHING — not Ahrefs, not BrightLocal, not any brand name.** The engine defines
the **capabilities it needs**, then discovers whatever connected MCP provides each one. The
session might return Ahrefs, or BrightLocal, or SEMrush, or a tool nobody has heard of yet,
or several, or none. Brand names below are **examples only**, never the registry.

**1. Capabilities the engine needs (define the JOB, not the vendor):**

| Capability needed | What a tool must provide | Example tools (illustrative only) |
|-------------------|--------------------------|-----------------------------------|
| National/intl keyword metrics | volume, difficulty, intent for a keyword | Ahrefs, SEMrush, Moz, Serpstat, … |
| SERP overview | ranking URLs + per-result authority for a query | Ahrefs, SEMrush, … |
| Local rank / pack | local-pack / GBP rankings for a place | BrightLocal, local-rank tools, … |
| Own-site performance | the tenant's own queries/positions | GSC, … |
| Backlinks / authority | DR / referring domains | Ahrefs, Moz, … |

**2. Discover by capability, not by brand (preflight).** Enumerate connected tools
(`ToolSearch` / deferred-tool registry) and decide, **from each tool's own description/
schema, whether it satisfies a needed capability** — does it return keyword volume? local
rankings? Match on what the tool *does*, not its name. This is what filters out false
positives (e.g. Intercom/Spotify match the word "search" but provide none of the
capabilities) without maintaining a brand allowlist, and it future-proofs against new
providers. Probe live every run; never declare the tool stack in config (it goes stale).

**3. Route each job to whatever satisfies it — use several at once.** Local-intent keywords
→ whatever provides local rank; national volume/KD/SERP → whatever provides national
metrics; own-site cannibalization → whatever provides own-site performance. If two tools
satisfy one capability → preference order or cross-validate. A tenant with both a national
and a local provider uses each for its strength in the same run.

**4. Fallback.** If NO connected tool satisfies a capability → the engine's own **web
search** (degraded tier). The run brief reports which provider served which job + confidence.

This **generalizes** the §5.4 firewall tiers and the §5.5 winnability/DR signal: "Ahrefs →
GSC → web" was just one possible instantiation. Nothing is keyed to a vendor — only to
capabilities — so a brand-new SEO MCP works the moment it advertises the capability. The POC
proved the mechanic: a subagent can `ToolSearch` and call whatever provider is connected,
live (2026-06-01).

### 5.7 History phase — state-aware dedup + internal-linking, baked into the engine

Originally punted to the wrapping routine ("read history → dedup → call engine → write
back"). Smarter: the engine **self-handles it when handed a place to look**, and **skips**
it for casual one-offs.

**Trigger = `state_dir`, NOT "am I scheduled?".** A workflow can't reliably sense its trigger
context (cron vs casual), but it CAN check whether it was given a folder to persist. So
history activates on the presence of a `state_dir` (a `BRAND.md`/input field) — which a
scheduled task/routine naturally provides and a one-off doesn't.

**3 tiers (best signal first):**
| Given | Behavior |
|-------|----------|
| `state_dir` with a tracker (csv/xlsx, ANY schema) | read best-effort (title/keyword/url/intent) as the covered corpus — most precise; includes in-flight/drafted rows |
| `state_dir`, no tracker | create the engine's own `rankenstein_history.csv`; optionally seed from the brand's sitemap / blog index (its published footprint) |
| no `state_dir` | skip — casual one-off, no dedup |

**Dedup becomes a 3-way decision, not a binary reject** — the keyword-choice agent sets
`dedup_decision`:
- **net-new** — uncovered → write it.
- **refresh** — already covered, same intent → don't self-compete; surface the existing URL to update, and pick the best UNCOVERED winnable keyword instead.
- **spoke** — covered, different intent → write it AND internally link to the existing hub page.

Existing pages with URLs become **internal-link targets** for the draft agent (hub-and-spoke).

**Safety:** read ANY tracker for dedup context, but only ever WRITE to the engine's own
`rankenstein_history.csv` (append; never rewrite third-party trackers — honours the
backup/verify discipline). Write-back logs the drafted post: date, primary_keyword, title,
url_slug, intent, status=drafted.

**What still belongs to a routine:** dedup against unpublished drafts maintained *outside*
the engine, or cross-brand orchestration. But the common case — "don't repeat what you've
published" — now works with **zero external setup**.

---

## 6. Caveats / constraints (read before building)

1. **🟡 Headless MCP auth — downgraded from blocker by graceful degradation (§5.4).**
   v2.0 leans on Ahrefs/GSC/Brand Radar. Interactively-authed MCP servers **may be
   absent in headless/cron runs**. But with the tiered firewall, a missing Ahrefs no
   longer kills the run — it just *degrades* it (web-search SERP overlap, semantic
   clustering). So the question shifts from **"does it survive?"** to **"which firewall
   tier did this run get?"** Still worth validating, to know what tier your *scheduled*
   runs actually land on — but it's no longer make-or-break for viability.
   **Partial de-risk (POC, 2026-06-01):** a workflow *subagent* successfully loaded and
   called the Ahrefs MCP tool (`degraded_sources: []`, real verified data returned). So
   MCP-in-subagent works from an **interactive** session.
   **Headless probe resolved (2026-06-01) — largely good news:**
   - A raw `claude -p` CLI subprocess is **NOT** a valid headless vehicle here: it failed
     with `401 Invalid authentication credentials`. The Cowork app manages Anthropic auth
     AND the MCP connections; a shell-spawned CLI inherits neither. So do not model the
     scheduled path as a CLI cron.
   - The real headless context is the **Cowork desktop scheduler** (where the live "Blog
     post drafting v2" routine runs Mondays 9 PM). **Empirical proof it has MCP access:**
     that routine has used Ahrefs/GSC successfully for weeks (see Rotation_Log Weeks 1-6 —
     the skips were budget/data choices, not auth failures). So the original 🔴 "does MCP
     survive headless?" is effectively **answered: yes, on the Cowork-scheduled path.**
   - **Deployment requirement:** providers must be connected where the *scheduler* reads
     MCPs — i.e. via the **Cowork app**, not just CLI/user-scope config. (BrightLocal was
     connected via the app, so it should appear in scheduled runs; CLI-only `claude mcp
     add` would NOT reach the Cowork scheduler.)
   - Residual check (optional): confirm a newly-added provider (BrightLocal) actually
     appears in a real scheduled run — but the risk is now low.
2. **Nesting is one level deep.** `workflow()` inside a child throws. Absorbing
   discovery (Option A) fits this well: one script, fan-out within phases, sub-workflows
   at most one level.
3. **Cost.** Full run ≈ **30–50 agents/week** (discovery 8 sources + dedup + SERP
   fan-out + competitor reads + angle panel + citation validation + draft + HTML).
   Fine weekly; bigger token spend than today's linear task, ×N tenants.

---

## 6.9 Codex review resolutions (2026-06-01)

Independent design review by Codex (GPT-5.5). **All 12 findings accepted.** These
decisions **govern** where they refine earlier prose. ★ = decided by Gev.

**Folded into the design:**
1. **State vs no-publish** ★ — status enum `{drafted, approved, published, rejected}`.
   All `drafted` topics claim their cluster; unpublished claims **expire after ~12 weeks**;
   a reconciliation step ingests the real published URL/topic (you publish externally).
   Patched into §5 firewall scope.
2. **Headless notify chicken-egg** — `notify` moves to **Layer 3** (the routine config) as
   a REQUIRED channel; `BRAND.md.notify` is only for content digests. No-config first run
   → Layer 3 alert + visible scheduler failure (never silently dies).
3. **Silent degradation** ★ — add `minimum_firewall_tier`. Below it, a scheduled run
   **skips the week + sends a high-severity alert** (mirrors famine behavior). Tier +
   dedup confidence are always reported.
4. **Firewall contradiction** — explicit precedence (now in §5): SERP-overlap > threshold
   ⇒ reject regardless of intent; same `parent_topic` ⇒ reject only if same intent, allow
   if intent differs (spoke). Intent classified for candidate + existing posts.
5. **SERP-overlap rigor** `[build]` — URL canonicalization, fixed locale/device, dated
   snapshots, exclude own domain, confidence bands (not a hard 30%).
6. **GSC overestimated** — Tier 2 reframed as a **history-only** signal (dedup vs your own
   pages); it can't score new candidates and is sparse for new sites. Not a discovery replacement.
7. **Dual-mode drift** — single source of truth: shared prompt/schema/threshold modules that
   BOTH the skill and the workflow import. No duplicated logic between the two modes.
8. **Gate contracts** ★ — each gate has a defined on-reject action (retry once → next
   candidate → abort+alert). Angle uses an **automated judge-panel gate BEFORE the draft**
   (cheap rejection → pick next angle/candidate); the human angle FYI is informational and
   pre-publish. No more expensive-draft-then-kill.
   **PROVEN CRITICAL (drafting-spine workflow, 2026-06-01):** the outline critic returned
   `revise` with 8 specific, SERP-grounded issues (buried hook, SERP-saturated section,
   GSM stated as a point not a range, missing quilting use-case, missing needle/thread
   sub-question, premature single-brand plug, 2 missing high-PAA FAQs) — i.e. the
   adversarial gate WORKS and is not a rubber-stamp. **BUT the pipeline drafted on the
   un-revised outline anyway** — the gate was decorative. **Enforcement is mandatory:** on
   `revise`, loop back (regenerate the outline incorporating the critique, or feed the
   critique into the draft agent) BEFORE drafting. A critic whose verdict isn't wired to an
   action is wasted tokens.
9. **Output validators** `[build]` — HTML well-formed, JSON-LD parses, slug uniqueness vs
   tracker, DOCX conversion check, link resolution. Placeholder images: empty `src` flagged
   intentional (or an explicit placeholder block) so it doesn't break CMS/review.
   Two validators promoted to **blocking gates** from a full-draft dry run
   (2026-06-01) — both defects shipped silently past a human skim:
   - **W2 — Citation/source gate (blocking).** Every factual claim must be sourced; every
     source must be legit/reliable/authoritative; every source must be a resolved `<a>`
     hyperlink with **correct, descriptive anchor text** (no bare URLs, no "click here").
     Naming a source in prose without a verified, well-anchored link = FAIL. (In the dry
     run the draft named 3 sources and inserted 0 links.) Validation logic and
     link-insertion are *separate* failure points — gate both.
     **POC validated (workflow run, 2026-06-01):** the gate runs as a clean parallel
     fan-out (3 Sonnet agents → schema verdicts → barrier → audit, ~60k tokens / 28s).
     It surfaced one refinement: all 3 sources rated *medium* authority and passed on
     "high OR medium", so the **authority threshold must be configurable — per tenant AND
     per claim-type** (safety / health / statistics demand `high`; craft how-tos may
     accept `medium`). The judge was fair, not trigger-happy, but lenient enough that the
     bar needs to be a dial, not a constant.
   - **W1 — Derived length, not a fixed target.** Do NOT hardcode a word count. The target
     is **derived per article at Phase 5 (outline)** from the Phase 2 SERP depth (how long
     the ranking competitors run) × outline scope × intent, clamped to an envelope (default
     **2,000–3,500**; engine may justify going below 2,000 only when SERP norm + intent
     support a tighter piece, logged). The validator checks actual vs the *derived* target,
     flagging **thin** (under) AND **bloat/filler** (over without added substance) — the
     floor must never trigger padding (the skill forbids filler).
     **Proven (drafting-spine workflow, 2026-06-01):** the validator must COMPUTE the actual
     count — never trust the draft agent's self-report. The agent claimed 1,320 words; the
     JS validator measured 2,137. The model's number is unreliable; the validator is the
     source of truth (Opus prose hit target, so the design holds — but only the validator
     knew it).
10. **Config schema completeness** `[build]` — expand frontmatter (output paths, state files,
    notify routing, `schema_version`, required/optional semantics) + validate-on-load.
11. **Concurrency / idempotency** `[build]` — run IDs, lockfile on the state dir, atomic
    writes (temp + rename), retry semantics, crash recovery; extends the existing
    backup/verify + row-delta discipline from `TRACKERS_MANIFEST.md`.
12. **Bootstrap false confidence** — every inferred field carries source URL + confidence;
    "unknown" is allowed; never auto-confirm (strengthens the `# inferred — confirm` mark).

`[build]` = implementation-time requirement, recorded here so it isn't lost.

---

## 7. Open decisions

- [x] Absorb discovery into v2.0 (Option A) — **decided**
- [x] Author v2.0 as a workflow (top-level conductor) — **decided**
- [x] Trigger via routine / Cowork schedule — **decided (pending MCP validation)**
- [x] Dual-mode (interactive skill + headless workflow) — **decided: both required.**
      Mitigate drift (Codex #7) with a single source of truth (shared prompt/schema/
      threshold modules both modes import).
- [x] Folder/extraction — **done.** Generic engine already lives at
      `Documents/Claude/Rankenstein_v2/`, outside any brand project; each tenant's
      `BRAND.md` stays in its own project. Remaining piece (packaging as an installable
      `SKILL.md` + workflow artifact) is a **build milestone**, not an open decision.
- [x] Brand-config format for Layer 2 — **decided: `BRAND.md` (frontmatter + prose) +
      separate state layer** (see §2.5; `BRAND.template.md`, `bootstrap-interview.md`)

---

## 8. Next steps (do NOT skip the probe)

1. **🔴 Feasibility probe first.** Trigger a *trivial* workflow from an actual
   routine/Cowork schedule that makes ONE Ahrefs call. Confirm it returns
   authenticated in the headless context. Everything else is moot if this fails.
2. If green → scaffold the **citation-validation workflow** (Phase 6) as the first
   real brick: read-only, parallel, no tracker writes, reusable by blog + Substack.
3. Then → competitor deep-read fan-out (Phase 2B).
4. Then → the discovery 8-source fan-out + SERP-overlap firewall.
5. Then → wire dual-mode dispatch in the skill.
6. Throughout: keep brand-specifics in Layer 2; keep the engine clean.
