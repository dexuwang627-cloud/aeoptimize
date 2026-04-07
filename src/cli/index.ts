#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { scan, scanDirectory, parseHtml } from '../core/scanner.js';
import { generate } from '../core/generator.js';
import type { ScanReport, DimensionScores, ScanTarget, SiteInfo } from '../core/types.js';

const program = new Command();

program
  .name('aeo')
  .description('CLI toolkit that transforms SEO-optimized websites into AI-search-ready content')
  .version('0.1.0');

// ── scan command ───────────────────────────────────────────────────

program
  .command('scan <target>')
  .description('Scan a URL or directory for AI readability')
  .option('--json', 'Output raw JSON report')
  .action(async (target: string, options: { json?: boolean }) => {
    try {
      const scanTarget = resolveTarget(target);
      const report = await scan(scanTarget);

      if (options.json) {
        console.log(JSON.stringify(report, null, 2));
      } else {
        printReport(report);
        printSkillCta();
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

function resolveTarget(target: string): ScanTarget {
  if (target.startsWith('http://') || target.startsWith('https://')) {
    return { type: 'url', path: target };
  }
  // Could be file or directory — stat will determine
  return { type: 'directory', path: target };
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

function printSkillCta(): void {
  console.log(chalk.dim('  ─────────────────────────────────────────'));
  console.log(chalk.dim('  Want AI-powered fixes? Install as Claude Code skill:'));
  console.log(chalk.white('    claude plugin marketplace add dexuwang627-cloud/aeoptimize'));
  console.log(chalk.dim('  Then use: /aeo-scan, /aeo-generate, /aeo-transform'));
  console.log('');
}
