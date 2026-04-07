import { execFile, exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { AiScorerResult, AiSource, DimensionScores } from './types.js';
import { buildScoringPrompt, parseAiResponse } from './ai-prompt.js';

const execFileAsync = promisify(execFile);
const execAsync = promisify(exec);

const TIMEOUT_MS = 60_000;

export interface AvailableCLIs {
  gemini: boolean;
  copilot: boolean;
}

export async function detectAvailableCLIs(): Promise<AvailableCLIs> {
  const [gemini, copilot] = await Promise.all([
    commandExists('gemini'),
    commandExists('copilot'),
  ]);
  return { gemini, copilot };
}

async function commandExists(cmd: string): Promise<boolean> {
  try {
    await execAsync(`command -v ${cmd}`, { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

export async function scoreWithExternalCLI(
  source: AiSource,
  html: string,
  url: string,
): Promise<AiScorerResult> {
  const prompt = buildScoringPrompt(html, url);

  const unavailable: AiScorerResult = {
    source,
    score: 0,
    dimensions: { structure: 0, citability: 0, schema: 0, aiMetadata: 0, contentDensity: 0, total: 0 },
    insight: 'CLI not available',
    available: false,
  };

  try {
    let raw: string;

    if (source === 'gemini') {
      raw = await runGemini(prompt);
    } else if (source === 'copilot') {
      raw = await runCopilot(prompt);
    } else {
      return unavailable;
    }

    const parsed = parseAiResponse(raw);
    if (!parsed) {
      return { ...unavailable, available: true, insight: 'Failed to parse AI response' };
    }

    const dimensions: DimensionScores = {
      structure: parsed.structure,
      citability: parsed.citability,
      schema: parsed.schema,
      aiMetadata: parsed.aiMetadata,
      contentDensity: parsed.contentDensity,
      total: parsed.score,
    };

    return {
      source,
      score: parsed.score,
      dimensions,
      insight: parsed.insight,
      available: true,
    };
  } catch {
    return { ...unavailable, insight: `${source} CLI timed out or errored` };
  }
}

async function runGemini(prompt: string): Promise<string> {
  // gemini CLI accepts prompt via -p flag
  const { stdout } = await execFileAsync('gemini', ['-p', prompt], {
    timeout: TIMEOUT_MS,
    maxBuffer: 1024 * 1024,
  });
  return stdout;
}

async function runCopilot(prompt: string): Promise<string> {
  // copilot CLI accepts prompt via -p flag
  const { stdout } = await execFileAsync('copilot', ['-p', prompt], {
    timeout: TIMEOUT_MS,
    maxBuffer: 1024 * 1024,
  });
  return stdout;
}

export async function scoreWithAllAvailable(
  html: string,
  url: string,
  available: AvailableCLIs,
): Promise<AiScorerResult[]> {
  const tasks: Promise<AiScorerResult>[] = [];

  if (available.gemini) {
    tasks.push(scoreWithExternalCLI('gemini', html, url));
  }
  if (available.copilot) {
    tasks.push(scoreWithExternalCLI('copilot', html, url));
  }

  const results = await Promise.allSettled(tasks);

  return results.map((r) => {
    if (r.status === 'fulfilled') return r.value;
    return {
      source: 'gemini' as AiSource,
      score: 0,
      dimensions: { structure: 0, citability: 0, schema: 0, aiMetadata: 0, contentDensity: 0, total: 0 },
      insight: 'Scorer failed unexpectedly',
      available: false,
    };
  });
}
