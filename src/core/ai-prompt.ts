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
    // Extract JSON from response (may have surrounding text)
    const jsonMatch = raw.match(/\{[\s\S]*?"score"[\s\S]*?\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);

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
