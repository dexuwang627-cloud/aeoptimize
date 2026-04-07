export type Dimension =
  | 'structure'
  | 'citability'
  | 'schema'
  | 'aiMetadata'
  | 'contentDensity';

export interface DimensionScores {
  structure: number;
  citability: number;
  schema: number;
  aiMetadata: number;
  contentDensity: number;
  total: number;
}

export type Severity = 'critical' | 'warning' | 'info';
export type Impact = 'high' | 'medium' | 'low';

export interface Issue {
  dimension: Dimension;
  severity: Severity;
  message: string;
  selector?: string;
  line?: number;
}

export interface Suggestion {
  dimension: Dimension;
  action: string;
  impact: Impact;
  detail: string;
}

export interface ScanTarget {
  type: 'url' | 'file' | 'directory';
  path: string;
}

export interface Heading {
  level: number;
  text: string;
}

export interface Link {
  href: string;
  text: string;
  rel?: string;
}

export interface ParsedDocument {
  url: string;
  title: string;
  html?: string;
  markdown?: string;
  frontmatter?: Record<string, unknown>;
  headings: Heading[];
  paragraphs: string[];
  jsonLd: object[];
  metaTags: Record<string, string>;
  links: Link[];
  rawText: string;
}

export interface RuleResult {
  score: number;
  maxScore: number;
  issues: Issue[];
  suggestions: Suggestion[];
}

export interface ScoringRule {
  id: string;
  dimension: Dimension;
  weight: number;
  evaluate: (doc: ParsedDocument) => RuleResult;
}

export interface PageAnalysis {
  url: string;
  title: string;
  scores: DimensionScores;
  issues: Issue[];
  suggestions: Suggestion[];
}

export interface ScanReport {
  pages: PageAnalysis[];
  overall: DimensionScores;
  summary: string;
  timestamp: string;
}

export interface SiteInfo {
  name: string;
  description: string;
  baseUrl: string;
  language?: string;
}

export interface GenerateOutput {
  llmsTxt: string;
  llmsFullTxt: string;
  jsonLd: object[];
  robotsTxtSuggestions: string[];
}

// ── Multi-AI Scoring ───────────────────────────────────────────────

export type AiSource = 'claude' | 'gemini' | 'copilot';

export interface AiScorerResult {
  source: AiSource;
  score: number;
  dimensions: DimensionScores;
  insight: string;
  available: boolean;
}

export interface MultiAiReport extends ScanReport {
  ruleScore: number;
  aiScores: AiScorerResult[];
  consensusScore: number;
  methodology: string;
}
