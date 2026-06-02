export const meta = {
  name: 'rankenstein-v2-drafting',
  description: 'Rankenstein v2.0 engine: state-aware history/dedup -> proper keyword research (discover -> SERP ownership -> multi-factor choice incl. winnability) -> angle judge-panel -> outline with ENFORCED critic loop-back -> Opus prose -> citation-validation -> JS Content-Brief header + VISIBLE image placeholders (with gen prompts) + validators. Generic for any brand. Input via args OR the fillable INPUT block. If given a state_dir it dedups against prior trackers + the brand’s published footprint and logs to its own history file; casual one-offs skip history.',
  phases: [
    { title: 'History', detail: 'state-aware: read prior trackers / sitemap for dedup + internal links (skipped if no state_dir)' },
    { title: 'Research', detail: 'discover keywords -> SERP ownership -> multi-factor choice + derived length' },
    { title: 'Angle', detail: '4 diverse-lens generators (Sonnet) -> Opus judge' },
    { title: 'Outline', detail: 'Opus outline -> Sonnet critic -> LOOP BACK on revise (max 2)' },
    { title: 'Draft', detail: 'Opus prose; visible image placeholders w/ gen prompts, or generated images' },
    { title: 'Validate', detail: 'citation fan-out + JS Content-Brief header + validators' },
  ],
}

// ---- INPUT: via args (preferred) OR fill the block below (skill inline mode). Fail loud if neither. ----
const INPUT = (typeof args === 'object' && args && args.brand && args.topic) ? args : {
  brand: { name: '__FILL_NAME__', url: '__FILL__', facts: '__FILL__', audience: '__FILL__', voice: '__FILL__' },
  topic: { topic: '__FILL__', seed_keyword: '__FILL__', intent: 'informational' },
  target_words: null, // null = derive from SERP competitor depth
  state_dir: null,    // optional: folder with prior trackers / where to log history. null = casual one-off (no dedup)
}
if (!INPUT.brand || INPUT.brand.name === '__FILL_NAME__' || !INPUT.topic || INPUT.topic.topic === '__FILL__') {
  throw new Error('rankenstein-v2-drafting: no real brand/topic provided. Pass via args or fill the INPUT block. Refusing to run with a placeholder/sample brand.')
}
const BRAND = INPUT.brand
const TOPIC = INPUT.topic
const SEED = TOPIC.seed_keyword || TOPIC.primary_keyword || TOPIC.topic
const VOICE = `Voice: ${BRAND.voice} No em dashes. No emojis in headings. Treat ${BRAND.name} as ONE honest entry, never a hard sell.`

// ============ Phase: History (state-aware dedup + internal-linking; skipped if no state_dir) ============
phase('History')
const STATE_DIR = INPUT.state_dir || (BRAND && BRAND.state_dir) || null
let history = { active: false, covered: [], internal_link_targets: [], history_file: null, note: 'no state_dir — casual one-off, dedup + history skipped' }
if (STATE_DIR) {
  const HISTORY_SCHEMA = {
    type: 'object', additionalProperties: false,
    properties: {
      tracker_files_found: { type: 'array', items: { type: 'string' } },
      history_file: { type: 'string' },
      created_history_file: { type: 'boolean' },
      seeded_from_site: { type: 'boolean' },
      covered: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { title: { type: 'string' }, keyword: { type: 'string' }, url: { type: ['string', 'null'] }, intent: { type: 'string' } }, required: ['title', 'keyword'] } },
      note: { type: 'string' },
    },
    required: ['tracker_files_found', 'history_file', 'created_history_file', 'seeded_from_site', 'covered', 'note'],
  }
  const h = await agent(
    `Build ${BRAND.name}'s published-content history for dedup + internal linking. State dir: "${STATE_DIR}".
1. Glob the state dir for tracker files (*.csv, *.xlsx). READ ANY found, best-effort (any schema — extract title / keyword / url / intent columns however they are named; use python for .xlsx). These are previously-covered topics. Do NOT modify these third-party trackers.
2. Also read the engine's own "rankenstein_history.csv" in the state dir if present.
3. If NO tracker or history file exists at all, CREATE "rankenstein_history.csv" with header "date,primary_keyword,title,url_slug,intent,status" — set created_history_file true. Optionally seed it by fetching ${BRAND.url ? BRAND.url + "'s" : 'the brand site'} sitemap.xml / blog index to list already-published URLs + titles (set seeded_from_site true if you did).
4. Return the combined 'covered' list (title + keyword + url + intent per previously-covered piece) and the path to the writable history_file.`,
    { label: 'history:scan', phase: 'History', schema: HISTORY_SCHEMA, model: 'sonnet' })
  history = { active: true, covered: h.covered || [], internal_link_targets: (h.covered || []).filter((c) => c.url), history_file: h.history_file, created: h.created_history_file, seeded: h.seeded_from_site, note: h.note }
  log(`History: ${history.covered.length} prior topics from ${STATE_DIR}${history.created ? ' (created fresh history file)' : ''}.`)
} else {
  log('History: no state_dir — casual run, dedup + history skipped.')
}

