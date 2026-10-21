// Сборка: один шаблон + locales/<язык>.json -> dist/<язык>/index.html, sitemap.xml, robots.txt, 404
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const p = (...a) => path.join(ROOT, ...a);
const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));

const site = readJson(p('site.config.json'));
const cases = readJson(p('src/data/cases.json'));
const template = fs.readFileSync(p('src/template/index.template.html'), 'utf8');
const template404 = fs.readFileSync(p('src/template/404.template.html'), 'utf8');
const dist = p('dist');

const warnings = new Set();

// ---------- мини-шаблонизатор ----------
// {{a.b.c}} · {{#each путь}}…{{/each}} (this.x, @n = 1…N) · {{#if путь}}…{{/if}} · {{> partial}}
const get = (obj, key) => key.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);

function render(tpl, ctx) {
  // partials
  tpl = tpl.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, name) =>
    fs.readFileSync(p('src/template/partials', `${name}.html`), 'utf8'));

  // each (без вложенности одного блока в такой же, этого хватает для лендинга)
  tpl = tpl.replace(/\{\{#each ([\w.]+)\}\}([\s\S]*?)\{\{\/each\}\}/g, (_, key, body) => {
    const list = get(ctx, key);
    if (!Array.isArray(list)) { warnings.add(`each: «${key}» не массив`); return ''; }
    return list.map((item, i) =>
      render(body.replace(/\{\{this\.([\w.]+)\}\}/g, (__, k) => String(get(item, k) ?? ''))
                 .replace(/\{\{@n\}\}/g, String(i + 1).padStart(2, '0')), ctx)).join('');
  });

  // if
  tpl = tpl.replace(/\{\{#if ([\w.]+)\}\}([\s\S]*?)\{\{\/if\}\}/g, (_, key, body) =>
    get(ctx, key) ? render(body, ctx) : '');

  // значения
  return tpl.replace(/\{\{([\w.]+)\}\}/g, (_, key) => {
    const v = get(ctx, key);
    if (v === undefined) { warnings.add(`нет значения для {{${key}}}`); return ''; }
    return String(v);
  });
}

// ---------- вспомогательное ----------
const baseUrl = site.siteUrl.replace(/\/$/, '');
const langPath = (l) => `/${l}/`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function resolveCases(lang, t) {
  return cases.map((c) => ({
    niche: esc(c.niche[lang] ?? c.niche.ru),
    statVal: esc(c.statVal ?? ''),
    statLbl: esc(typeof c.statLbl === 'object' ? (c.statLbl[lang] ?? c.statLbl.ru) : (c.statLbl ?? '')),
    costVal: esc(c.costVal ?? ''),
    costLbl: esc(typeof c.costLbl === 'object' ? (c.costLbl[lang] ?? c.costLbl.ru) : (c.costLbl ?? '')),
    task: esc(c.task[lang] ?? c.task.ru),
    solution: esc(c.solution[lang] ?? c.solution.ru),
    budget: esc(c.budget[lang] ?? c.budget.ru),
    result: esc(c.result[lang] ?? c.result.ru),
    screenshot: esc(c.screenshot ?? ''),
    screenshotHtml: c.screenshot
      ? `<img src="${esc(c.screenshot)}" alt="${esc(t.cases.screenshot)}" loading="lazy" width="800" height="500">`
      : `<span>${esc(t.cases.screenshot)}</span>`,
  }));
}

// ---------- сборка ----------
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'assets'), { recursive: true });

// статика: public/ -> dist/
fs.cpSync(p('public'), dist, { recursive: true });
fs.cpSync(p('src/js'), path.join(dist, 'assets'), { recursive: true });
if (fs.existsSync(p('src/admin'))) {
  fs.cpSync(p('src/admin'), path.join(dist, 'admin'), { recursive: true });
}

const locales = Object.fromEntries(site.langs.map((l) => [l, readJson(p('src/locales', `${l}.json`))]));

for (const lang of site.langs) {
  const t = locales[lang];
  const ctx = {
    ...t,
    site,
    features: site.features,
    year: new Date().getFullYear(),
    fontSubset: lang === 'ru' ? 'cyrillic' : 'latin',
    url: {
      self: baseUrl + langPath(lang),
      xDefault: baseUrl + langPath(site.defaultLang),
    },
    alternates: site.langs.map((l) => ({ code: l, url: baseUrl + langPath(l) })),
    langs: site.langs.map((l) => ({
      code: l,
      name: locales[l].langName,
      href: langPath(l),
      current: l === lang ? 'aria-current="true"' : '',
    })),
    casesList: resolveCases(lang, t),
  };
  const out = p('dist', lang);
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'index.html'), render(template, ctx));
}

// корень: на язык по умолчанию (мета-редирект для файлового режима; на Cloudflare работает ещё и public/_redirects)
const def = site.defaultLang;
fs.writeFileSync(p('dist/index.html'),
`<!doctype html><html lang="${def}"><head><meta charset="utf-8"><title>${esc(locales[def].meta.title)}</title>
<link rel="canonical" href="${baseUrl}${langPath(def)}"><meta http-equiv="refresh" content="0; url=${langPath(def)}">
<meta name="robots" content="noindex"></head><body><a href="${langPath(def)}">${langPath(def)}</a></body></html>`);

// 404 (на языке по умолчанию)
{
  const t = locales[def];
  const ctx404 = {
    ...t,
    site,
    lang: def,
  };
  fs.writeFileSync(p('dist/404.html'), render(template404, ctx404));
}

// sitemap.xml с hreflang-альтернативами
{
  const alt = (l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${baseUrl}${langPath(l)}"/>`;
  const links = site.langs.map(alt).join('\n') + `\n    <xhtml:link rel="alternate" hreflang="x-default" href="${baseUrl}${langPath(def)}"/>`;
  const urls = site.langs.map((l) => `  <url>\n    <loc>${baseUrl}${langPath(l)}</loc>\n${links}\n  </url>`).join('\n');
  fs.writeFileSync(p('dist/sitemap.xml'),
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`);
}

// robots.txt
fs.writeFileSync(p('dist/robots.txt'), `User-agent: *\nDisallow: /admin\n\nSitemap: ${baseUrl}/sitemap.xml\n`);

// ---------- предупреждения о заглушках ----------
const raw = JSON.stringify([site, cases, locales]);
const left = (raw.match(/REPLACE_ME/g) || []).length;
const stubs = (raw.match(/\[ЗАПОЛНИТЬ[^\]]*\]/g) || []);
if (left) warnings.add(`в site.config.json осталось ${left} значений REPLACE_ME (адрес сайта и ссылки на соцсети)`);
if (stubs.length) warnings.add(`заглушек [ЗАПОЛНИТЬ…] в текстах: ${stubs.length}`);

console.log(`Собрано: ${site.langs.map((l) => `/${l}/`).join(', ')}, 404, sitemap.xml, robots.txt`);
for (const w of warnings) console.warn('  ! ' + w);
