import { describe, it, expect } from 'vitest';
import { allRules, getRulesByDimension } from '../rules.js';
import type { ParsedDocument } from '../types.js';

function makeDoc(overrides: Partial<ParsedDocument> = {}): ParsedDocument {
  return {
    url: 'test',
    title: 'Test Page',
    headings: [],
    paragraphs: [],
    jsonLd: [],
    metaTags: {},
    links: [],
    rawText: '',
    ...overrides,
  };
}

describe('allRules', () => {
  it('has rules for all five dimensions', () => {
    const dimensions = new Set(allRules.map((r) => r.dimension));
    expect(dimensions).toContain('structure');
    expect(dimensions).toContain('citability');
    expect(dimensions).toContain('schema');
    expect(dimensions).toContain('aiMetadata');
    expect(dimensions).toContain('contentDensity');
  });

  it('total max points sum to 100', () => {
    const total = allRules.reduce((sum, r) => sum + r.weight, 0);
    expect(total).toBe(100);
  });
});

describe('getRulesByDimension', () => {
  it('returns only rules for the specified dimension', () => {
    const structureRules = getRulesByDimension('structure');
    expect(structureRules.length).toBeGreaterThan(0);
    expect(structureRules.every((r) => r.dimension === 'structure')).toBe(true);
  });
});

describe('heading-hierarchy', () => {
  const rule = allRules.find((r) => r.id === 'heading-hierarchy')!;

  it('gives full score for proper hierarchy', () => {
    const doc = makeDoc({
      headings: [
        { level: 1, text: 'Title' },
        { level: 2, text: 'Section' },
        { level: 3, text: 'Subsection' },
      ],
      rawText: 'enough words '.repeat(50),
    });
    const result = rule.evaluate(doc);
    expect(result.score).toBe(result.maxScore);
  });

  it('penalizes missing H1', () => {
    const doc = makeDoc({
      headings: [{ level: 2, text: 'Section' }],
      rawText: 'test',
    });
    const result = rule.evaluate(doc);
    expect(result.score).toBeLessThan(result.maxScore);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('penalizes skipped heading levels', () => {
    const doc = makeDoc({
      headings: [
        { level: 1, text: 'Title' },
        { level: 3, text: 'Skipped H2' },
      ],
      rawText: 'test',
    });
    const result = rule.evaluate(doc);
    expect(result.score).toBeLessThan(result.maxScore);
  });

  it('returns zero for no headings', () => {
    const result = rule.evaluate(makeDoc());
    expect(result.score).toBe(0);
  });
});

describe('paragraph-length', () => {
  const rule = allRules.find((r) => r.id === 'paragraph-length')!;

  it('gives full score for short paragraphs', () => {
    const doc = makeDoc({
      paragraphs: ['Short paragraph one.', 'Short paragraph two.', 'Short paragraph three.'],
    });
    const result = rule.evaluate(doc);
    expect(result.score).toBe(result.maxScore);
  });

  it('penalizes long paragraphs', () => {
    const longText = 'word '.repeat(200);
    const doc = makeDoc({ paragraphs: [longText, longText, longText] });
    const result = rule.evaluate(doc);
    expect(result.score).toBeLessThan(result.maxScore);
    expect(result.issues.length).toBeGreaterThan(0);
  });
});

describe('keyword-stuffing-detection', () => {
  const rule = allRules.find((r) => r.id === 'keyword-stuffing-detection')!;

  it('detects keyword stuffing', () => {
    // Use non-topic words that repeat excessively (>5%)
    const stuffed = ('optimization tips optimization guide optimization strategy optimization tools optimization ranking ' +
      'optimization experts optimization methods optimization performance optimization results optimization campaigns ').repeat(5);
    const doc = makeDoc({ rawText: stuffed });
    const result = rule.evaluate(doc);
    expect(result.score).toBeLessThan(result.maxScore);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it('passes natural content', () => {
    const natural = 'The quick brown fox jumps over the lazy dog. ' +
      'Search engine optimization involves many different techniques. ' +
      'Content quality matters more than keyword density in modern algorithms. ' +
      'Users prefer websites that provide genuine value and clear information. ' +
      'The best approach combines technical excellence with compelling writing.';
    const doc = makeDoc({ rawText: natural.repeat(3) });
    const result = rule.evaluate(doc);
    expect(result.score).toBe(result.maxScore);
  });
});

describe('json-ld-presence', () => {
  const rule = allRules.find((r) => r.id === 'json-ld-presence')!;

  it('gives full score when JSON-LD exists', () => {
    const doc = makeDoc({ jsonLd: [{ '@type': 'Article', name: 'Test' }] });
    const result = rule.evaluate(doc);
    expect(result.score).toBe(result.maxScore);
  });

  it('gives zero when no JSON-LD', () => {
    const result = rule.evaluate(makeDoc());
    expect(result.score).toBe(0);
    expect(result.issues[0].severity).toBe('critical');
  });
});

describe('self-contained-statements', () => {
  const rule = allRules.find((r) => r.id === 'self-contained-statements')!;

  it('gives full score for self-contained paragraphs', () => {
    const doc = makeDoc({
      paragraphs: [
        'AEO stands for Answer Engine Optimization.',
        'The practice focuses on AI search readiness.',
        'Structured data improves AI citation rates.',
      ],
    });
    const result = rule.evaluate(doc);
    expect(result.score).toBe(result.maxScore);
  });

  it('penalizes paragraphs starting with pronouns', () => {
    const doc = makeDoc({
      paragraphs: [
        'This is important.',
        'However, it depends.',
        'They also recommend.',
        'Furthermore, these changes.',
        'But results vary.',
      ],
    });
    const result = rule.evaluate(doc);
    expect(result.score).toBeLessThan(result.maxScore);
  });
});

describe('meta-description-quality', () => {
  const rule = allRules.find((r) => r.id === 'meta-description-quality')!;

  it('gives full score for good meta description', () => {
    const doc = makeDoc({
      metaTags: { description: 'AEO is the practice of optimizing content for AI search engines. Learn strategies for better AI citations.' },
    });
    const result = rule.evaluate(doc);
    expect(result.score).toBe(result.maxScore);
  });

  it('penalizes missing meta description', () => {
    const result = rule.evaluate(makeDoc());
    expect(result.score).toBe(0);
  });

  it('penalizes too-short meta description', () => {
    const doc = makeDoc({ metaTags: { description: 'Short.' } });
    const result = rule.evaluate(doc);
    expect(result.score).toBeLessThan(result.maxScore);
  });
});