// ============ Phase: Keyword Research (discover -> SERP ownership -> choice) ============
phase('Research')

// 1) DISCOVER candidate keywords (provider-agnostic; PLP/branded junk excluded)
const DISCOVER_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    source: { type: 'string', enum: ['provider', 'web-estimate'] },
    provider_used: { type: 'string' },
    candidates: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { keyword: { type: 'string' }, volume: { type: ['integer', 'null'] }, kd: { type: ['integer', 'null'] }, intent: { type: 'string' } }, required: ['keyword', 'volume', 'intent'] } },
  },
  required: ['source', 'provider_used', 'candidates'],
}
const discovered = await agent(
  `Keyword DISCOVERY for the topic "${TOPIC.topic}" (seed: "${SEED}", intent: ${TOPIC.intent}).
Use ToolSearch to find ANY connected keyword-data provider (match on CAPABILITY: returns keyword volume/difficulty/rankings — could be Ahrefs, SEMrush, Moz, BrightLocal, or anything else; the name does not matter). Pull matching terms, related terms, and question-style terms with volume + KD + intent.
FALL BACK to WebSearch + ESTIMATE (set source "web-estimate") if EITHER (a) no such provider is connected, OR (b) a provider IS connected but returns no usable results, errors, or is rate-limited/quota-exhausted. Try a provider ONCE; do not retry. Always return candidates — degraded data beats no data.
HARD-EXCLUDE PLP/SKU junk: colors, sizes, "for sale / buy / price / cheap", "near me"/cities, and competitor-brand terms. Return 10-15 genuine BLOG candidates.`,
  { label: 'kw:discover', phase: 'Research', schema: DISCOVER_SCHEMA, model: 'sonnet' })

// 2) SERP OWNERSHIP for the top candidates (who owns the niche + can this brand win?)
const topCands = (discovered.candidates || []).slice(0, 4)
const SERP_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: { keyword: { type: 'string' }, serp_owner: { type: 'string' }, owner_authority: { type: 'string', enum: ['very-high', 'high', 'medium', 'low', 'mixed', 'unknown'] }, competitor_depth_words: { type: ['integer', 'null'] }, winnable_for_this_brand: { type: 'string', enum: ['yes', 'stretch', 'no', 'unknown'] }, notes: { type: 'string' } },
  required: ['keyword', 'serp_owner', 'owner_authority', 'winnable_for_this_brand', 'notes'],
}
const serp = await parallel(topCands.map((c) => () =>
  agent(`SERP OWNERSHIP analysis for the keyword "${c.keyword}".
Inspect the top ~10 ranking pages. PREFER a connected SERP/keyword provider (a serp-overview-type tool found via ToolSearch); if none is connected, OR if it returns nothing / errors / is rate-limited, fall back to WebSearch. Try the provider once, then fall back. Always return a result.
Report: the dominant domain(s) that OWN this SERP and their authority level; the typical article length of the ranking pages (competitor_depth_words); and whether a brand like ${BRAND.name} (${BRAND.url || 'unknown domain'}, a ${BRAND.facts}) can realistically rank here. Use the AUTHORITY GAP: a small brand cannot easily take a SERP owned by very-high-authority giants; a strong brand can. winnable_for_this_brand = yes | stretch | no | unknown.`,
    { label: `serp:${c.keyword.slice(0, 18)}`, phase: 'Research', schema: SERP_SCHEMA, model: 'sonnet' })))

