---
name: aeo-transform
description: Use when restructuring website content for better AI citation — splitting long paragraphs, adding FAQ schema, removing keyword stuffing, improving heading structure, or injecting structured data into HTML or Markdown files
---

# AEO Transform — AI-Friendly Content Restructuring

Transform SEO-optimized content into AI-search-ready format using language understanding. This skill uses your Claude subscription — no additional API costs.

## Transformation Strategies

| Strategy | What it does | Impact |
|----------|-------------|--------|
| **Split paragraphs** | Break long paragraphs (>150 words) into self-contained statements | High |
| **Extract FAQ** | Find implicit Q&A content and convert to explicit FAQ with schema | High |
| **Remove keyword stuffing** | Replace repeated keywords with natural synonyms | High |
| **Improve headings** | Rewrite vague headings as specific, question-format headings | Medium |
| **Add structured data** | Inject JSON-LD based on content analysis | Medium |
| **Fix dangling references** | Rewrite paragraphs starting with "This", "It", "They" to be self-contained | Medium |

## Workflow

1. **Identify targets.** Ask the user which files to transform. If unsure, suggest running `/aeo-scan` first to find the lowest-scoring pages.

2. **Read and analyze.** For each file:
   - Read the full content
   - Run `npx aeoptimize scan <file> --json` to get the current score
   - Identify which strategies apply based on the issues found

3. **Transform incrementally.** Apply one strategy at a time:
   - Show the proposed change as a diff
   - Explain why this change improves AI readability
   - Wait for user approval before applying
   - Move to the next strategy

4. **Preserve voice.** Critical rules:
   - Never invent new content or add claims not in the original
   - Preserve the author's writing style and tone
   - Only restructure — do not rewrite meaning
   - Keep all existing data, quotes, and references intact

5. **Verify improvement.** After all transforms:
   - Re-run `npx aeoptimize scan <file> --json`
   - Show before/after score comparison
   - Highlight which dimensions improved

## Strategy Details

### Split Paragraphs
For each paragraph over 150 words:
- Identify distinct ideas within the paragraph
- Split at natural boundaries (topic shifts, "Additionally", "However")
- Ensure each new paragraph is self-contained (has its own subject, not just "It..." or "This...")

### Extract FAQ
Look for patterns like:
- Heading followed by a short answer paragraph
- "What is X?" / "How does X work?" patterns in body text
- Implicit questions answered in the content

Convert to:
- Explicit `<h3>` question headings
- Concise answer paragraphs
- FAQPage JSON-LD schema

### Remove Keyword Stuffing
When a word appears >3% of content (excluding stop words):
- Replace some occurrences with synonyms or related terms
- Remove redundant mentions that don't add meaning
- Ensure remaining usage feels natural

### Fix Dangling References
For paragraphs starting with pronouns/conjunctions:
- Replace "This feature" with "[Product name]'s feature"
- Replace "It provides" with "[Subject] provides"
- Replace "However," with a self-contained restatement

## Important

- Always show diffs before applying changes
- Transform one file at a time, one strategy at a time
- Score comparison before/after is mandatory
- This skill is interactive — never batch-transform without review
- Supports `.html` and `.md` files
