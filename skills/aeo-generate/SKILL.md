---
name: aeo-generate
description: Use when creating llms.txt, JSON-LD structured data, or robots.txt AI crawler configuration for a website or project build output
---

# AEO Generate — AI Infrastructure Files

Generate AI infrastructure files from existing website content to make it discoverable by AI search engines.

## What Gets Generated

| File | Purpose |
|------|---------|
| `llms.txt` | Machine-readable site summary for LLMs (llmstxt.org standard) |
| `llms-full.txt` | Full content version for deep AI consumption |
| `_aeo/generated-schemas.json` | JSON-LD schemas (Article, FAQPage, BreadcrumbList) |
| robots.txt suggestions | AI crawler allow/deny rules (printed, not auto-applied) |

## Workflow

1. **Identify build output.** Ask the user for the directory containing their built site (e.g., `dist/`, `out/`, `build/`). Check for common framework patterns:
   - Next.js: `.next/` or `out/`
   - Vite/Astro: `dist/`
   - Hugo/Jekyll: `public/`

2. **Preview first.** Run:
   ```
   npx @cucuwang/aeo-cli generate <dir> --dry-run
   ```
   Show the user what will be generated and explain each file's purpose.

3. **Confirm and generate.** On approval:
   ```
   npx @cucuwang/aeo-cli generate <dir>
   ```

4. **Review generated files.** Read each generated file and suggest manual refinements:
   - `llms.txt`: Verify site name, description, and page listing are accurate
   - JSON-LD: Check that generated schemas match the actual content
   - robots.txt: Explain each AI crawler and let user decide allow/deny

5. **Integration guidance.** Explain how to deploy:
   - Place `llms.txt` at site root (alongside `robots.txt`)
   - Add `<link rel="llms-txt" href="/llms.txt">` to HTML `<head>`
   - Inject generated JSON-LD into page `<head>` sections
   - Merge robots.txt suggestions with existing rules

## Important

- Always preview with `--dry-run` before writing
- Never overwrite existing files without user confirmation
- Suggest running `/aeo-scan` first to understand current state
- The robots.txt suggestions are printed only — never auto-modify robots.txt