// 3) MULTI-FACTOR CHOICE + derived length (the actual keyword decision)
const CHOICE_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    primary_keyword: { type: 'string' },
    primary_volume: { type: ['integer', 'null'] }, primary_kd: { type: ['integer', 'null'] },
    secondary_keywords: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { keyword: { type: 'string' }, volume: { type: ['integer', 'null'] } }, required: ['keyword', 'volume'] } },
    meta_title: { type: 'string' },
    derived_word_target: { type: 'integer' },
    serp_owner_note: { type: 'string' },
    dedup_decision: { type: 'string', enum: ['net-new', 'refresh', 'spoke'] },
    refresh_target_url: { type: ['string', 'null'] },
    rationale: { type: 'string' },
  },
  required: ['primary_keyword', 'secondary_keywords', 'meta_title', 'derived_word_target', 'serp_owner_note', 'dedup_decision', 'rationale'],
}
const choice = await agent(
  `Choose the PRIMARY keyword + 4-6 secondaries for ${BRAND.name} to target. Decide on MANY factors, not just volume:
- search volume and difficulty (KD)
- search-intent fit for a ${TOPIC.intent} blog post
- AEO / featured-snippet potential
- WINNABILITY = can a brand of ${BRAND.name}'s authority realistically outrank whoever OWNS this SERP? (use the SERP-ownership data; do NOT pick a keyword owned by very-high-authority giants if this brand is small; a strong brand CAN take harder terms.)
Then set derived_word_target by matching/modestly exceeding the ranking competitors' depth (clamp 1500-3500). Provide a meta_title (50-60 chars, primary kw near front) and a serp_owner_note (who owns this niche and why the pick is winnable).
DEDUP vs ${BRAND.name}'s ALREADY-PUBLISHED content (avoid self-cannibalization). Already covered: ${JSON.stringify((history.covered || []).map((c) => ({ title: c.title, keyword: c.keyword, url: c.url, intent: c.intent })))}.
- Prefer an UNCOVERED, winnable primary keyword. If the best keyword is already covered with the SAME intent, set dedup_decision "refresh", set refresh_target_url to that page, and pick the best UNCOVERED keyword instead of a self-competitor.
- If covered but a DIFFERENT intent, set dedup_decision "spoke" (fine to write; it will internally link to the existing page).
- Otherwise dedup_decision "net-new". (Empty covered list = net-new, refresh_target_url null.)
CANDIDATES:\n${JSON.stringify(discovered.candidates, null, 2)}\nSERP OWNERSHIP:\n${JSON.stringify(serp.filter(Boolean), null, 2)}`,
  { label: 'kw:choose', phase: 'Research', schema: CHOICE_SCHEMA, model: 'opus' })

const PRIMARY = choice.primary_keyword
const SECONDARIES = choice.secondary_keywords || []
const TARGET = INPUT.target_words || choice.derived_word_target || 2000
log(`Keyword choice: "${PRIMARY}" (vol ${choice.primary_volume}); SERP owner: ${choice.serp_owner_note.slice(0, 80)}; target ${TARGET}w (source: ${discovered.source}).`)

// ============ Phase: Angle (judge-panel) ============
phase('Angle')
const LENSES = ['contrarian (what everyone gets wrong)', 'spec/data-led', 'buyer-decision framework', 'maker/user-pain']
const ANGLE_SCHEMA = { type: 'object', additionalProperties: false, properties: { angle_statement: { type: 'string' }, lens: { type: 'string' }, why_clickable: { type: 'string' } }, required: ['angle_statement', 'lens', 'why_clickable'] }
const angles = await parallel(LENSES.map((lens) => () =>
  agent(`Generate ONE sharp blog angle (single sentence) for "${TOPIC.topic}" / primary keyword "${PRIMARY}" (brand: ${BRAND.name}, ${BRAND.facts}). Use ONLY the "${lens}" lens. ${VOICE}`,
    { label: `angle:${lens.split(' ')[0]}`, phase: 'Angle', schema: ANGLE_SCHEMA, model: 'sonnet' })))
const JUDGE_SCHEMA = { type: 'object', additionalProperties: false, properties: { winning_angle: { type: 'string' }, lens: { type: 'string' }, why: { type: 'string' }, runner_up: { type: 'string' } }, required: ['winning_angle', 'lens', 'why', 'runner_up'] }
const chosenAngle = await agent(
  `Angle judge. Pick the best angle for an ${TOPIC.intent} "${TOPIC.topic}" post (primary keyword "${PRIMARY}") that lets ${BRAND.name} show genuine expertise. Test: clickable subject line? Candidates:\n${JSON.stringify(angles.filter(Boolean), null, 2)}`,
  { label: 'angle:judge', phase: 'Angle', schema: JUDGE_SCHEMA, model: 'opus' })

