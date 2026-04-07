import * as cheerio from 'cheerio';
import matter from 'gray-matter';
import { readFile, readdir, stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import type {
  ParsedDocument,
  JsonLdObject,
  Heading,
  Link,
  PageAnalysis,
  ScanReport,
  DimensionScores,
  ScanTarget,
  Issue,
  Suggestion,
  Dimension,
} from './types.js';
import { allRules } from './rules.js';

// ── Parsers ────────────────────────────────────────────────────────

export function parseHtml(html: string, url: string): ParsedDocument {
  const $ = cheerio.load(html);

  // Extract title
  const title = $('title').first().text().trim() || $('h1').first().text().trim() || url;

  // Extract headings
  const headings: Heading[] = [];
  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    const tag = (el as { tagName: string }).tagName;
    headings.push({
      level: parseInt(tag.charAt(1), 10),
      text: $(el).text().trim(),
    });
  });

  // Extract paragraphs (from p, li, dd, and direct text in div/section)
  const paragraphs: string[] = [];
  $('p, li, dd').each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 20) paragraphs.push(text);
  });

  // Extract JSON-LD
  const jsonLd: JsonLdObject[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const parsed = JSON.parse($(el).html() || '');
      if (Array.isArray(parsed)) {
        jsonLd.push(...parsed);
      } else {
        jsonLd.push(parsed);
      }
    } catch {
      // Ignore malformed JSON-LD
    }
  });

  // Extract meta tags
  const metaTags: Record<string, string> = {};
  $('meta').each((_, el) => {
    const name = $(el).attr('name') || $(el).attr('property') || '';
    const content = $(el).attr('content') || '';
    if (name && content) metaTags[name] = content;
  });

  // Extract links
  const links: Link[] = [];
  $('a').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim();
    const rel = $(el).attr('rel') || undefined;
    if (href) links.push({ href, text, rel });
  });

  // Extract raw text (content area preferred)
  const contentArea = $('main, article, [role="main"]').first();
  const rawText = (contentArea.length > 0 ? contentArea.text() : $('body').text()).replace(/\s+/g, ' ').trim();

  return {
    url,
    title,
    html,
    headings,
    paragraphs,
    jsonLd,
    metaTags,
    links,
    rawText,
  };
}

export function parseMarkdown(md: string, url: string): ParsedDocument {
  const { data: frontmatter, content } = matter(md);

  const title = (frontmatter.title as string) || '';

  // Extract headings from markdown
  const headings: Heading[] = [];
  const headingRegex = /^(#{1,6})\s+(.+)$/gm;
  let match: RegExpExecArray | null;
  while ((match = headingRegex.exec(content)) !== null) {
    headings.push({
      level: match[1].length,
      text: match[2].trim(),
    });
  }

  // Set title from first H1 if not in frontmatter
  const finalTitle = title || headings.find((h) => h.level === 1)?.text || url;

  // Extract paragraphs (non-empty lines that aren't headings, lists, or code blocks)
  const paragraphs: string[] = [];
  let inCodeBlock = false;
  const lines = content.split('\n');
  let currentParagraph = '';

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const trimmed = line.trim();
    if (trimmed === '') {
      if (currentParagraph.length > 0) {
        paragraphs.push(currentParagraph.trim());
        currentParagraph = '';
      }
    } else if (!trimmed.startsWith('#') && !trimmed.startsWith('-') && !trimmed.startsWith('*') && !trimmed.match(/^\d+\./)) {
      currentParagraph += ' ' + trimmed;
    }
  }
  if (currentParagraph.trim().length > 0) {
    paragraphs.push(currentParagraph.trim());
  }

  // Raw text (strip markdown syntax roughly)
  const rawText = content
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`]+`/g, '')
    .replace(/!\[.*?\]\(.*?\)/g, '')
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')
    .replace(/[#*_~`>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    url,
    title: finalTitle,
    markdown: md,
    frontmatter: frontmatter as Record<string, unknown>,
    headings,
    paragraphs,
    jsonLd: [],
    metaTags: {},
    links: [],
    rawText,
  };
}

// ── Scoring ────────────────────────────────────────────────────────

function aggregateScores(doc: ParsedDocument): { scores: DimensionScores; issues: Issue[]; suggestions: Suggestion[] } {
  const dimensionTotals: Record<Dimension, { score: number; maxScore: number }> = {
    structure: { score: 0, maxScore: 0 },
    citability: { score: 0, maxScore: 0 },
    schema: { score: 0, maxScore: 0 },
    aiMetadata: { score: 0, maxScore: 0 },
    contentDensity: { score: 0, maxScore: 0 },
  };

  const allIssues: Issue[] = [];
  const allSuggestions: Suggestion[] = [];

  for (const rule of allRules) {
    const result = rule.evaluate(doc);
    dimensionTotals[rule.dimension].score += result.score;
    dimensionTotals[rule.dimension].maxScore += result.maxScore;
    allIssues.push(...result.issues);
    allSuggestions.push(...result.suggestions);
  }

  // Derive dimension max points from actual rule weights (not hardcoded)
  const dimensionMaxPoints: Record<Dimension, number> = { structure: 0, citability: 0, schema: 0, aiMetadata: 0, contentDensity: 0 };
  for (const rule of allRules) {
    dimensionMaxPoints[rule.dimension] += rule.weight;
  }

  const scores: DimensionScores = {
    structure: 0,
    citability: 0,
    schema: 0,
    aiMetadata: 0,
    contentDensity: 0,
    total: 0,
  };

  for (const dim of Object.keys(dimensionTotals) as Dimension[]) {
    const { score, maxScore } = dimensionTotals[dim];
    scores[dim] = maxScore > 0 ? Math.round((score / maxScore) * dimensionMaxPoints[dim]) : 0;
  }

  scores.total = scores.structure + scores.citability + scores.schema + scores.aiMetadata + scores.contentDensity;

  return { scores, issues: allIssues, suggestions: allSuggestions };
}

