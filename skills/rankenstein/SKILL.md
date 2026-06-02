---
name: rankenstein-v2
description: Draft a research-first, on-brand, SEO + AEO-optimized blog post for a given brand and topic using the Rankenstein v2.0 engine — keyword research with SERP-ownership-based choice, an enforced adversarial outline critic, brand-voice-locked Opus prose, validated and linked citations, and CMS-ready HTML with a content brief and image-generation prompts. Use when the user wants to write or draft a blog post, article, or SEO content for a specific brand. Generic for any brand. This is the DRAFTING engine; pair it with a routine for topic discovery, dedup, and state.
---

# Rankenstein v2.0 — Drafting Engine

This skill drafts a single, validated, on-brand blog post from a brand + topic. It does NOT
choose topics or dedup against a brand's published history — that is a routine's job (read
history → dedup → call this skill → write history back).

## When invoked

1. **Gather brand context.** If a `BRAND.md` exists for this brand/project, load it.
   Otherwise run the first-run bootstrap (`bootstrap-interview.md`): ask for the URL, fetch
   it, propose a `BRAND.md`, and confirm. Minimum needed: brand **name, url, facts**
   (verifiable differentiators), **audience** (specific), **voice** (including any hard
   rules — banned words, em-dash policy, framing).

2. **Get the topic + intent** (from the user or the routine). A **seed keyword is enough** —
   the engine does the real keyword research and chooses the final primary keyword itself,
   weighing volume, difficulty, intent, AEO potential, and winnability (who owns the SERP vs
   this brand's authority).

3. **Run the engine.** Invoke the **Workflow** tool with `rankenstein-v2-drafting.workflow.js`.
   Pass the gathered brand + topic via `args`, OR (more reliable) inline the script and fill
   its `INPUT` block. The script **fails loud** if brand/topic are missing — never let it run
   with a placeholder brand.

4. **Present results.** Save the returned `html` to a `.html` file. Then report:
   - the chosen **angle** and whether the **critic looped back** (`outline_passes` > 1),
   - the **keyword choice** + the **SERP owner / winnability** note,
   - the **citation audit** (any `fail` = a claim whose source did not check out),
   - the **validator scorecard** (length vs target, slug ≤ 5 words, images visible + carry
     prompts, citations linked, etc.),
   - a **brand-voice compliance check** against the brand's hard rules (scan for banned words,
     em dashes, etc.) and flag any violations.
   Report failed citations, thin/bloat length, or voice breaks **honestly** — do not ship silently.

## Notes

- **Model tiers:** Opus for angle/outline/prose; Sonnet for research/critique/validation.
  ~17–19 agents, ~500–700k tokens per run.
- **Provider-agnostic:** discovers any connected SEO MCP (Ahrefs / SEMrush / BrightLocal / …)
  by capability and falls back to web search if none is connected, or if a provider errors /
  returns nothing / is rate-limited.
- **Output:** CMS-ready HTML with a visible Content Brief header, the article (AEO-structured,
  JSON-LD schema, FAQ), and 3 visible image placeholders each carrying a ready-to-use image
  generation prompt.
