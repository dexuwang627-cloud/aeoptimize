#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { writeFile, mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { scan, scanDirectory, parseHtml, scanUrl } from '../core/scanner.js';
import { generate } from '../core/generator.js';
import { detectAvailableCLIs, scoreWithAllAvailable } from '../core/external-scorers.js';
import { mergeScores } from '../core/merger.js';
import type { ScanReport, MultiAiReport, DimensionScores, ScanTarget, SiteInfo, AiScorerResult } from '../core/types.js';

const program = new Command();

program
  .name('aeo')
  .description('CLI toolkit that transforms SEO-optimized websites into AI-search-ready content')
  .version('0.3.0');

// ── scan command ───────────────────────────────────────────────────

program
  .command('scan <target>')
  .description('Scan a URL or directory for AI readability')
  .option('--json', 'Output raw JSON report')
  .option('--dir', 'Treat target as a local directory instead of a URL')
  .option('--multi-ai', 'Score with multiple AI engines (gemini, copilot) if available')
  .action(async (target: string, options: { json?: boolean; dir?: boolean; multiAi?: boolean }) => {
    try {
      if (!target || target.trim().length === 0) {
        console.error(chalk.red('Error: Please provide a URL or directory path.'));
        console.error(chalk.dim('  npx aeoptimize scan example.com'));
        console.error(chalk.dim('  npx aeoptimize scan ./dist --dir'));
        process.exit(1);
      }
      const scanTarget = resolveTarget(target, options.dir);
      const report = await scan(scanTarget);

      if (options.multiAi) {
        const multiReport = await runMultiAiScan(report, target, !!options.json);
        if (options.json) {
          console.log(JSON.stringify(multiReport, null, 2));
        } else {
          printMultiAiReport(multiReport);
          printSkillCta();
        }
      } else {
        if (options.json) {
          console.log(JSON.stringify(report, null, 2));
        } else {
          printReport(report);
          printSkillCta();
        }
      }
    } catch (err) {
      console.error(chalk.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

// ── generate command ───────────────────────────────────────────────

program
  .command('generate <dir>')
  .description('Generate AI infrastructure files (llms.txt, JSON-LD, robots.txt suggestions)')
  .option('--out <dir>', 'Output directory (defaults to input directory)')
  .option('--json', 'Output raw JSON')
  .option('--dry-run', 'Preview without writing files')
  .action(async (dir: string, options: { out?: string; json?: boolean; dryRun?: boolean }) => {
    try {
      const stats = await stat(dir);
      if (!stats.isDirectory()) {
        console.error(chalk.red('Error: Target must be a directory'));
        process.exit(1);
      }

      const report = await scanDirectory(dir);
      if (report.pages.length === 0) {
        console.error(chalk.yellow('No HTML or Markdown files found in directory.'));
        process.exit(1);
      }

      // Re-parse pages to get full ParsedDocument
      const { parseHtml, parseMarkdown } = await import('../core/scanner.js');
      const { readFile: rf, readdir } = await import('node:fs/promises');
      const { join: j, extname } = await import('node:path');

      const pages = [];
      for (const page of report.pages) {
        try {
          const content = await rf(page.url, 'utf-8');
          const ext = extname(page.url).toLowerCase();
          if (ext === '.html' || ext === '.htm') {
            pages.push(parseHtml(content, page.url));
          } else {
            pages.push(parseMarkdown(content, page.url));
          }
        } catch {
          // Skip
        }
      }

      const siteInfo: SiteInfo = {
        name: detectSiteName(dir, report),
        description: report.pages[0]?.title || 'Website',
        baseUrl: dir,
      };

      // Try to read existing robots.txt
      let existingRobots: string | null = null;
      try {
        existingRobots = await rf(j(dir, 'robots.txt'), 'utf-8');
      } catch { /* none */ }

      const output = generate(report, pages, siteInfo, existingRobots);

      if (options.json) {
        console.log(JSON.stringify(output, null, 2));
        return;
      }

      const outDir = options.out || dir;

      if (options.dryRun) {
        console.log(chalk.cyan.bold('\n📋 Dry Run — Files that would be generated:\n'));
        console.log(chalk.white.bold('llms.txt:'));
        console.log(output.llmsTxt);
        console.log(chalk.white.bold('\nllms-full.txt:'));
        console.log(output.llmsFullTxt.slice(0, 500) + (output.llmsFullTxt.length > 500 ? '\n...' : ''));
        if (output.jsonLd.length > 0) {
          console.log(chalk.white.bold(`\nJSON-LD (${output.jsonLd.length} schemas):`));
          console.log(JSON.stringify(output.jsonLd[0], null, 2).slice(0, 300) + '...');
        }
        console.log(chalk.white.bold('\nrobots.txt suggestions:'));
        console.log(output.robotsTxtSuggestions.join('\n'));
        return;
      }

      // Write files
      await writeFile(j(outDir, 'llms.txt'), output.llmsTxt, 'utf-8');
      await writeFile(j(outDir, 'llms-full.txt'), output.llmsFullTxt, 'utf-8');

      if (output.jsonLd.length > 0) {
        const jsonLdDir = j(outDir, '_aeo');
        await mkdir(jsonLdDir, { recursive: true });
        await writeFile(j(jsonLdDir, 'generated-schemas.json'), JSON.stringify(output.jsonLd, null, 2), 'utf-8');
      }

      console.log(chalk.green.bold('\n✅ Generated AI infrastructure files:\n'));
      console.log(`  ${chalk.white('llms.txt')}         — AI-readable site summary`);
      console.log(`  ${chalk.white('llms-full.txt')}    — Full content for AI consumption`);
      if (output.jsonLd.length > 0) {
        console.log(`  ${chalk.white('_aeo/generated-schemas.json')} — ${output.jsonLd.length} JSON-LD schemas`);
      }
      console.log(chalk.dim('\nrobots.txt suggestions (not auto-applied):'));
      for (const line of output.robotsTxtSuggestions.filter((l) => l.startsWith('User-agent:'))) {
        console.log(chalk.dim(`  ${line}`));
      }
    } catch (err) {
      console.error(chalk.red(`Error: ${(err as Error).message}`));
      process.exit(1);
    }
  });

program.parse();

// ── Helpers ────────────────────────────────────────────────────────

function resolveTarget(target: string, isDir?: boolean): ScanTarget {
  if (isDir) {
    return { type: 'directory', path: target };
  }
  if (target.startsWith('http://') || target.startsWith('https://')) {
    return { type: 'url', path: target };
  }
  // Bare domain (contains a dot, no path separator) → treat as URL
  if (target.includes('.') && !target.includes('/') && !target.includes('\\')) {
    return { type: 'url', path: `https://${target}` };
  }
  // Looks like a local path — hint the user
  if (target.startsWith('./') || target.startsWith('/') || target.startsWith('..')) {
    console.error(chalk.yellow(`Hint: "${target}" looks like a local path. Use --dir flag to scan directories.`));
    console.error(chalk.yellow(`  npx aeoptimize scan ${target} --dir`));
    process.exit(1);
  }
  // Fallback: assume URL with https
  return { type: 'url', path: `https://${target}` };
}

function detectSiteName(dir: string, report: ScanReport): string {
  // Use the first page title or directory name
  if (report.pages.length > 0) {
    return report.pages[0].title.split('|')[0].split('-')[0].trim();
  }
  return dir.split('/').pop() || 'Website';
}

function printReport(report: ScanReport): void {
  const { overall } = report;

  console.log('');
  console.log(chalk.bold('  AEO Readability Report'));
  console.log(chalk.dim(`  ${report.timestamp}`));
  console.log(chalk.dim(`  ${report.pages.length} page${report.pages.length > 1 ? 's' : ''} scanned`));
  console.log('');

  // Overall score
  const scoreColor = overall.total >= 70 ? chalk.green : overall.total >= 40 ? chalk.yellow : chalk.red;
  console.log(`  ${chalk.bold('Score:')} ${scoreColor.bold(String(overall.total))}${chalk.dim('/100')}  ${report.summary}`);
  console.log('');

  // Dimension breakdown
  printDimensionBar('Structure', overall.structure, 25);
  printDimensionBar('Citability', overall.citability, 25);
  printDimensionBar('Schema', overall.schema, 20);
  printDimensionBar('AI Metadata', overall.aiMetadata, 15);
  printDimensionBar('Content Density', overall.contentDensity, 15);
  console.log('');

  // Top issues
  const allIssues = report.pages.flatMap((p) => p.issues);
  const criticalIssues = allIssues.filter((i) => i.severity === 'critical');
  const warningIssues = allIssues.filter((i) => i.severity === 'warning');

  if (criticalIssues.length > 0) {
    console.log(chalk.red.bold('  Critical Issues:'));
    for (const issue of criticalIssues.slice(0, 5)) {
      console.log(`  ${chalk.red('✗')} ${issue.message}`);
    }
    console.log('');
  }

  if (warningIssues.length > 0) {
    console.log(chalk.yellow.bold('  Warnings:'));
    for (const issue of warningIssues.slice(0, 5)) {
      console.log(`  ${chalk.yellow('!')} ${issue.message}`);
    }
    console.log('');
  }

  // Top suggestions
  const allSuggestions = report.pages.flatMap((p) => p.suggestions);
  const highImpact = allSuggestions.filter((s) => s.impact === 'high');
  if (highImpact.length > 0) {
    console.log(chalk.cyan.bold('  Top Suggestions:'));
    // Deduplicate by action
    const seen = new Set<string>();
    for (const sug of highImpact) {
      if (seen.has(sug.action)) continue;
      seen.add(sug.action);
      console.log(`  ${chalk.cyan('→')} ${sug.action}`);
      console.log(`    ${chalk.dim(sug.detail)}`);
    }
    console.log('');
  }

  // Per-page breakdown if multiple pages
  if (report.pages.length > 1) {
    console.log(chalk.bold('  Per-Page Scores:'));
    for (const page of report.pages.sort((a, b) => a.scores.total - b.scores.total)) {
      const color = page.scores.total >= 70 ? chalk.green : page.scores.total >= 40 ? chalk.yellow : chalk.red;
      const name = page.title.length > 40 ? page.title.slice(0, 37) + '...' : page.title;
      console.log(`  ${color(String(page.scores.total).padStart(3))} ${name}`);
    }
    console.log('');
  }
}

function printDimensionBar(label: string, score: number, max: number): void {
  const pct = score / max;
  const barWidth = 20;
  const filled = Math.round(pct * barWidth);
  const empty = barWidth - filled;
  const color = pct >= 0.7 ? chalk.green : pct >= 0.4 ? chalk.yellow : chalk.red;

  const bar = color('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
  const labelPad = label.padEnd(16);
  console.log(`  ${labelPad} ${bar} ${color(String(score))}${chalk.dim('/' + max)}`);
}

async function runMultiAiScan(ruleReport: ScanReport, target: string, silent = false): Promise<MultiAiReport> {
  if (!silent) console.log(chalk.dim('\n  Detecting AI CLIs...'));
  const available = await detectAvailableCLIs();

  const found: string[] = [];
  if (available.gemini) found.push('gemini');
  if (available.copilot) found.push('copilot');

  if (!silent) {
    if (found.length > 0) {
      console.log(chalk.dim(`  Found: ${found.join(', ')}`));
      console.log(chalk.dim('  Requesting AI scores (this may take a moment)...\n'));
    } else {
      console.log(chalk.dim('  No external AI CLIs found. Using rule engine only.\n'));
    }
  }

  // Resolve target URL for fetching HTML
  const url = resolveTargetUrl(target);
  let html = '';
  if (url) {
    try {
      const response = await fetch(url);
      html = await response.text();
    } catch {
      // Fall through with empty html
    }
  }

  const aiScores = html ? await scoreWithAllAvailable(html, url || target, available) : [];
  return mergeScores(ruleReport, aiScores);
}

function resolveTargetUrl(target: string): string | null {
  if (target.startsWith('http://') || target.startsWith('https://')) return target;
  if (target.includes('.') && !target.includes('/') && !target.includes('\\')) return `https://${target}`;
  return null;
}

function printMultiAiReport(report: MultiAiReport): void {
  const { overall } = report;

  console.log('');
  console.log(chalk.bold('  AEO Readability Report (Multi-AI)'));
  console.log(chalk.dim(`  ${report.timestamp}`));
  console.log(chalk.dim(`  ${report.pages.length} page${report.pages.length > 1 ? 's' : ''} scanned`));
  console.log(chalk.dim(`  ${report.methodology}`));
  console.log('');

  // Consensus score
  const scoreColor = report.consensusScore >= 70 ? chalk.green : report.consensusScore >= 40 ? chalk.yellow : chalk.red;
  console.log(`  ${chalk.bold('Score:')} ${scoreColor.bold(String(report.consensusScore))}${chalk.dim('/100')} (Rule Engine: ${report.ruleScore} | AI Consensus: ${report.aiScores.filter((s) => s.available).length > 0 ? Math.round(report.aiScores.filter((s) => s.available).reduce((sum, s) => sum + s.score, 0) / report.aiScores.filter((s) => s.available).length) : 'N/A'})`);
  console.log('');

  // Source breakdown
  console.log(chalk.bold('  Scorer Breakdown:'));
  printScoreBar('Rule Engine', report.ruleScore, 100);
  for (const ai of report.aiScores) {
    if (ai.available) {
      const label = ai.source.charAt(0).toUpperCase() + ai.source.slice(1);
      printScoreBar(label, ai.score, 100);
    }
  }
  console.log('');

  // Dimension breakdown (from rule engine)
  console.log(chalk.bold('  Dimension Breakdown (Rule Engine):'));
  const ruleOverall = { ...report.overall, total: report.ruleScore };
  printDimensionBar('Structure', report.pages[0]?.scores.structure ?? 0, 25);
  printDimensionBar('Citability', report.pages[0]?.scores.citability ?? 0, 25);
  printDimensionBar('Schema', report.pages[0]?.scores.schema ?? 0, 20);
  printDimensionBar('AI Metadata', report.pages[0]?.scores.aiMetadata ?? 0, 15);
  printDimensionBar('Content Density', report.pages[0]?.scores.contentDensity ?? 0, 15);
  console.log('');

  // AI Insights
  const availableAi = report.aiScores.filter((s) => s.available && s.insight);
  if (availableAi.length > 0) {
    console.log(chalk.magenta.bold('  AI Insights:'));
    for (const ai of availableAi) {
      const label = ai.source.charAt(0).toUpperCase() + ai.source.slice(1);
      console.log(`  ${chalk.magenta(label + ':')} ${ai.insight}`);
    }
    console.log('');
  }

  // Issues and suggestions from rule engine
  const allIssues = report.pages.flatMap((p) => p.issues);
  const criticalIssues = allIssues.filter((i) => i.severity === 'critical');
  if (criticalIssues.length > 0) {
    console.log(chalk.red.bold('  Critical Issues:'));
    for (const issue of criticalIssues.slice(0, 5)) {
      console.log(`  ${chalk.red('✗')} ${issue.message}`);
    }
    console.log('');
  }

  const allSuggestions = report.pages.flatMap((p) => p.suggestions);
  const highImpact = allSuggestions.filter((s) => s.impact === 'high');
  if (highImpact.length > 0) {
    console.log(chalk.cyan.bold('  Top Suggestions:'));
    const seen = new Set<string>();
    for (const sug of highImpact) {
      if (seen.has(sug.action)) continue;
      seen.add(sug.action);
      console.log(`  ${chalk.cyan('→')} ${sug.action}`);
      console.log(`    ${chalk.dim(sug.detail)}`);
    }
    console.log('');
  }
}

function printScoreBar(label: string, score: number, max: number): void {
  const pct = score / max;
  const barWidth = 20;
  const filled = Math.round(pct * barWidth);
  const empty = barWidth - filled;
  const color = pct >= 0.7 ? chalk.green : pct >= 0.4 ? chalk.yellow : chalk.red;

  const bar = color('█'.repeat(filled)) + chalk.dim('░'.repeat(empty));
  const labelPad = label.padEnd(16);
  console.log(`  ${labelPad} ${bar} ${color(String(score))}${chalk.dim('/' + max)}`);
}

function printSkillCta(): void {
  console.log(chalk.dim('  ─────────────────────────────────────────'));
  console.log(chalk.dim('  Want AI-powered fixes? Install as Claude Code skill:'));
  console.log(chalk.white('    claude plugin marketplace add dexuwang627-cloud/aeoptimize'));
  console.log(chalk.dim('  Then use: /aeo-scan, /aeo-generate, /aeo-transform'));
  console.log('');
}
