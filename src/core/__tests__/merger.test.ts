import { describe, it, expect } from 'vitest';
import { mergeScores, averageAiDimensions } from '../merger.js';
import type { ScanReport, AiScorerResult, DimensionScores } from '../types.js';

const mockDimensions: DimensionScores = { structure: 18, citability: 16, schema: 7, aiMetadata: 8, contentDensity: 12, total: 61 };

const mockReport: ScanReport = {
  pages: [{
    url: 'https://example.com',
    title: 'Test',
    scores: mockDimensions,
    issues: [],
    suggestions: [],
  }],
  overall: mockDimensions,
  summary: 'Good (61/100)',
  timestamp: '2026-04-07T00:00:00Z',
};

function makeAiScore(source: 'gemini' | 'copilot', score: number, available = true): AiScorerResult {
  return {
    source,
    score,
    dimensions: { structure: 20, citability: 20, schema: 15, aiMetadata: 12, contentDensity: 13, total: score },
    insight: `${source} insight`,
    available,
  };
}

describe('mergeScores', () => {
  it('uses rule engine only when no AI scores', () => {
    const result = mergeScores(mockReport, []);
    expect(result.consensusScore).toBe(61);
    expect(result.ruleScore).toBe(61);
    expect(result.methodology).toContain('Rule engine only');
  });

  it('uses 60/40 weighting with one AI', () => {
    const result = mergeScores(mockReport, [makeAiScore('gemini', 80)]);
    // 61 * 0.6 + 80 * 0.4 = 36.6 + 32 = 68.6 → 69
    expect(result.consensusScore).toBe(69);
    expect(result.methodology).toContain('60%');
    expect(result.methodology).toContain('gemini');
  });

  it('uses 50/50 weighting with multiple AIs', () => {
    const result = mergeScores(mockReport, [makeAiScore('gemini', 80), makeAiScore('copilot', 90)]);
    // AI avg = 85, rule = 61
    // 61 * 0.5 + 85 * 0.5 = 30.5 + 42.5 = 73
    expect(result.consensusScore).toBe(73);
    expect(result.methodology).toContain('50%');
  });

  it('ignores unavailable AI scores', () => {
    const result = mergeScores(mockReport, [makeAiScore('gemini', 80, false)]);
    expect(result.consensusScore).toBe(61);
    expect(result.methodology).toContain('Rule engine only');
  });

  it('preserves aiScores array in output', () => {
    const scores = [makeAiScore('gemini', 80)];
    const result = mergeScores(mockReport, scores);
    expect(result.aiScores).toEqual(scores);
  });
});

describe('averageAiDimensions', () => {
  it('averages dimensions across available AIs', () => {
    const scores = [
      makeAiScore('gemini', 80),
      makeAiScore('copilot', 90),
    ];
    const avg = averageAiDimensions(scores);
    expect(avg).not.toBeNull();
    expect(avg!.structure).toBe(20);
  });

  it('returns null when no available AIs', () => {
    expect(averageAiDimensions([])).toBeNull();
    expect(averageAiDimensions([makeAiScore('gemini', 0, false)])).toBeNull();
  });
});
