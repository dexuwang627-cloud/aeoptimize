export function buildScoringPrompt(htmlContent: string, url: string): string {
  // Truncate to avoid token limits on external CLIs
  const truncated = htmlContent.slice(0, 8000);

  return `You are an AEO (Answer Engine Optimization) expert. Analyze this webpage and score its AI search readiness.

URL: ${url}

Score the page across these 5 dimensions. Each dimension has a maximum score:
- structure (max 25): Heading hierarchy, paragraph length (<150 words ideal), FAQ presence, list usage
- citability (max 25): Self-contained statements, data/statistics, clear definitions, source attribution
- schema (max 20): JSON-LD structured data presence, completeness, AI-relevant types (FAQPage, Article, HowTo)
- aiMetadata (max 15): llms.txt reference, robots.txt AI crawler config, meta description quality
- contentDensity (max 15): Content vs boilerplate ratio, keyword stuffing detection, content uniqueness

Respond with ONLY valid JSON, no markdown, no explanation:
{
  "score": <total 0-100>,
  "structure": <0-25>,
  "citability": <0-25>,
  "schema": <0-20>,
  "aiMetadata": <0-15>,
  "contentDensity": <0-15>,
  "insight": "<one sentence summary of the biggest AEO issue>"
}

PAGE CONTENT:
${truncated}`;
}

export interface AiScoreResponse {
  score: number;
  structure: number;
  citability: number;
  schema: number;
  aiMetadata: number;
  contentDensity: number;
  insight: string;
}

export function parseAiResponse(raw: string): AiScoreResponse | null {
  try {
    // Try to extract a balanced JSON object containing "score"
    // First try: find the last { before "score" and match to its closing }
    const scoreIdx = raw.indexOf('"score"');
    if (scoreIdx === -1) return null;

    // Walk backward to find the opening brace
    let braceStart = raw.lastIndexOf('{', scoreIdx);
    if (braceStart === -1) return null;

    // Walk forward to find the matching closing brace
    let depth = 0;
    let braceEnd = -1;
    for (let i = braceStart; i < raw.length; i++) {
      if (raw[i] === '{') depth++;
      else if (raw[i] === '}') {
        depth--;
        if (depth === 0) { braceEnd = i; break; }
      }
    }
    if (braceEnd === -1) return null;

    const parsed = JSON.parse(raw.slice(braceStart, braceEnd + 1));

    // Validate required fields
    if (typeof parsed.score !== 'number') return null;

    return {
      score: clamp(parsed.score, 0, 100),
      structure: clamp(parsed.structure ?? 0, 0, 25),
      citability: clamp(parsed.citability ?? 0, 0, 25),
      schema: clamp(parsed.schema ?? 0, 0, 20),
      aiMetadata: clamp(parsed.aiMetadata ?? 0, 0, 15),
      contentDensity: clamp(parsed.contentDensity ?? 0, 0, 15),
      insight: parsed.insight ?? 'No insight provided',
    };
  } catch {
    return null;
  }
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Math.round(val)));
}