// ============ Phase: Outline + ENFORCED critic loop-back ============
phase('Outline')
const OUTLINE_SCHEMA = { type: 'object', additionalProperties: false, properties: { working_title: { type: 'string' }, slug: { type: 'string' }, meta_description: { type: 'string' }, opening_hook: { type: 'string' }, sections: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { h2: { type: 'string' }, covers: { type: 'string' }, most_surprising: { type: 'string' } }, required: ['h2', 'covers', 'most_surprising'] } }, faqs: { type: 'array', items: { type: 'string' } } }, required: ['working_title', 'slug', 'meta_description', 'opening_hook', 'sections', 'faqs'] }
const CRITIC_SCHEMA = { type: 'object', additionalProperties: false, properties: { verdict: { type: 'string', enum: ['pass', 'revise'] }, issues: { type: 'array', items: { type: 'string' } }, suggestion: { type: 'string' } }, required: ['verdict', 'issues', 'suggestion'] }
let outline = await agent(
  `Build an AEO-structured outline for "${TOPIC.topic}" from this angle: "${chosenAngle.winning_angle}". Brand: ${BRAND.name} (${BRAND.facts}). Primary keyword "${PRIMARY}"; weave in secondaries naturally: ${SECONDARIES.map((k) => k.keyword).join(', ')}. 4-7 H2 sections each with a reason to exist; 5 FAQs from real PAA-style questions; slug MAX 4-5 words. ${VOICE}`,
  { label: 'outline:v1', phase: 'Outline', schema: OUTLINE_SCHEMA, model: 'opus' })
let critique = await agent(
  `Adversarially stress-test this outline for an ${TOPIC.intent} "${TOPIC.topic}" post. Find REAL gaps vs the live SERP (owner: ${choice.serp_owner_note}): generic/saturated sections, missing sub-questions, weak hook, premature/single-brand promo, missing high-PAA FAQs, slug >5 words. Default to "revise" if anything is weak.\n${JSON.stringify(outline)}`,
  { label: 'critic:v1', phase: 'Outline', schema: CRITIC_SCHEMA, model: 'sonnet' })
let pass = 1
while (critique.verdict === 'revise' && pass <= 2) {
  log(`Critic returned REVISE (pass ${pass}) with ${critique.issues.length} issues — regenerating outline.`)
  outline = await agent(
    `Revise this outline to fix EVERY issue the critic raised. Keep what works; address each concretely.\nOUTLINE:\n${JSON.stringify(outline)}\nCRITIC ISSUES:\n${JSON.stringify(critique.issues)}\nSUGGESTION:\n${critique.suggestion}\n${VOICE} Slug MAX 4-5 words.`,
    { label: `outline:v${pass + 1}`, phase: 'Outline', schema: OUTLINE_SCHEMA, model: 'opus' })
  critique = await agent(
    `Re-check this revised outline. Did it fix the prior issues? Any remaining REAL gaps? "pass" only if genuinely strong.\n${JSON.stringify(outline)}`,
    { label: `critic:v${pass + 1}`, phase: 'Outline', schema: CRITIC_SCHEMA, model: 'sonnet' })
  pass++
}
log(`Outline gate settled after ${pass} pass(es): verdict=${critique.verdict}`)

