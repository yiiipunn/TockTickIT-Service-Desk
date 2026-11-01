import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const root = path.resolve(import.meta.dirname, '..');
const source = path.join(root, 'docs/lab-04/final-report.md');
const output = path.join(root, 'artifacts/lab-04/final-report.pdf');
const htmlPath = path.join(root, 'tmp/lab4-final-report.html');
const branch = 'feature/lab4-final-documentation';
const repoUrl = 'https://github.com/yiiipunn/TockTickIT-Service-Desk';
const require = createRequire(import.meta.url);
const { chromium } = require(path.join(root, 'client/node_modules/@playwright/test'));

const escapeHtml = (s) => s.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
function destination(href) {
  if (/^https?:\/\//.test(href)) return href;
  const [relative, fragment] = href.split('#');
  const repositoryPath = path.posix.normalize(path.posix.join('docs/lab-04', relative || 'final-report.md'));
  const mode = relative.endsWith('/') ? 'tree' : 'blob';
  const base = `${repoUrl}/${mode}/${branch}/${repositoryPath}`;
  return fragment ? `${base}#${fragment}` : base;
}
function inline(s) {
  const links = [];
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    const key = `ZZLINK${links.length}ZZ`;
    links.push(`<a href="${escapeHtml(destination(href))}">${escapeHtml(label)}</a>`);
    return key;
  });
  s = escapeHtml(s).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>');
  return s.replace(/ZZLINK(\d+)ZZ/g, (_, n) => links[Number(n)]);
}

const figures = {
  3: ['issue-30/backend-regression-tests.png', 'Server regression report: 244 tests, zero failures.'],
  5: ['issue-31/staff-dashboard.png', 'IT Staff Dashboard from the Issue #31 browser run.'],
  6: ['issue-31/actions-taken-flow.png', 'Actions Taken and Action history on one Ticket.'],
  7: ['issue-31/ticket-resolution.png', 'Formal Ticket resolution workflow.'],
  8: ['issue-31/requester-dashboard.png', 'Requester Dashboard from the Issue #31 browser run.']
};
const lines = (await fs.readFile(source, 'utf8')).split(/\r?\n/);
const blocks = [];
let paragraph = [];
let list = null;
let part = 0;
function flushParagraph() {
  if (paragraph.length) blocks.push(`<p>${inline(paragraph.join(' '))}</p>`);
  paragraph = [];
}
function closeList() {
  if (list) blocks.push(`</${list}>`);
  list = null;
}
for (const line of lines) {
  const heading = line.match(/^(#{1,3})\s+(.*)$/);
  const bullet = line.match(/^([0-9]+\.|-)\s+(.*)$/);
  if (!line.trim()) { flushParagraph(); closeList(); continue; }
  if (heading) {
    flushParagraph(); closeList();
    const depth = heading[1].length;
    const title = heading[2];
    if (depth === 2 && /^Answer Part [1-9]$/.test(title)) {
      part = Number(title.slice(-1));
      blocks.push(`<h2 class="answer${part === 1 ? ' first' : ''}">${inline(title)}</h2>`);
    } else {
      blocks.push(`<h${depth}>${inline(title)}</h${depth}>`);
      if (depth === 3 && part && figures[part] && !figures[part].used && !title.startsWith('Outstanding')) {
        const [file, caption] = figures[part];
        const local = pathToFileURL(path.join(root, 'artifacts/lab-04/screenshots', file)).href;
        const link = destination(`../../artifacts/lab-04/screenshots/${file}`);
        blocks.push(`<figure><a href="${link}"><img src="${local}" alt="${escapeHtml(caption)}"></a><figcaption>${escapeHtml(caption)} Click for the source image.</figcaption></figure>`);
        figures[part].used = true;
      }
    }
    continue;
  }
  if (bullet) {
    flushParagraph();
    const type = bullet[1] === '-' ? 'ul' : 'ol';
    if (list !== type) { closeList(); blocks.push(`<${type}>`); list = type; }
    blocks.push(`<li>${inline(bullet[2])}</li>`);
    continue;
  }
  closeList();
  paragraph.push(line.trim());
}
flushParagraph(); closeList();
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>TokTickIT Lab 4 Answer Parts 1–9</title>
<style>
@page { size: A4; margin: 17mm 18mm 18mm; }
body { font-family: Arial, sans-serif; color: #173027; font-size: 10pt; line-height: 1.38; }
h1 { color: #006b42; font-size: 20pt; margin-bottom: 10mm; }
h2 { color: #006b42; font-size: 16pt; border-bottom: 2px solid #006b42; padding-bottom: 3mm; margin-top: 0; }
h3 { color: #143e2a; font-size: 12pt; margin-bottom: 3mm; }
p, li { orphans: 3; widows: 3; }
a { color: #006b42; text-decoration: underline; }
code { font-family: Consolas, monospace; font-size: 9pt; }
h2.answer { break-before: page; }
h2.answer.first { break-before: auto; margin-top: 10mm; }
figure { margin: 5mm 0; break-inside: avoid; text-align: center; }
figure img { max-width: 100%; max-height: 140mm; object-fit: contain; border: 1px solid #bfd8c9; }
figcaption { font-size: 8pt; color: #436052; margin-top: 2mm; }
li { margin-bottom: 2mm; }
</style></head><body>${blocks.join('\n')}</body></html>`;
await fs.mkdir(path.dirname(htmlPath), { recursive: true });
await fs.writeFile(htmlPath, html, 'utf8');
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(pathToFileURL(htmlPath).href, { waitUntil: 'load' });
  await page.pdf({ path: output, format: 'A4', printBackground: true, preferCSSPageSize: true });
} finally {
  await browser.close();
}
console.log(output);
