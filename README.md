# aeoptimize

[![npm version](https://img.shields.io/npm/v/aeoptimize.svg)](https://www.npmjs.com/package/aeoptimize)
[![license](https://img.shields.io/npm/l/aeoptimize.svg)](https://github.com/dexuwang627-cloud/aeoptimize/blob/main/LICENSE)

**CLI toolkit + Claude Code skills that transform SEO-optimized websites into AI-search-ready content.**

AI search engines (ChatGPT, Perplexity, Google AI Overview) don't rank pages — they **cite** content. `aeoptimize` helps you make your content citable.

```bash
npx aeoptimize scan your-site.com
```

```
AEO Readability Report
Score: 61/100  AI Readability: Good

  Structure        ██████████████░░░░░░ 18/25
  Citability       ████████████░░░░░░░░ 16/25
  Schema           ███████░░░░░░░░░░░░░  7/20
  AI Metadata      ███████░░░░░░░░░░░░░  8/15
  Content Density  ███████████████░░░░░ 12/15

Top Suggestions:
  → Add FAQ section with question-format headings
  → Add AI-relevant schema types
  → Create and link an llms.txt file
```

## Features

### Scan — AI Readability Audit

17 rules across 5 dimensions, 0-100 score. Zero cost, offline capable, deterministic.

```bash
npx aeoptimize scan https://example.com          # Remote URL
npx aeoptimize scan ./dist --dir                   # Local directory
npx aeoptimize scan ./dist --dir --json            # Machine-readable
```

| Dimension | Max | What it measures |
|-----------|-----|------------------|
| **Structure** | 25 | Heading hierarchy, paragraph length, FAQ presence |
| **Citability** | 25 | Self-contained statements, data/stats, definitions |
| **Schema** | 20 | JSON-LD presence, completeness, AI-relevant types |
| **AI Metadata** | 15 | llms.txt, robots.txt AI config, meta description |
| **Content Density** | 15 | Content vs boilerplate, keyword stuffing detection |

### Multi-AI Scoring

Score with multiple AI engines simultaneously. Detects `gemini` and `copilot` CLIs, dispatches parallel scoring, merges with rule engine.

```bash
npx aeoptimize scan https://example.com --multi-ai
```

```
Score: 72/100 (Rule Engine: 61 | AI Consensus: 83)

  Rule Engine      ████████████░░░░░░░░ 61/100
  Claude           ████████████████░░░░ 85/100
  Gemini           ████████████████░░░░ 81/100

AI Insights:
  Claude:  "FAQ section lacks schema markup"
  Gemini:  "Missing llms.txt reduces discoverability"
```

| Scenario | Weighting |
|----------|-----------|
| Rule engine + 2+ AIs | 50% rules + 50% AI average |
| Rule engine + 1 AI | 60% rules + 40% AI |
| Rule engine only | 100% rules |

### Generate — AI Infrastructure Files

```bash
npx aeoptimize generate ./dist --dry-run           # Preview
npx aeoptimize generate ./dist                    # Write files
```

Generates:
- **llms.txt** — Machine-readable site summary ([llmstxt.org](https://llmstxt.org) standard)
- **llms-full.txt** — Full content for deep AI consumption
- **JSON-LD schemas** — Article, FAQPage, BreadcrumbList
- **robots.txt suggestions** — AI crawler allow/deny rules

### Transform — AI Content Restructuring (Claude Code Skill)

Uses your existing Claude subscription — zero extra cost:

- Split long paragraphs into citable statements
- Extract implicit Q&A into FAQ schema
- Remove keyword stuffing
- Fix dangling references ("This...", "It...", "They...")
- Inject structured data

## Framework Plugins

### Vite

```ts
// vite.config.ts
import { aeoPlugin } from 'aeoptimize/vite';

export default defineConfig({
  plugins: [aeoPlugin()]
});
```

### Next.js

```ts
// next.config.mjs
import { withAeo } from 'aeoptimize/next';

export default withAeo({});
```

Build 時自動生成 `llms.txt`、`llms-full.txt`、`_aeo/generated-schemas.json` 並印出 AEO 分數。

Options: `{ silent?: boolean; outDir?: string }`

## Claude Code Skills

```bash
claude plugin marketplace add dexuwang627-cloud/aeoptimize
```

- `/aeo-scan` — Interactive audit with multi-AI scoring
- `/aeo-generate` — Guided file generation with preview
- `/aeo-transform` — AI-powered content restructuring

## Why AEO?

| | SEO | AEO |
|---|---|---|
| **Goal** | Rank higher | Get cited |
| **Audience** | Search crawler | Language model |
| **Key metric** | Position | Citation accuracy |
| **Content style** | Keyword-rich | Self-contained, structured |
| **Structured data** | Nice to have | Essential |

67% of users now get their first answer from AI. If your content can't be extracted and cited, it's invisible.

## Help

```bash
npx aeoptimize --help            # All commands
npx aeoptimize scan --help       # Scan options
npx aeoptimize generate --help   # Generate options
```

## License

MIT