// ============ Phase: Draft ============
phase('Draft')
const DRAFT_SCHEMA = { type: 'object', additionalProperties: false, properties: { html: { type: 'string' }, word_count: { type: 'integer' }, sources_used: { type: 'array', items: { type: 'object', additionalProperties: false, properties: { claim: { type: 'string' }, url: { type: 'string' }, anchor: { type: 'string' } }, required: ['claim', 'url', 'anchor'] } } }, required: ['html', 'word_count', 'sources_used'] }
const draft = await agent(
  `Write the full blog post as semantic HTML. Topic: "${TOPIC.topic}". Primary keyword: "${PRIMARY}". Angle: "${chosenAngle.winning_angle}". Outline: ${JSON.stringify(outline)}.
Target ~${TARGET} words, do NOT pad. Brand: ${BRAND.name} (${BRAND.facts}). ${VOICE}
RESEARCH your own sources with WebSearch/WebFetch. Cite every factual/statistical claim, wrapped in an inline <a href> with descriptive anchor text (never a bare URL). For financial/legal/health claims cite ONLY high-authority sources (.gov/official). Verify each URL loads before citing.
IMAGES — exactly 3 (one near the top, two in the body), placed contextually. EACH image carries a complete, ready-to-use AI image-generation PROMPT (detailed: subject + composition + style + lighting + mood; end with "no text, no watermark"; note aspect ratio, e.g. 1200x630 top, 800x500 in-text). Make it good enough to paste DIRECTLY into an AI image generator.
  - If an image-generation tool is connected, generate FROM that prompt, put the real URL in src, AND keep the prompt in a data-image-prompt attribute on the <figure>.
  - OTHERWISE output a VISIBLE placeholder (NOT an empty <img>): <figure data-image-prompt="<the full prompt>"> containing
    <div style="border:2px dashed #bbb;background:#f5f5f5;color:#555;padding:24px 20px;text-align:left;font-family:system-ui,sans-serif;line-height:1.5;">
    showing on separate lines: "IMAGE PLACEHOLDER", "Alt: <alt text>", "Title: <title>", "Image prompt: <the full generation prompt>".
  Always include alt AND title. Empty <img src=""> is NOT allowed. Every image MUST have a data-image-prompt attribute.
INTERNAL LINKS — where genuinely relevant, link to ${BRAND.name}'s existing related pages with descriptive anchors (hub-and-spoke): ${JSON.stringify((history.internal_link_targets || []).map((c) => ({ title: c.title, url: c.url })))}.
Include one h1, the FAQ section, and JSON-LD Article + FAQPage blocks at the end. Return html (the <article>...</article> + JSON-LD; do NOT add a brief header, that is added separately), word_count, and sources_used.`,
  { label: 'draft:prose', phase: 'Draft', schema: DRAFT_SCHEMA, model: 'opus' })

// ============ Phase: Validate (citation fan-out + JS Content-Brief header + validators) ============
phase('Validate')
const CITE_SCHEMA = { type: 'object', additionalProperties: false, properties: { source_url: { type: 'string' }, authority_tier: { type: 'string', enum: ['high', 'medium', 'low', 'unreliable'] }, url_status: { type: 'string', enum: ['ok', 'broken', 'redirect'] }, supports_claim: { type: 'boolean' }, verdict: { type: 'string', enum: ['pass', 'fail'] }, reason: { type: 'string' } }, required: ['source_url', 'authority_tier', 'url_status', 'supports_claim', 'verdict', 'reason'] }
const citationAudit = await parallel((draft.sources_used || []).map((s) => () =>
  agent(`Validate (W2 gate). Claim: "${s.claim}". Source: ${s.url}. Fetch it, confirm it loads, confirm it ACTUALLY supports the SPECIFIC claim, judge authority. ${TOPIC.intent} topic; financial/legal/health claims require HIGH authority (.gov/official). verdict "pass" only if authority sufficient AND ok AND supports.`,
    { label: `cite:${(s.url.split('/')[2] || 'src')}`, phase: 'Validate', schema: CITE_SCHEMA, model: 'sonnet' })))

// --- history write-back: append this run to the engine's OWN history file (never third-party trackers) ---
if (history.active && history.history_file) {
  await agent(
    `Append ONE row to the CSV at "${history.history_file}" (create it with header "date,primary_keyword,title,url_slug,intent,status" if missing). Get today's date from the shell. Row: date=today, primary_keyword="${(PRIMARY || '').replace(/"/g, "'")}", title="${(outline.working_title || '').replace(/"/g, "'")}", url_slug="${outline.slug}", intent="${TOPIC.intent}", status=drafted. Use python to append safely WITHOUT rewriting existing rows. Confirm the append.`,
    { label: 'history:write', phase: 'Validate', model: 'sonnet' })
}

