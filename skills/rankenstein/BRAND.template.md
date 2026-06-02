---
# ─── Rankenstein · Brand Config (declared layer) ───
# Machine-read fields. The workflow parses these directly — keep them structured.
# Fill every field. Inline comments are optional to delete once you're done.

brand:              # Brand/company name, e.g. "Acme Co"
url:                # Primary domain, no protocol, e.g. "example.com"

facets:             # 3-6 coverage TAGS (not topics). Drives adaptive coverage balancing.
  # - tag-one       # Tags overlap by nature (a post can be several at once) — that's fine.
  # - tag-two

competitors:        # Domains for content-gap + SERP-overlap comparison
  # - competitor-one.com
  # - competitor-two.com

voice_hard_rules:   # Deterministic, enforceable rules — the engine checks these literally
  banned_words: []          # words/phrases the brand never uses
  em_dashes: false          # allow em dashes? default false (reads AI-generated)
  emojis_in_headings: false

state_dir:          # Where accumulated memory lives (trackers, claimed-cluster history)
  #                 # e.g. "Trackers/"

notify:             # Async human-in-the-loop channel: telegram | slack | email | none
  #                 # channel credentials live in the instance/Layer-3 config, NOT here
---

## Audience
<!-- Who you write FOR, specifically. "Parents" / "businesses" is too vague. Name the
     person: life stage, location, income, the anxiety or job they hire content to do.
     Phase 4 (angle development) is only as sharp as this is specific. -->

## Voice
<!-- Tone in 2-4 sentences. How the brand sounds, what it leads with, what it avoids.
     Soft guidance the LLM reads. (Hard, checkable rules go in frontmatter above.) -->

## Brand facts to weave in (honestly, never as a plug)
<!-- Verifiable, specific facts that earn the brand a legitimate place in the article:
     certifications + their numbers, manufacturing/origin story, a genuine USP.
     The engine treats the brand as ONE honest entry among competitors — never #1,
     never with more glowing language than the others. Specificity does the persuading. -->

## Source material (inject when relevant)
<!-- Paths (relative to project root) to internal reports, stat sheets, or voice
     libraries the draft may cite. Optional but powerful. -->
