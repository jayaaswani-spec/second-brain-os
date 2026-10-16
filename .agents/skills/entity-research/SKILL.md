---
name: entity-research
description: Research a company or a person using public web sources, with entity-specific search filters and structured citations. Use for company profiles, competitor landscapes, company lists, professional backgrounds, public bios, expert discovery, or profile verification. Defer known internal people to `/contact`; use `/research` for topic-level research rather than an entity. Phrases include "research this company", "find competitors", "look up this person", "find experts", and "verify this LinkedIn profile".
allowed-tools: Task mcp__exa__web_search_advanced_exa
---

# entity-research

Research one of two entity types—company or person—using public information. Return distilled findings with source URLs and explicit uncertainty.

## Route first

- **Known internal person or existing relationship context** → `/contact` first. Use this skill only for fresh public enrichment when requested.
- **Company** → company branch below.
- **Person** → person branch below.
- **Topic, market thesis, or content idea** rather than a named entity → `/research`.

If the entity type is ambiguous, infer it from the name and prompt; ask only when the research method or output would materially differ.

## Shared search discipline

1. Use only `web_search_advanced_exa`; do not silently substitute another Exa endpoint.
2. Run broad searches in isolated Task agents and return compact findings to the main context. Generate two or three query variants when coverage matters, then merge and deduplicate.
3. Match result volume to the request: honor an explicit number; otherwise use a small focused set for a profile and a broader set for discovery. Ask about volume only when it materially changes cost or scope.
4. Treat public LinkedIn results as leads, not proof. Verify important claims against a company site, filing, personal site, conference bio, or reputable news source where possible.
5. Never infer private contact details, protected attributes, or identity matches from weak signals. State ambiguity.

## Company branch

Start with `category: "company"` for discovery and basic metadata. Use `category: "news"` for announcements and an unclassified/deep query for filings, product detail, or broader context.

Important filter limits:

- With `category: "company"`, omit domain and published/crawl date filters.
- `includeText` and `excludeText` accept at most one array item.

Return:

1. Company snapshot: what it does, location, scale/funding/revenue only when sourced.
2. Competitors or comparable companies, with the comparison basis.
3. Material recent developments when requested, including publication dates.
4. Sources with one-line relevance notes.
5. Conflicts, gaps, and confidence.

## Person branch

Start with `category: "people"` for public profiles, then use news or unclassified searches for interviews, conference bios, and corroboration.

Important filter limits:

- With `category: "people"`, omit date filters, text filters, and excluded domains. If including domains, use LinkedIn domains only.
- For auth-gated or dynamic pages, use an available browser only when the user has authorized that surface; otherwise report the limitation.

Return:

1. Name, current title/company, location if publicly verified, and relevant background.
2. Why each result likely matches the requested person.
3. Profile/source URLs.
4. Conflicts, incomplete fields, and verification status.

## Boundaries

- Public research only; no outreach or contact mutation.
- Do not claim financial, employment, or identity facts without a supporting source.
- Preserve the distinction between source facts and your inference.