// --- JS: VISIBLE Content Brief header, prepended ---
const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const fmtKw = (k) => `${esc(k.keyword)}${k.volume != null ? ` (vol ${k.volume}${k.kd != null ? `, KD ${k.kd}` : ''})` : ' (vol n/a)'}`
const sourceNote = discovered.source === 'web-estimate' ? 'web estimate (not provider-verified)' : `${esc(discovered.provider_used)} (verified)`
const briefHeader =
`<header class="content-brief" style="border:1px solid #d0d0d0;background:#fafafa;padding:16px 20px;margin:0 0 28px;font-family:system-ui,sans-serif;font-size:14px;line-height:1.55;">
  <h2 style="margin:0 0 10px;font-size:16px;">Content Brief</h2>
  <p style="margin:4px 0;"><strong>Article title:</strong> ${esc(outline.working_title)}</p>
  <p style="margin:4px 0;"><strong>Meta title:</strong> ${esc(choice.meta_title)} <span style="color:#888;">(${(choice.meta_title || '').length} chars)</span></p>
  <p style="margin:4px 0;"><strong>Meta description:</strong> ${esc(outline.meta_description)} <span style="color:#888;">(${(outline.meta_description || '').length} chars)</span></p>
  <p style="margin:4px 0;"><strong>URL slug:</strong> ${esc(outline.slug)}</p>
  <p style="margin:4px 0;"><strong>Primary keyword:</strong> ${fmtKw({ keyword: PRIMARY, volume: choice.primary_volume, kd: choice.primary_kd })}</p>
  <p style="margin:4px 0;"><strong>Secondary keywords:</strong> ${SECONDARIES.map(fmtKw).join(', ') || 'n/a'}</p>
  <p style="margin:4px 0;"><strong>SERP owner / winnability:</strong> ${esc(choice.serp_owner_note)}</p>
  <p style="margin:4px 0;"><strong>Word target (derived):</strong> ${TARGET}</p>
  ${history.active ? `<p style="margin:4px 0;"><strong>History check:</strong> ${esc(choice.dedup_decision || 'net-new')}${choice.refresh_target_url ? ` &rarr; refresh ${esc(choice.refresh_target_url)}` : ''} <span style="color:#888;">(${history.covered.length} prior topics scanned)</span></p>` : ''}
  <p style="margin:8px 0 0;color:#888;">Keyword data: ${sourceNote}</p>
</header>
`
const finalHtml = briefHeader + (draft.html || '')

// --- JS validators ---
const wc = ((draft.html || '').replace(/<[^>]+>/g, ' ').match(/\S+/g) || []).length
const validators = {
  word_count_actual: wc, word_count_target: TARGET, word_count_agent_claimed: draft.word_count,
  has_content_brief: /class="content-brief"/.test(finalHtml),
  h1_count: ((draft.html || '').match(/<h1[ >]/g) || []).length,
  slug: outline.slug, slug_words: (outline.slug || '').split('-').filter(Boolean).length,
  jsonld_blocks: ((draft.html || '').match(/application\/ld\+json/g) || []).length,
  visible_image_placeholders: ((draft.html || '').match(/IMAGE PLACEHOLDER/g) || []).length,
  generated_images: ((draft.html || '').match(/<img[^>]*src="https?:\/\//g) || []).length,
  image_prompts: ((draft.html || '').match(/data-image-prompt=/g) || []).length,
  empty_src_imgs: ((draft.html || '').match(/<img[^>]*src=""/g) || []).length,
  citation_links: ((draft.html || '').match(/<a\s+href=/g) || []).length,
}
validators.thin = wc < TARGET * 0.85
validators.slug_ok = validators.slug_words <= 5
validators.images_ok = (validators.visible_image_placeholders + validators.generated_images) >= 3 && validators.empty_src_imgs === 0 && validators.image_prompts >= 3
validators.citations_linked_ok = validators.citation_links >= (draft.sources_used || []).length
validators.citation_gate_ok = (citationAudit.filter(Boolean)).filter((c) => c.verdict === 'fail').length === 0

return {
  brand: BRAND.name, topic: TOPIC.topic,
  keyword_research: { source: discovered.source, provider_used: discovered.provider_used, candidates: discovered.candidates, serp_ownership: serp.filter(Boolean), choice },
  primary_keyword: PRIMARY, secondary_keywords: SECONDARIES, meta_title: choice.meta_title,
  chosenAngle, outline_passes: pass, final_critic_verdict: critique.verdict, final_outline: outline,
  history: { active: history.active, covered_count: (history.covered || []).length, history_file: history.history_file, dedup_decision: choice.dedup_decision, refresh_target_url: choice.refresh_target_url, internal_link_targets: history.internal_link_targets, note: history.note },
  sources_used: draft.sources_used, citationAudit: citationAudit.filter(Boolean),
  validators, html: finalHtml,
}
