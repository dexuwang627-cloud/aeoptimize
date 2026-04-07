import type { ScoringRule, ParsedDocument, RuleResult, Issue, Suggestion } from './types.js';

// ── Structure Rules (25 pts) ───────────────────────────────────────

const headingHierarchy: ScoringRule = {
  id: 'heading-hierarchy',
  dimension: 'structure',
  weight: 8,
  evaluate(doc: ParsedDocument): RuleResult {
    const issues: Issue[] = [];
    const suggestions: Suggestion[] = [];
    const { headings } = doc;

    if (headings.length === 0) {
      issues.push({
        dimension: 'structure',
        severity: 'critical',
        message: 'No headings found. AI engines rely on heading structure to understand content hierarchy.',
      });
      return { score: 0, maxScore: 8, issues, suggestions };
    }

    let score = 8;

    // Check for single H1
    const h1s = headings.filter((h) => h.level === 1);
    if (h1s.length === 0) {
      score -= 3;
      issues.push({
        dimension: 'structure',
        severity: 'warning',
        message: 'No H1 heading found. Every page should have exactly one H1.',
      });
    } else if (h1s.length > 1) {
      score -= 2;
      issues.push({
        dimension: 'structure',
        severity: 'warning',
        message: `Found ${h1s.length} H1 headings. Use exactly one H1 per page.`,
      });
    }

    // Check for skipped levels (e.g., H1 -> H3)
    let skipCount = 0;
    for (let i = 1; i < headings.length; i++) {
      const prev = headings[i - 1].level;
      const curr = headings[i].level;
      if (curr > prev + 1) {
        skipCount++;
        if (skipCount <= 3) {
          issues.push({
            dimension: 'structure',
            severity: 'warning',
            message: `Heading level skipped: H${prev} → H${curr}. This confuses AI content parsing.`,
          });
        }
      }
    }
    if (skipCount > 0) score -= Math.min(3, skipCount);

    // Check heading count relative to content
    const wordCount = doc.rawText.split(/\s+/).length;
    if (wordCount > 500 && headings.length < 3) {
      score -= 1;
      suggestions.push({
        dimension: 'structure',
        action: 'Add more headings to break up long content',
        impact: 'medium',
        detail: `${wordCount} words with only ${headings.length} headings. Aim for one heading per 200-300 words.`,
      });
    }

    return { score: Math.max(0, score), maxScore: 8, issues, suggestions };
  },
};

const paragraphLength: ScoringRule = {
  id: 'paragraph-length',
  dimension: 'structure',
  weight: 7,
  evaluate(doc: ParsedDocument): RuleResult {
    const issues: Issue[] = [];
    const suggestions: Suggestion[] = [];
    const { paragraphs } = doc;

    if (paragraphs.length === 0) {
      return { score: 0, maxScore: 7, issues: [{ dimension: 'structure', severity: 'warning', message: 'No paragraphs detected.' }], suggestions };
    }

    const longParagraphs = paragraphs.filter((p) => p.split(/\s+/).length > 150);
    const ratio = longParagraphs.length / paragraphs.length;

    let score = 7;
    if (ratio > 0.5) {
      score -= 5;
      issues.push({
        dimension: 'structure',
        severity: 'critical',
        message: `${longParagraphs.length}/${paragraphs.length} paragraphs exceed 150 words. LLMs struggle to extract citable quotes from long paragraphs.`,
      });
    } else if (ratio > 0.2) {
      score -= 3;
      issues.push({
        dimension: 'structure',
        severity: 'warning',
        message: `${longParagraphs.length} paragraphs exceed 150 words. Split them for better AI citability.`,
      });
    }

    if (longParagraphs.length > 0) {
      suggestions.push({
        dimension: 'structure',
        action: 'Split long paragraphs into self-contained statements',
        impact: 'high',
        detail: 'Ideal paragraph length for AI extraction: 40-80 words. Each paragraph should express one complete idea.',
      });
    }

    return { score: Math.max(0, score), maxScore: 7, issues, suggestions };
  },
};

