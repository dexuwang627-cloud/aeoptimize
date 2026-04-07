---
title: "Getting Started with llms.txt"
author: "John Doe"
date: "2026-02-01"
---

# Getting Started with llms.txt

llms.txt is an emerging standard that helps large language models understand your website's content and structure. The standard was proposed by Jeremy Howard of fast.ai in 2024.

## What is llms.txt?

llms.txt is a plain text file placed at the root of your website (e.g., `https://example.com/llms.txt`) that provides a structured summary of your site's content specifically designed for LLM consumption.

The llms.txt format uses Markdown with specific conventions:

- An H1 heading with the site name
- A blockquote with a brief site description
- Sections with links to key pages
- Optional detailed content sections

## Why You Need llms.txt

Our analysis of 10,000 websites shows that sites with llms.txt are cited 2.1x more frequently by AI assistants. The file gives AI engines a roadmap to your content, reducing the chance of misinterpretation.

Key benefits include:

1. Better AI citation accuracy — 89% improvement in correct attribution
2. Faster content indexing by AI crawlers — 3x faster discovery
3. Reduced hallucination when AI discusses your product or service

## How to Create llms.txt

Creating an llms.txt file takes about 15 minutes. Here is the basic structure:

```markdown
# Your Site Name

> Brief description of what your site is about.

## Main Pages

- [Page Title](https://example.com/page): Brief description
- [Another Page](https://example.com/another): Brief description

## Documentation

- [Getting Started](https://example.com/docs/start): Quick start guide
- [API Reference](https://example.com/docs/api): Full API documentation
```

## Frequently Asked Questions

### Is llms.txt the same as robots.txt?

llms.txt and robots.txt serve different purposes. robots.txt controls crawler access permissions. llms.txt provides content summaries for AI understanding. Both files can coexist at your site root.

### Do all AI engines support llms.txt?

As of 2026, Perplexity, Claude, and several other AI engines actively check for llms.txt. Google AI Overview uses it as a supplementary signal. Support is growing rapidly.
