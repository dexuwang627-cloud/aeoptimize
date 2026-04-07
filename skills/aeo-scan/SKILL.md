---
name: aeo-scan
description: Use when auditing a website or build output for AI search readiness, checking AI readability scores, or diagnosing why content isn't being cited by AI assistants like ChatGPT, Perplexity, or Google AI Overview
---

# AEO Scan — AI Readability Audit

Scan a website or build directory and produce an interactive AI readability report. Supports multi-AI scoring with gemini and copilot CLIs.

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

2. **Detect AI CLIs.** Check which AI tools are available:
   ```
   which gemini && which copilot
   ```
   Report which are found. If both are available, offer multi-AI scoring.

3. **Run scan.** Choose based on available CLIs:

   **If external AI CLIs available:**
   ```
   npx aeoptimize scan <target> --multi-ai --json
   ```
   This runs the rule engine + dispatches gemini/copilot for parallel scoring.

   **If no external CLIs:**
   ```
   npx aeoptimize scan <target> --json
   ```
   Then use the `aeo-ai-scorer` agent to add Claude's AI-level analysis on top of the rule engine score.

4. **Present results.** Show:
   - **Consensus score** (rule engine + AI weighted average)
   - **Per-scorer breakdown** (Rule Engine, Claude, Gemini, Copilot — whichever are available)
   - Dimensions scoring below 60% of their max
   - All critical issues
   - **AI insights** — each AI's one-sentence summary of the biggest issue

5. **Discuss improvements.** For each weak dimension, explain:
   - Why it matters for AI search visibility
   - Concrete steps to improve
   - Expected score impact
   - Cross-reference insights from different AI scorers if they agree/disagree

6. **Deep analysis (optional).** If the user wants detailed per-page analysis, dispatch the `aeo-analyzer` agent with the page HTML and scan report. It provides issue-by-issue breakdown with before/after examples.

7. **Offer next steps:**
   - Score below 50? Suggest running `/aeo-transform` on the worst pages
   - Missing llms.txt or schema? Suggest `/aeo-generate`
   - Score above 80? Congratulate and suggest monitoring over time

## Multi-AI Scoring Methodology

| Scenario | Weighting |
|----------|-----------|
| Rule engine + 2+ AIs | 50% rule engine + 50% AI average |
| Rule engine + 1 AI | 60% rule engine + 40% AI |
| Rule engine only | 100% rule engine |

## Important

- Always run the CLI with `--json` for machine-readable output
- Present scores visually with context, not just numbers
- Focus discussion on high-impact fixes first
- If scanning a URL fails (CORS, timeout), suggest scanning the local build output instead
- When using Claude as AI scorer (no external CLIs), dispatch the `aeo-ai-scorer` agent