const faqPresence: ScoringRule = {
  id: 'faq-presence',
  dimension: 'structure',
  weight: 5,
  evaluate(doc: ParsedDocument): RuleResult {
    const issues: Issue[] = [];
    const suggestions: Suggestion[] = [];

    const hasFaqHeading = doc.headings.some((h) => /faq|frequently asked|common questions/i.test(h.text));
    const hasFaqSchema = doc.jsonLd.some((ld: any) => ld['@type'] === 'FAQPage');
    const hasQuestionHeadings = doc.headings.filter((h) => h.text.endsWith('?')).length >= 2;

    let score = 0;
    if (hasFaqSchema) score += 3;
    if (hasFaqHeading || hasQuestionHeadings) score += 2;

    if (score === 0) {
      suggestions.push({
        dimension: 'structure',
        action: 'Add FAQ section with question-format headings',
        impact: 'high',
        detail: 'FAQ sections are highly cited by AI search engines. Structure as H2/H3 questions with concise answers.',
      });
    } else if (!hasFaqSchema && (hasFaqHeading || hasQuestionHeadings)) {
      suggestions.push({
        dimension: 'structure',
        action: 'Add FAQPage JSON-LD schema for existing FAQ content',
        impact: 'medium',
        detail: 'You have FAQ-like content but no FAQPage schema markup.',
      });
    }

    return { score: Math.min(5, score), maxScore: 5, issues, suggestions };
  },
};

const listUsage: ScoringRule = {
  id: 'list-usage',
  dimension: 'structure',
  weight: 5,
  evaluate(doc: ParsedDocument): RuleResult {
    const suggestions: Suggestion[] = [];

    // Check for list-like patterns in raw text
    const hasLists = /(?:<[ou]l>|^[-*]\s|^\d+\.\s)/m.test(doc.html || doc.markdown || '');
    const wordCount = doc.rawText.split(/\s+/).length;

    let score = 5;
    if (!hasLists && wordCount > 300) {
      score = 2;
      suggestions.push({
        dimension: 'structure',
        action: 'Add bullet or numbered lists for scannable content',
        impact: 'low',
        detail: 'Lists help AI engines extract key points. Convert sequences or steps into structured lists.',
      });
    }

    return { score, maxScore: 5, issues: [], suggestions };
  },
};

// ── Citability Rules (25 pts) ──────────────────────────────────────

const selfContainedStatements: ScoringRule = {
  id: 'self-contained-statements',
  dimension: 'citability',
  weight: 8,
  evaluate(doc: ParsedDocument): RuleResult {
    const issues: Issue[] = [];
    const suggestions: Suggestion[] = [];

    if (doc.paragraphs.length === 0) {
      return { score: 0, maxScore: 8, issues, suggestions };
    }

    // Heuristic: paragraphs starting with pronouns or relative references are not self-contained
    // Only flag strong dangling references (pronouns/demonstratives), not conjunctions
    const danglingStarts = /^(this|that|these|those|it|they|he|she|however|moreover|furthermore|additionally)\b/i;
    const danglingParagraphs = doc.paragraphs.filter((p) => danglingStarts.test(p.trim()));
    const ratio = danglingParagraphs.length / doc.paragraphs.length;

    let score = 8;
    if (ratio > 0.4) {
      score -= 5;
      issues.push({
        dimension: 'citability',
        severity: 'warning',
        message: `${danglingParagraphs.length}/${doc.paragraphs.length} paragraphs start with pronouns or conjunctions, making them hard to cite in isolation.`,
      });
    } else if (ratio > 0.2) {
      score -= 3;
    }

    if (danglingParagraphs.length > 0) {
      suggestions.push({
        dimension: 'citability',
        action: 'Rewrite paragraphs to be self-contained',
        impact: 'high',
        detail: 'Each paragraph should make sense without reading the previous one. Replace "This feature..." with "[Product name] feature...".',
      });
    }

    return { score: Math.max(0, score), maxScore: 8, issues, suggestions };
  },
};

