---
name: aeo-scan
description: Use when auditing a website or build output for AI search readiness, checking AI readability scores, or diagnosing why content isn't being cited by AI assistants like ChatGPT, Perplexity, or Google AI Overview
---

# AEO Scan — AI Readability Audit

Scan a website or build directory and produce an interactive AI readability report.

## Scoring Dimensions (0-100)

| Dimension | Max | What it measures |
|-----------|-----|------------------|
| Structure | 25 | Heading hierarchy, paragraph length, FAQ presence, list usage |
| Citability | 25 | Self-contained statements, data/stats, definitions, attribution |
| Schema | 20 | JSON-LD presence, completeness, AI-relevant types |
| AI Metadata | 15 | llms.txt, robots.txt AI config, meta description |
| Content Density | 15 | Content vs boilerplate, keyword stuffing, uniqueness |

## Workflow

1. **Identify target.** Ask the user for a URL or directory path. If in a project with a build output (e.g., `dist/`, `out/`, `.next/`, `build/`), suggest scanning that.

2. **Run scan.** Execute:
   ```
   npx @cucuwang/aeo-cli scan <target> --json
   ```

3. **Present results.** Summarize the overall score and highlight:
   - Dimensions scoring below 60% of their max
   - All critical issues
   - Top 3 high-impact suggestions

4. **Discuss improvements.** For each weak dimension, explain:
   - Why it matters for AI search visibility
   - Concrete steps to improve
   - Expected score impact

5. **Offer next steps:**
   - Score below 50? Suggest running `/aeo-transform` on the worst pages
   - Missing llms.txt or schema? Suggest `/aeo-generate`
   - Score above 80? Congratulate and suggest monitoring over time

## Important

- Always run the CLI with `--json` for machine-readable output
- Present scores visually with context, not just numbers
- Focus discussion on high-impact fixes first
- If scanning a URL fails (CORS, timeout), suggest scanning the local build output instead
- Version: 0.1.0
