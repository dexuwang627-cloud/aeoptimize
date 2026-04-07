import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateLlmsTxt, generateLlmsFullTxt, generateJsonLd, generateRobotsTxtSuggestions } from '../generator.js';
import { parseHtml, scanDocument } from '../scanner.js';
import type { SiteInfo, ScanReport, ParsedDocument } from '../types.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixtures = join(__dirname, 'fixtures');

const siteInfo: SiteInfo = {
  name: 'AEO Guide',
  description: 'Learn about Answer Engine Optimization',
  baseUrl: 'https://example.com',
};

describe('generateLlmsTxt', () => {
  it('produces valid llms.txt format', () => {
    const report: ScanReport = {
      pages: [
        { url: 'https://example.com/guide', title: 'AEO Guide', scores: { structure: 20, citability: 20, schema: 15, aiMetadata: 10, contentDensity: 10, total: 75 }, issues: [], suggestions: [] },
      ],
      overall: { structure: 20, citability: 20, schema: 15, aiMetadata: 10, contentDensity: 10, total: 75 },
      summary: 'Good',
      timestamp: '2026-04-07T00:00:00Z',
    };

    const result = generateLlmsTxt(report, siteInfo);

    expect(result).toContain('# AEO Guide');
    expect(result).toContain('> Learn about Answer Engine Optimization');
    expect(result).toContain('## Pages');
    expect(result).toContain('[AEO Guide](https://example.com/guide)');
  });

  it('handles empty pages', () => {
    const report: ScanReport = {
      pages: [],
      overall: { structure: 0, citability: 0, schema: 0, aiMetadata: 0, contentDensity: 0, total: 0 },
      summary: 'No pages',
      timestamp: '2026-04-07T00:00:00Z',
    };

    const result = generateLlmsTxt(report, siteInfo);
    expect(result).toContain('# AEO Guide');
    expect(result).not.toContain('## Pages');
  });
});

describe('generateLlmsFullTxt', () => {
  it('includes page content', async () => {
    const html = await readFile(join(fixtures, 'good-page.html'), 'utf-8');
    const doc = parseHtml(html, 'https://example.com/aeo');
    const report: ScanReport = {
      pages: [scanDocument(doc)],
      overall: scanDocument(doc).scores,
      summary: 'Test',
      timestamp: '2026-04-07T00:00:00Z',
    };

    const result = generateLlmsFullTxt(report, [doc]);
    expect(result).toContain('## What is Answer Engine Optimization');
    expect(result).toContain('---');
  });
});

describe('generateJsonLd', () => {
  it('generates Article schema for article-like content without existing schema', () => {
    const doc: ParsedDocument = {
      url: 'test',
      title: 'Test Article',
      headings: [
        { level: 1, text: 'Test Article' },
        { level: 2, text: 'Section One' },
      ],
      paragraphs: ['First paragraph.', 'Second paragraph.', 'Third paragraph.'],
      jsonLd: [],
      metaTags: { description: 'A test article', author: 'Jane' },
      links: [],
      rawText: 'Test content.',
    };

    const result = generateJsonLd(doc);
    const article = result.find((r: any) => r['@type'] === 'Article') as any;
    expect(article).toBeTruthy();
    expect(article.name).toBe('Test Article');
    expect(article.author.name).toBe('Jane');
  });

  it('generates FAQPage for question headings without existing FAQ schema', () => {
    const doc: ParsedDocument = {
      url: 'test',
      title: 'FAQ',
      headings: [
        { level: 1, text: 'FAQ' },
        { level: 2, text: 'What is AEO?' },
        { level: 2, text: 'How does it work?' },
      ],
      paragraphs: ['Intro.', 'AEO is answer engine optimization.', 'It works by restructuring content.'],
      jsonLd: [],
      metaTags: {},
      links: [],
      rawText: 'Test',
    };

    const result = generateJsonLd(doc);
    const faq = result.find((r: any) => r['@type'] === 'FAQPage') as any;
    expect(faq).toBeTruthy();
    expect(faq.mainEntity.length).toBe(2);
  });

  it('does not duplicate existing schema types', async () => {
    const html = await readFile(join(fixtures, 'good-page.html'), 'utf-8');
    const doc = parseHtml(html, 'test');
    const result = generateJsonLd(doc);

    // good-page.html already has Article, FAQPage, BreadcrumbList
    const types = result.map((r: any) => r['@type']);
    expect(types).not.toContain('Article');
    expect(types).not.toContain('FAQPage');
    expect(types).not.toContain('BreadcrumbList');
  });
});

describe('generateRobotsTxtSuggestions', () => {
  it('suggests all AI crawlers when no existing robots.txt', () => {
    const result = generateRobotsTxtSuggestions(null);
    const text = result.join('\n');

    expect(text).toContain('GPTBot');
    expect(text).toContain('ClaudeBot');
    expect(text).toContain('PerplexityBot');
    expect(text).toContain('Allow: /');
  });

  it('skips already configured crawlers', () => {
    const existing = 'User-agent: GPTBot\nAllow: /\n';
    const result = generateRobotsTxtSuggestions(existing);
    const text = result.join('\n');

    // GPTBot already configured, should not appear again
    const gptBotLines = result.filter((l) => l.includes('User-agent: GPTBot'));
    expect(gptBotLines.length).toBe(0);

    // Others should still appear
    expect(text).toContain('ClaudeBot');
  });
});
