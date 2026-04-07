# aeo-cli

CLI toolkit + Claude Code skills that transform SEO-optimized websites into AI-search-ready content.

AI search engines (ChatGPT, Perplexity, Google AI Overview) don't rank pages — they cite content. `aeo-cli` helps you make your content citable.

## Quick Start

```bash
# Scan any website
npx aeo-cli scan https://your-site.com

# Scan local build output
npx aeo-cli scan ./dist

# Generate AI infrastructure files
npx aeo-cli generate ./dist
```

## What It Does

### `aeo scan` — AI Readability Audit

Analyzes your content across 5 dimensions and gives a 0-100 score:

| Dimension | Max | What it measures |
|-----------|-----|------------------|
| **Structure** | 25 | Heading hierarchy, paragraph length, FAQ presence |
| **Citability** | 25 | Self-contained statements, data/stats, definitions |
| **Schema** | 20 | JSON-LD presence, completeness, AI-relevant types |
| **AI Metadata** | 15 | llms.txt, robots.txt AI config, meta description |
| **Content Density** | 15 | Content vs boilerplate, keyword stuffing detection |

```bash
npx aeo-cli scan https://example.com        # Remote URL
npx aeo-cli scan ./dist                      # Local directory
npx aeo-cli scan ./dist --json               # Machine-readable output
```

### `aeo generate` — AI Infrastructure Files

Generates everything AI crawlers need to understand your site:

- **llms.txt** — Machine-readable site summary ([llmstxt.org](https://llmstxt.org) standard)
- **llms-full.txt** — Full content for deep AI consumption
- **JSON-LD schemas** — Article, FAQPage, BreadcrumbList
- **robots.txt suggestions** — AI crawler allow/deny rules

```bash
npx aeo-cli generate ./dist --dry-run        # Preview first
npx aeo-cli generate ./dist                  # Write files
npx aeo-cli generate ./dist --json           # Machine-readable
```

### `aeo transform` — AI Content Restructuring (Skill Only)

Available as a Claude Code skill — uses your existing subscription, no extra cost:

- Split long paragraphs into citable statements
- Extract implicit Q&A into FAQ schema
- Remove keyword stuffing
- Fix dangling references ("This...", "It...", "They...")
- Inject structured data

## Claude Code Skills

Install as a Claude Code plugin for interactive, AI-powered optimization:

```bash
claude plugin marketplace add dexuwang627-cloud/aeo-cli
```

Then use in any conversation:

- `/aeo-scan` — Interactive audit with discussion
- `/aeo-generate` — Guided file generation with preview
- `/aeo-transform` — AI-powered content restructuring

## Why AEO?

Traditional SEO optimizes for ranking algorithms. AEO optimizes for AI comprehension.

| | SEO | AEO |
|---|---|---|
| **Goal** | Rank higher | Get cited |
| **Audience** | Search crawler | Language model |
| **Key metric** | Position | Citation accuracy |
| **Content style** | Keyword-rich | Self-contained, structured |
| **Structured data** | Nice to have | Essential |

67% of users now get their first answer from AI — if your content can't be extracted and cited, it's invisible.

## Scoring Methodology

Each rule produces a score based on heuristic analysis (no LLM required):

- **17 rules** across 5 dimensions
- **Zero cost** — pure static analysis
- **Offline capable** — works without internet for local files
- **Deterministic** — same input always produces same score

The scoring weights (25/25/20/15/15) prioritize structure and citability because these factors most strongly correlate with AI citation rates.

## License

MIT