const dataStatsPresence: ScoringRule = {
  id: 'data-stats-presence',
  dimension: 'citability',
  weight: 7,
  evaluate(doc: ParsedDocument): RuleResult {
    const suggestions: Suggestion[] = [];

    // Look for numbers, percentages, dates, monetary values
    const dataPatterns = /(\d+%|\$[\d,.]+|€[\d,.]+|\d{4}[-/]\d{2}[-/]\d{2}|\d+\s*(users|customers|companies|countries|years|months|hours|minutes|seconds|ms|GB|MB|TB|requests|transactions))/gi;
    const matches = doc.rawText.match(dataPatterns) || [];

    const wordCount = doc.rawText.split(/\s+/).length;
    const dataPerKWords = (matches.length / wordCount) * 1000;

    let score: number;
    if (dataPerKWords >= 3) {
      score = 7;
    } else if (dataPerKWords >= 1) {
      score = 5;
    } else if (matches.length > 0) {
      score = 3;
    } else {
      score = 1;
      suggestions.push({
        dimension: 'citability',
        action: 'Add specific data points, statistics, or metrics',
        impact: 'high',
        detail: 'AI engines strongly prefer content with concrete numbers. Add dates, percentages, counts, or benchmarks.',
      });
    }

    return { score, maxScore: 7, issues: [], suggestions };
  },
};

const clearDefinitions: ScoringRule = {
  id: 'clear-definitions',
  dimension: 'citability',
  weight: 5,
  evaluate(doc: ParsedDocument): RuleResult {
    const suggestions: Suggestion[] = [];

    // Look for "X is Y" patterns, definition lists
    const definitionPatterns = /\b\w+\s+(?:is|are|refers to|means|defines?|defined as)\s+/gi;
    const matches = doc.rawText.match(definitionPatterns) || [];

    const hasDlElements = /<dl/i.test(doc.html || '');

    let score = 0;
    if (matches.length >= 3 || hasDlElements) score = 5;
    else if (matches.length >= 1) score = 3;
    else {
      score = 1;
      suggestions.push({
        dimension: 'citability',
        action: 'Add clear definitions for key terms',
        impact: 'medium',
        detail: 'Use "X is Y" pattern to define concepts. AI engines often extract these as featured snippets.',
      });
    }

    return { score, maxScore: 5, issues: [], suggestions };
  },
};

const attribution: ScoringRule = {
  id: 'attribution',
  dimension: 'citability',
  weight: 5,
  evaluate(doc: ParsedDocument): RuleResult {
    const issues: Issue[] = [];
    const suggestions: Suggestion[] = [];

    let score = 0;

    // Check for author metadata
    const hasAuthor = doc.metaTags['author'] || doc.metaTags['article:author'] || doc.jsonLd.some((ld: any) => ld.author);
    if (hasAuthor) score += 2;

    // Check for date
    const hasDate = doc.metaTags['article:published_time'] || doc.metaTags['date'] || doc.jsonLd.some((ld: any) => ld.datePublished);
    if (hasDate) score += 2;

    // Check for source citations in content
    const hasCitations = /(?:according to|source:|cited from|reference:|via\s)/i.test(doc.rawText);
    if (hasCitations) score += 1;

    if (score < 3) {
      suggestions.push({
        dimension: 'citability',
        action: 'Add author and publication date metadata',
        impact: 'medium',
        detail: 'AI engines weigh attributed content higher. Add meta author, published date, and source citations.',
      });
    }

    return { score: Math.min(5, score), maxScore: 5, issues, suggestions };
  },
};

// ── Schema Rules (20 pts) ──────────────────────────────────────────

const jsonLdPresence: ScoringRule = {
  id: 'json-ld-presence',
  dimension: 'schema',
  weight: 6,
  evaluate(doc: ParsedDocument): RuleResult {
    const issues: Issue[] = [];

    if (doc.jsonLd.length === 0) {
      issues.push({
        dimension: 'schema',
        severity: 'critical',
        message: 'No JSON-LD structured data found. AI engines rely heavily on structured data to understand content.',
      });
      return { score: 0, maxScore: 6, issues, suggestions: [] };
    }

    return { score: 6, maxScore: 6, issues, suggestions: [] };
  },
};