// ── Public API ─────────────────────────────────────────────────────

export function scanDocument(doc: ParsedDocument): PageAnalysis {
  const { scores, issues, suggestions } = aggregateScores(doc);
  return {
    url: doc.url,
    title: doc.title,
    scores,
    issues,
    suggestions,
  };
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function scanFile(filePath: string): Promise<PageAnalysis> {
  const fileStats = await stat(filePath);
  if (fileStats.size > MAX_FILE_SIZE) {
    throw new Error(`File too large (${(fileStats.size / 1024 / 1024).toFixed(1)}MB). Maximum is 5MB.`);
  }
  const content = await readFile(filePath, 'utf-8');
  const ext = extname(filePath).toLowerCase();

  let doc: ParsedDocument;
  if (ext === '.html' || ext === '.htm') {
    doc = parseHtml(content, filePath);
  } else if (ext === '.md' || ext === '.mdx') {
    doc = parseMarkdown(content, filePath);
  } else {
    throw new Error(`Unsupported file type: ${ext}`);
  }

  return scanDocument(doc);
}

export async function scanDirectory(dirPath: string): Promise<ScanReport> {
  const pages: PageAnalysis[] = [];
  await walkDir(dirPath, pages);

  if (pages.length === 0) {
    return {
      pages: [],
      overall: { structure: 0, citability: 0, schema: 0, aiMetadata: 0, contentDensity: 0, total: 0 },
      summary: 'No HTML or Markdown files found in directory.',
      timestamp: new Date().toISOString(),
    };
  }

  const overall = averageScores(pages.map((p) => p.scores));
  const summary = generateSummary(overall, pages.length);

  return { pages, overall, summary, timestamp: new Date().toISOString() };
}

function validateUrl(raw: string): URL {
  const u = new URL(raw);
  if (u.protocol !== 'https:' && u.protocol !== 'http:') {
    throw new Error(`Unsupported scheme: ${u.protocol}. Only http and https are allowed.`);
  }
  const blocked = /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|::1$|localhost$)/i;
  if (blocked.test(u.hostname)) {
    throw new Error('Scanning private/loopback addresses is not allowed.');
  }
  return u;
}

async function checkLlmsTxt(url: string): Promise<boolean> {
  try {
    const u = new URL(url);
    const llmsUrl = `${u.protocol}//${u.host}/llms.txt`;
    const res = await fetch(llmsUrl, { method: 'HEAD', redirect: 'follow' });
    return res.ok;
  } catch {
    return false;
  }
}

export async function scanUrl(url: string): Promise<ScanReport> {
  validateUrl(url);
  const [response, hasLlmsTxt] = await Promise.all([
    fetch(url),
    checkLlmsTxt(url),
  ]);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
  }

  const html = await response.text();
  const doc = parseHtml(html, url);

  // Inject llms.txt discovery into metaTags so rules can pick it up
  if (hasLlmsTxt && !doc.metaTags['llms-txt']) {
    doc.metaTags['llms-txt'] = '/llms.txt';
  }

  const analysis = scanDocument(doc);

  return {
    pages: [analysis],
    overall: analysis.scores,
    summary: generateSummary(analysis.scores, 1),
    timestamp: new Date().toISOString(),
  };
}

export async function scan(target: ScanTarget): Promise<ScanReport> {
  switch (target.type) {
    case 'url':
      return scanUrl(target.path);
    case 'file': {
      const analysis = await scanFile(target.path);
      return {
        pages: [analysis],
        overall: analysis.scores,
        summary: generateSummary(analysis.scores, 1),
        timestamp: new Date().toISOString(),
      };
    }
    case 'directory':
      return scanDirectory(target.path);
  }
}

// ── Helpers ────────────────────────────────────────────────────────

async function walkDir(dirPath: string, pages: PageAnalysis[]): Promise<void> {
  const entries = await readdir(dirPath);

  for (const entry of entries) {
    const fullPath = join(dirPath, entry);
    const stats = await stat(fullPath);

    if (stats.isDirectory()) {
      if (entry.startsWith('.') || entry === 'node_modules') continue;
      await walkDir(fullPath, pages);
    } else {
      const ext = extname(entry).toLowerCase();
      if (['.html', '.htm', '.md', '.mdx'].includes(ext)) {
        try {
          const analysis = await scanFile(fullPath);
          pages.push(analysis);
        } catch {
          // Skip files that can't be parsed
        }
      }
    }
  }
}

function averageScores(scores: DimensionScores[]): DimensionScores {
  const avg: DimensionScores = { structure: 0, citability: 0, schema: 0, aiMetadata: 0, contentDensity: 0, total: 0 };
  const dims: (keyof DimensionScores)[] = ['structure', 'citability', 'schema', 'aiMetadata', 'contentDensity'];

  for (const dim of dims) {
    avg[dim] = Math.round(scores.reduce((sum, s) => sum + s[dim], 0) / scores.length);
  }
  avg.total = avg.structure + avg.citability + avg.schema + avg.aiMetadata + avg.contentDensity;

  return avg;
}

function generateSummary(scores: DimensionScores, pageCount: number): string {
  const grade = scores.total >= 80 ? 'Excellent' : scores.total >= 60 ? 'Good' : scores.total >= 40 ? 'Needs Work' : 'Poor';
  return `AI Readability: ${grade} (${scores.total}/100) across ${pageCount} page${pageCount > 1 ? 's' : ''}`;
}
