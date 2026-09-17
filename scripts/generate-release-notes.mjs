#!/usr/bin/env node
// Generates .html release notes from the .json source files in
// release-notes/. Run with: node scripts/generate-release-notes.mjs

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, basename, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const notesDir = join(__dirname, '..', 'release-notes');

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

function pageStyles() {
  return `<style>
  :root {
    --color-bg: #0a0a0f;
    --color-bg-card: #16161f;
    --color-border: #1e1e2e;
    --color-text: #e4e4e7;
    --color-text-secondary: #a1a1aa;
    --color-accent-light: #8b5cf6;
  }
  body {
    margin: 0;
    padding: 2.5rem 1.5rem;
    background: var(--color-bg);
    color: var(--color-text);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, sans-serif;
    line-height: 1.6;
  }
  main {
    max-width: 720px;
    margin: 0 auto;
  }
  .back-link {
    display: inline-block;
    margin-bottom: 1.5rem;
    color: var(--color-text-secondary);
    text-decoration: none;
    font-size: 0.9rem;
  }
  .back-link:hover {
    color: var(--color-accent-light);
  }
  h1 {
    font-size: 1.75rem;
    margin-bottom: 0.25rem;
  }
  .subtitle {
    color: var(--color-text-secondary);
    margin-bottom: 2.5rem;
  }
  .release {
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 1.25rem 1.5rem;
    margin-bottom: 1.25rem;
  }
  .release h2 {
    font-size: 1.125rem;
    margin: 0 0 0.75rem;
    font-family: 'JetBrains Mono', monospace;
    color: var(--color-accent-light);
  }
  .release .date {
    color: var(--color-text-secondary);
    font-weight: 400;
    font-size: 0.85rem;
  }
  .release ul {
    margin: 0;
    padding-left: 1.25rem;
  }
  .release li {
    margin-bottom: 0.4rem;
  }
  .release li:last-child {
    margin-bottom: 0;
  }
  .index-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .index-list li {
    margin-bottom: 0.75rem;
  }
  .index-list a {
    display: block;
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    padding: 1rem 1.25rem;
    color: var(--color-text);
    text-decoration: none;
    font-family: 'JetBrains Mono', monospace;
  }
  .index-list a:hover {
    border-color: var(--color-accent-light);
  }
  .index-list .range {
    color: var(--color-accent-light);
  }
  .index-list .meta {
    display: block;
    margin-top: 0.25rem;
    color: var(--color-text-secondary);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, sans-serif;
    font-size: 0.85rem;
  }
</style>`;
}

function toHtml(data) {
  const title = `${data.product} Release Notes (${data.fromVersion} - ${data.toVersion})`;
  const releasesHtml = data.releases
    .map((release) => {
      const items = release.changes
        .map((c) => `        <li>${escapeHtml(c)}</li>`)
        .join('\n');
      return `      <section class="release">
        <h2>v${escapeHtml(release.version)} <span class="date">${escapeHtml(release.date)}</span></h2>
        <ul>
${items}
        </ul>
      </section>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(title)}</title>
${pageStyles()}
</head>
<body>
<main>
  <a class="back-link" href="./">&larr; All release notes</a>
  <h1>${escapeHtml(data.product)} Release Notes</h1>
  <p class="subtitle">Versions ${escapeHtml(data.fromVersion)} &ndash; ${escapeHtml(data.toVersion)}</p>
${releasesHtml}
</main>
</body>
</html>
`;
}

function toIndexHtml(entries) {
  const sorted = [...entries].sort((a, b) => compareVersions(b.data.toVersion, a.data.toVersion));
  const items = sorted
    .map(({ data, base }) => {
      return `    <li>
      <a href="${escapeHtml(base)}.html">
        <span class="range">${escapeHtml(data.product)} ${escapeHtml(data.fromVersion)} &ndash; ${escapeHtml(data.toVersion)}</span>
        <span class="meta">${data.releases.length} release${data.releases.length === 1 ? '' : 's'} &middot; latest ${escapeHtml(data.releases[data.releases.length - 1]?.date || data.generated)}</span>
      </a>
    </li>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Release Notes</title>
${pageStyles()}
</head>
<body>
<main>
  <a class="back-link" href="../">&larr; Aleph Virux</a>
  <h1>Release Notes</h1>
  <p class="subtitle">Pick a version range to see what changed.</p>
  <ul class="index-list">
${items}
  </ul>
</main>
</body>
</html>
`;
}

function main() {
  const files = readdirSync(notesDir).filter((f) => f.endsWith('.json'));

  if (files.length === 0) {
    console.log('No release notes JSON files found.');
    return;
  }

  const entries = [];

  for (const file of files) {
    const jsonPath = join(notesDir, file);
    const data = JSON.parse(readFileSync(jsonPath, 'utf8'));
    const base = basename(file, '.json');

    const htmlPath = join(notesDir, `${base}.html`);

    writeFileSync(htmlPath, toHtml(data));
    entries.push({ data, base });

    console.log(`Generated ${base}.html`);
  }

  const indexPath = join(notesDir, 'index.html');
  writeFileSync(indexPath, toIndexHtml(entries));
  console.log('Generated index.html');
}

main();