const jsonLdCompleteness: ScoringRule = {
  id: 'json-ld-completeness',
  dimension: 'schema',
  weight: 7,
  evaluate(doc: ParsedDocument): RuleResult {
    const issues: Issue[] = [];
    const suggestions: Suggestion[] = [];

    if (doc.jsonLd.length === 0) {
      return { score: 0, maxScore: 7, issues, suggestions };
    }

    const requiredFields = ['@type', 'name', 'description'];
    let totalScore = 0;
    let checked = 0;

    for (const ld of doc.jsonLd) {
      checked++;
      const obj = ld as Record<string, unknown>;
      const missing = requiredFields.filter((f) => !obj[f]);

      if (missing.length === 0) {
        totalScore += 7;
      } else {
        totalScore += Math.max(0, 7 - missing.length * 2);
        issues.push({
          dimension: 'schema',
          severity: 'warning',
          message: `JSON-LD (${obj['@type'] || 'unknown'}) missing fields: ${missing.join(', ')}`,
        });
      }
    }

    const score = Math.round(totalScore / checked);

    // Check for author/datePublished on Article types
    const articles = doc.jsonLd.filter((ld: any) => /article/i.test(ld['@type'] || ''));
    for (const article of articles) {
      const obj = article as Record<string, unknown>;
      if (!obj.author) {
        suggestions.push({
          dimension: 'schema',
          action: 'Add author field to Article schema',
          impact: 'medium',
          detail: 'Articles with author attribution are more likely to be cited by AI.',
        });
      }
      if (!obj.datePublished) {
        suggestions.push({
          dimension: 'schema',
          action: 'Add datePublished to Article schema',
          impact: 'medium',
          detail: 'AI engines prefer content with clear publication dates.',
        });
      }
    }

    return { score: Math.min(7, score), maxScore: 7, issues, suggestions };
  },
};

const aiRelevantSchemaTypes: ScoringRule = {
  id: 'ai-relevant-schema-types',
  dimension: 'schema',
  weight: 7,
  evaluate(doc: ParsedDocument): RuleResult {
    const suggestions: Suggestion[] = [];

    const aiRelevantTypes = ['Article', 'FAQPage', 'HowTo', 'Product', 'Organization', 'BreadcrumbList', 'WebPage', 'TechArticle'];
    const foundTypes = new Set(doc.jsonLd.map((ld: any) => ld['@type']).filter(Boolean));
    const relevantFound = aiRelevantTypes.filter((t) => foundTypes.has(t));

    let score: number;
    if (relevantFound.length >= 3) {
      score = 7;
    } else if (relevantFound.length >= 2) {
      score = 5;
    } else if (relevantFound.length === 1) {
      score = 3;
    } else {
      score = 0;
      suggestions.push({
        dimension: 'schema',
        action: 'Add AI-relevant schema types',
        impact: 'high',
        detail: `Consider adding: ${aiRelevantTypes.slice(0, 4).join(', ')}. These types are most frequently extracted by AI search engines.`,
      });
    }

    return { score, maxScore: 7, issues: [], suggestions };
  },
};

// ── AI Metadata Rules (15 pts) ─────────────────────────────────────

const llmsTxtPresence: ScoringRule = {
  id: 'llms-txt-presence',
  dimension: 'aiMetadata',
  weight: 5,
  evaluate(doc: ParsedDocument): RuleResult {
    const suggestions: Suggestion[] = [];

    // For now, check meta tags for llms.txt reference or if the doc itself is llms.txt
    const hasLlmsTxtMeta = !!doc.metaTags['llms-txt'] || doc.links.some((l) => /llms\.txt/i.test(l.href));

    if (!hasLlmsTxtMeta) {
      suggestions.push({
        dimension: 'aiMetadata',
        action: 'Create and link an llms.txt file',
        impact: 'high',
        detail: 'llms.txt is the emerging standard for making your site AI-readable. Use `aeo generate` to create one.',
      });
      return { score: 0, maxScore: 5, issues: [], suggestions };
    }

    return { score: 5, maxScore: 5, issues: [], suggestions };
  },
};

const robotsTxtAiConfig: ScoringRule = {
  id: 'robots-txt-ai-config',
  dimension: 'aiMetadata',
  weight: 5,
  evaluate(doc: ParsedDocument): RuleResult {
    const suggestions: Suggestion[] = [];

    // This rule checks meta robots and hints; actual robots.txt checking is done at directory/URL level
    const robotsMeta = doc.metaTags['robots'] || '';
    const hasNoindex = /noindex/i.test(robotsMeta);

    if (hasNoindex) {
      return {
        score: 0,
        maxScore: 5,
        issues: [{
          dimension: 'aiMetadata',
          severity: 'critical',
          message: 'Page has noindex meta tag. AI crawlers will skip this page.',
        }],
        suggestions,
      };
    }

    // Give partial credit — full robots.txt analysis requires directory-level scan
    suggestions.push({
      dimension: 'aiMetadata',
      action: 'Configure robots.txt with explicit AI crawler rules',
      impact: 'medium',
      detail: 'Add rules for GPTBot, ClaudeBot, PerplexityBot, Google-Extended to control AI crawler access.',
    });

    return { score: 3, maxScore: 5, issues: [], suggestions };
  },
};

const metaDescriptionQuality: ScoringRule = {
  id: 'meta-description-quality',
  dimension: 'aiMetadata',
  weight: 5,
  evaluate(doc: ParsedDocument): RuleResult {
    const issues: Issue[] = [];
    const suggestions: Suggestion[] = [];

    const desc = doc.metaTags['description'] || doc.metaTags['og:description'] || '';

    if (!desc) {
      issues.push({
        dimension: 'aiMetadata',
        severity: 'warning',
        message: 'No meta description found. AI engines use this as a primary content summary.',
      });
      return { score: 0, maxScore: 5, issues, suggestions };
    }

    let score = 3;

    // Check length
    if (desc.length >= 50 && desc.length <= 160) {
      score += 2;
    } else if (desc.length < 50) {
      score += 0;
      suggestions.push({
        dimension: 'aiMetadata',
        action: 'Expand meta description to 50-160 characters',
        impact: 'low',
        detail: `Current length: ${desc.length} characters. Too short for AI to use as summary.`,
      });
    } else {
      score += 1;
      suggestions.push({
        dimension: 'aiMetadata',
        action: 'Shorten meta description to under 160 characters',
        impact: 'low',
        detail: `Current length: ${desc.length} characters. May be truncated by AI engines.`,
      });
    }

    return { score, maxScore: 5, issues, suggestions };
  },
};

// ── Content Density Rules (15 pts) ─────────────────────────────────

const contentBoilerplateRatio: ScoringRule = {
  id: 'content-boilerplate-ratio',
  dimension: 'contentDensity',
  weight: 5,
  evaluate(doc: ParsedDocument): RuleResult {
    const suggestions: Suggestion[] = [];

    // Simple heuristic: ratio of paragraph text to total text
    const paragraphText = doc.paragraphs.join(' ');
    const paragraphWords = paragraphText.split(/\s+/).filter(Boolean).length;
    const totalWords = doc.rawText.split(/\s+/).filter(Boolean).length;

    if (totalWords === 0) {
      return { score: 0, maxScore: 5, issues: [{ dimension: 'contentDensity', severity: 'warning', message: 'No text content found.' }], suggestions };
    }

    const ratio = paragraphWords / totalWords;

    let score: number;
    if (ratio >= 0.6) {
      score = 5;
    } else if (ratio >= 0.4) {
      score = 3;
    } else {
      score = 1;
      suggestions.push({
        dimension: 'contentDensity',
        action: 'Increase content-to-boilerplate ratio',
        impact: 'medium',
        detail: `Only ${Math.round(ratio * 100)}% of page text is in content paragraphs. Use semantic HTML (<main>, <article>) to help AI identify primary content.`,
      });
    }

    return { score, maxScore: 5, issues: [], suggestions };
  },
};

const keywordStuffingDetection: ScoringRule = {
  id: 'keyword-stuffing-detection',
  dimension: 'contentDensity',
  weight: 5,
  evaluate(doc: ParsedDocument): RuleResult {
    const issues: Issue[] = [];
    const suggestions: Suggestion[] = [];

    const words = doc.rawText.toLowerCase().split(/\s+/).filter((w) => w.length > 1);
    if (words.length < 50) {
      return { score: 5, maxScore: 5, issues, suggestions };
    }

    // Count word frequency, excluding common stop words
    const stopWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'has', 'his', 'how', 'its', 'may', 'new', 'now', 'old', 'see', 'way', 'who', 'did', 'get', 'let', 'say', 'she', 'too', 'use', 'that', 'this', 'with', 'from', 'have', 'been', 'they', 'their', 'will', 'would', 'could', 'should', 'about', 'which', 'when', 'what', 'there', 'where', 'your', 'more', 'some', 'than', 'them', 'into', 'other', 'also', 'just', 'only', 'very', 'does', 'each']);
    const freq = new Map<string, number>();

    for (const word of words) {
      if (stopWords.has(word)) continue;
      freq.set(word, (freq.get(word) || 0) + 1);
    }

    const threshold = words.length * 0.03; // 3%
    const stuffed = [...freq.entries()].filter(([, count]) => count > threshold).sort((a, b) => b[1] - a[1]);

    if (stuffed.length > 0) {
      const topStuffed = stuffed.slice(0, 3).map(([word, count]) => `"${word}" (${((count / words.length) * 100).toFixed(1)}%)`);
      issues.push({
        dimension: 'contentDensity',
        severity: 'warning',
        message: `Potential keyword stuffing: ${topStuffed.join(', ')}. AI engines penalize repetitive content.`,
      });
      return { score: 1, maxScore: 5, issues, suggestions: [{ dimension: 'contentDensity', action: 'Reduce keyword repetition', impact: 'high', detail: 'Use synonyms and natural language variation instead of repeating the same terms.' }] };
    }

    return { score: 5, maxScore: 5, issues, suggestions };
  },
};

const contentUniquenessSignals: ScoringRule = {
  id: 'content-uniqueness-signals',
  dimension: 'contentDensity',
  weight: 5,
  evaluate(doc: ParsedDocument): RuleResult {
    const suggestions: Suggestion[] = [];

    let score = 2; // Base score

    // Check for original data indicators
    const hasOriginalData = /(?:our\s+(?:data|research|analysis|survey|study)|we\s+(?:found|discovered|measured|tested|analyzed))/i.test(doc.rawText);
    if (hasOriginalData) score += 2;

    // Check for code examples
    const hasCode = /<code|<pre|```/i.test(doc.html || doc.markdown || '');
    if (hasCode) score += 1;

    if (score < 4) {
      suggestions.push({
        dimension: 'contentDensity',
        action: 'Add original data, examples, or unique insights',
        impact: 'medium',
        detail: 'AI engines prefer content with original research, unique data points, or practical examples over generic information.',
      });
    }

    return { score: Math.min(5, score), maxScore: 5, issues: [], suggestions };
  },
};

// ── Export all rules ───────────────────────────────────────────────

export const allRules: ScoringRule[] = [
  // Structure (25 pts)
  headingHierarchy,
  paragraphLength,
  faqPresence,
  listUsage,
  // Citability (25 pts)
  selfContainedStatements,
  dataStatsPresence,
  clearDefinitions,
  attribution,
  // Schema (20 pts)
  jsonLdPresence,
  jsonLdCompleteness,
  aiRelevantSchemaTypes,
  // AI Metadata (15 pts)
  llmsTxtPresence,
  robotsTxtAiConfig,
  metaDescriptionQuality,
  // Content Density (15 pts)
  contentBoilerplateRatio,
  keywordStuffingDetection,
  contentUniquenessSignals,
];

export function getRulesByDimension(dimension: string): ScoringRule[] {
  return allRules.filter((r) => r.dimension === dimension);
}
