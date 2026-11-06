/**
 * Bypassurl Scraper
 * Creator: NorthCode
 * Base: https://bypassurl.com
 * Saluran: https://whatsapp.com/channel/0029VbDR40XEQIamhRP3VP1s
 */

const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const nodePath = require('path');

const BASE_TARGET = 'https://bypassurl.com';
const WM = {
  Creator: 'NorthCode',
  Saluran: 'https://whatsapp.com/channel/0029VbDR40XEQIamhRP3VP1s'
};

const COOKIES = '';
const HEADERS = Object.assign({
  'User-Agent': 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/json;q=0.9,application/xml;q=0.8,image/webp;q=0.7',
  'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
  'Referer': BASE_TARGET + '/'
}, COOKIES ? { Cookie: COOKIES } : {}, {});

const SEARCH_KEYS = ['q', 's', 'query', 'keyword', 'keywords', 'search', 'term', 'k', 'kw', 'search_query', 'text'];
const RESERVED_FLAGS = ['raw', 'save', 'help'];

const COMMANDS = [
  {
    "name": "data-supported-domains-json",
    "method": "GET",
    "type": "json",
    "path": "/data/supported-domains.json",
    "pathParams": [],
    "query": [
      "v"
    ],
    "fields": [],
    "status": 200
  },
  {
    "name": "about",
    "method": "GET",
    "type": "html",
    "path": "/about",
    "pathParams": [],
    "query": [],
    "fields": [],
    "status": 200
  },
  {
    "name": "blog",
    "method": "GET",
    "type": "html",
    "path": "/blog",
    "pathParams": [],
    "query": [],
    "fields": [],
    "status": 200
  },
  {
    "name": "blog-by-slug",
    "method": "GET",
    "type": "html",
    "path": "/blog/{slug}",
    "pathParams": [
      "slug"
    ],
    "query": [],
    "fields": [],
    "examples": [
      "ad-blockers-vs-content-lockers",
      "anatomy-of-a-redirect-chain",
      "choosing-a-monetization-model",
      "history-of-content-lockers"
    ]
  },
  {
    "name": "contact",
    "method": "GET",
    "type": "html",
    "path": "/contact",
    "pathParams": [],
    "query": [],
    "fields": [],
    "status": 200
  },
  {
    "name": "faq",
    "method": "GET",
    "type": "html",
    "path": "/faq",
    "pathParams": [],
    "query": [],
    "fields": [],
    "status": 200
  },
  {
    "name": "index",
    "method": "GET",
    "type": "html",
    "path": "/",
    "pathParams": [],
    "query": [],
    "fields": [],
    "status": 200
  },
  {
    "name": "logs",
    "method": "GET",
    "type": "html",
    "path": "/logs",
    "pathParams": [],
    "query": [
      "page"
    ],
    "fields": [],
    "status": 200
  },
  {
    "name": "monitor-stats-php",
    "method": "GET",
    "type": "html",
    "path": "/monitor/stats.php",
    "pathParams": [],
    "query": [
      "t"
    ],
    "fields": []
  },
  {
    "name": "privacy",
    "method": "GET",
    "type": "html",
    "path": "/privacy",
    "pathParams": [],
    "query": [],
    "fields": [],
    "status": 200
  },
  {
    "name": "search",
    "method": "GET",
    "type": "html",
    "path": "/",
    "pathParams": [],
    "query": [
      "s"
    ],
    "fields": [],
    "status": 200
  },
  {
    "name": "supported",
    "method": "GET",
    "type": "html",
    "path": "/supported",
    "pathParams": [],
    "query": [],
    "fields": [],
    "status": 200
  },
  {
    "name": "terms",
    "method": "GET",
    "type": "html",
    "path": "/terms",
    "pathParams": [],
    "query": [],
    "fields": [],
    "status": 200
  }
];

function normalizeUrl(input) {
  if (!input) return '';
  const str = String(input).trim();
  if (/^https?:\/\//i.test(str)) return str;
  if (str.startsWith('/')) return BASE_TARGET + str;
  return BASE_TARGET + '/' + str;
}

function isSearchKey(key) {
  return SEARCH_KEYS.includes(String(key).toLowerCase());
}

function mainQuery(cmd) {
  const keys = cmd.query || [];
  return keys.find(isSearchKey) || keys[0] || null;
}

function slugOf(value) {
  const str = String(value).trim();
  if (/^https?:\/\//i.test(str)) {
    try {
      const parts = new URL(str).pathname.split('/').filter(Boolean);
      return parts[parts.length - 1] || str;
    } catch (e) {
      return str;
    }
  }
  return str.replace(/^\/+|\/+$/g, '');
}

function adhoc(input) {
  const target = new URL(normalizeUrl(input));
  return {
    name: 'fetch',
    method: 'GET',
    path: target.pathname + target.search,
    base: target.origin,
    pathParams: [],
    query: [],
    fields: []
  };
}

function buildTarget(cmd, positional, flags) {
  const pos = positional.slice();
  const used = new Set();
  let route = cmd.path;

  (cmd.pathParams || []).forEach((name) => {
    const raw = flags[name] !== undefined && flags[name] !== true ? flags[name] : pos.shift();
    if (raw === undefined || raw === '') {
      throw new Error('Parameter wajib: ' + name);
    }
    const value = slugOf(raw).split('/').map(encodeURIComponent).join('/');
    route = route.split('{' + name + '}').join(value);
    used.add(name);
  });

  const query = {};
  const main = mainQuery(cmd);
  if (pos.length && main) query[main] = pos.join(' ');
  Object.keys(flags).forEach((key) => {
    if (!used.has(key) && !RESERVED_FLAGS.includes(key)) query[key] = flags[key];
  });

  const base = cmd.base || BASE_TARGET;
  if (cmd.method !== 'GET') return { url: base + route, query };

  const qs = Object.keys(query)
    .map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(query[k]))
    .join('&');
  const sep = route.includes('?') ? '&' : '?';
  return { url: base + route + (qs ? sep + qs : ''), query };
}

async function request(cmd, positional, flags) {
  const target = buildTarget(cmd, positional, flags);
  const res = await axios({
    method: cmd.method,
    url: target.url,
    data: cmd.method === 'GET' ? undefined : target.query,
    headers: HEADERS,
    timeout: 30000,
    responseType: 'text',
    transformResponse: [(d) => d],
    validateStatus: (s) => s < 500
  });
  if (res.status === 404) {
    throw new Error('Halaman tidak ditemukan (404): ' + target.url);
  }
  if (res.status >= 400) {
    throw new Error('HTTP Error ' + res.status + ' saat mengakses ' + target.url);
  }
  return { res, url: target.url };
}

function parseBody(res) {
  const type = String(res.headers['content-type'] || '').toLowerCase();
  const text = typeof res.data === 'string' ? res.data : String(res.data);
  const head = text.trim().charAt(0);
  if (type.includes('json') || head === '{' || head === '[') {
    try {
      return { kind: 'json', data: JSON.parse(text) };
    } catch (e) {}
  }
  if (type.includes('html') || /<html|<!doctype/i.test(text.slice(0, 500))) {
    return { kind: 'html', text };
  }
  return { kind: 'text', text };
}

function parsePage(html, pageUrl) {
  const $ = cheerio.load(html);
  const host = new URL(pageUrl).host;
  const clean = (text) => String(text || '').replace(/\s+/g, ' ').trim();
  const abs = (href) => {
    try {
      const u = new URL(href, pageUrl);
      u.hash = '';
      return u.href;
    } catch (e) {
      return '';
    }
  };

  const jsonld = [];
  $('script[type="application/ld+json"]').each((_, s) => {
    try {
      jsonld.push(JSON.parse($(s).html()));
    } catch (e) {}
  });

  let nextData = null;
  try {
    const raw = $('#__NEXT_DATA__').html();
    if (raw) nextData = JSON.parse(raw);
  } catch (e) {}

  $('script, style, noscript').remove();

  const headings = [];
  $('h1, h2, h3').each((_, el) => {
    const text = clean($(el).text());
    if (text) headings.push(text);
  });

  const items = [];
  const seenItems = new Set();
  $('a[href]').each((_, a) => {
    const img = $(a).find('img').first();
    if (!img.length) return;
    const url = abs($(a).attr('href'));
    if (!url || !/^https?:/i.test(url) || seenItems.has(url)) return;
    seenItems.add(url);
    const src = img.attr('src') || img.attr('data-src') || img.attr('data-lazy-src') || '';
    const title = clean(
      $(a).attr('title') || img.attr('alt') || $(a).find('h1, h2, h3, h4, .tt').first().text() || $(a).text()
    );
    items.push({
      title,
      slug: new URL(url).pathname.replace(/^\/+|\/+$/g, ''),
      url,
      thumbnail: src ? abs(src) : ''
    });
  });

  const links = [];
  const seenLinks = new Set();
  $('a[href]').each((_, a) => {
    const url = abs($(a).attr('href'));
    if (!url || !/^https?:/i.test(url) || seenLinks.has(url)) return;
    seenLinks.add(url);
    links.push({ text: clean($(a).text()), url, internal: new URL(url).host === host });
  });

  const tables = [];
  $('table').each((_, table) => {
    if (tables.length >= 5) return;
    const rows = [];
    $(table).find('tr').each((__, tr) => {
      const cells = [];
      $(tr).find('th, td').each((___, td) => {
        cells.push(clean($(td).text()));
      });
      if (cells.length) rows.push(cells);
    });
    if (rows.length) tables.push(rows);
  });

  const forms = [];
  $('form').each((_, form) => {
    const fields = [];
    $(form).find('input[name], select[name], textarea[name]').each((__, f) => {
      fields.push({ name: $(f).attr('name'), type: $(f).attr('type') || f.tagName || f.name });
    });
    forms.push({
      action: abs($(form).attr('action') || ''),
      method: String($(form).attr('method') || 'GET').toUpperCase(),
      fields
    });
  });

  return {
    url: pageUrl,
    title: clean($('title').first().text()),
    description: $('meta[name="description"]').attr('content') || $('meta[property="og:description"]').attr('content') || '',
    headings: headings.slice(0, 50),
    totalItems: items.length,
    items,
    totalLinks: links.length,
    links: links.slice(0, 300),
    tables,
    forms,
    jsonld,
    nextData,
    text: clean($('body').text()).slice(0, 3000)
  };
}

async function run(cmd, positional, flags) {
  const { res, url } = await request(cmd, positional, flags);
  const contentType = String(res.headers['content-type'] || '');
  const head = { ...WM, command: cmd.name, status: res.status };
  if (flags.raw) return { ...head, url, contentType, body: res.data };
  const body = parseBody(res);
  if (body.kind === 'json') return { ...head, url, contentType, data: body.data };
  if (body.kind === 'html') return { ...head, ...parsePage(body.text, url) };
  return { ...head, url, contentType, text: body.text.slice(0, 20000) };
}

function paramsReport() {
  const map = {};
  COMMANDS.forEach((cmd) => {
    [['path', cmd.pathParams], ['query', cmd.query], ['field', cmd.fields]].forEach(([type, list]) => {
      (list || []).forEach((name) => {
        const key = type + ':' + name;
        if (!map[key]) map[key] = { name, type, commands: [] };
        map[key].commands.push(cmd.name);
      });
    });
  });
  const params = Object.values(map).sort(
    (a, b) => b.commands.length - a.commands.length || a.name.localeCompare(b.name)
  );
  return { ...WM, baseUrl: BASE_TARGET, totalParams: params.length, params };
}

function usageOf(cmd) {
  const self = nodePath.basename(process.argv[1] || 'scraper.js');
  const main = mainQuery(cmd);
  const parts = ['node ' + self, cmd.name];
  (cmd.pathParams || []).forEach((p) => parts.push('<' + p + '>'));
  if (main) parts.push('[' + main + ']');
  (cmd.query || []).filter((k) => k !== main).forEach((k) => parts.push('[--' + k + '=...]'));
  return parts.join(' ');
}

function printHelp() {
  const self = nodePath.basename(process.argv[1] || 'scraper.js');
  const lines = ['Usage:'];
  COMMANDS.forEach((cmd) => {
    lines.push(' ' + usageOf(cmd) + '   (' + cmd.method + ' ' + cmd.path + ')');
  });
  lines.push(' node ' + self + ' list');
  lines.push(' node ' + self + ' params');
  lines.push(' node ' + self + ' <url|/path> [--param=value]');
  lines.push('Opsi: --raw  --save=file.json');
  console.log(lines.join('\n'));
}

(async () => {
  const positional = [];
  const flags = {};
  process.argv.slice(2).forEach((arg) => {
    if (arg.startsWith('--')) {
      const i = arg.indexOf('=');
      if (i > 2) flags[arg.slice(2, i)] = arg.slice(i + 1);
      else flags[arg.slice(2)] = true;
    } else {
      positional.push(arg);
    }
  });

  const cmdName = (positional.shift() || '').trim();

  if (flags.help || cmdName === 'help' || cmdName === '-h') {
    printHelp();
    process.exit(0);
  }

  if (!cmdName) {
    printHelp();
    process.exit(1);
  }

  try {
    let result;
    const lower = cmdName.toLowerCase();
    const cmd = COMMANDS.find((c) => c.name === lower);

    if (lower === 'list') {
      result = { ...WM, baseUrl: BASE_TARGET, totalCommands: COMMANDS.length, commands: COMMANDS };
    } else if (lower === 'params') {
      result = paramsReport();
    } else if (cmd) {
      result = await run(cmd, positional, flags);
    } else if (/^(https?:\/\/|\/)/i.test(cmdName)) {
      result = await run(adhoc(cmdName), positional, flags);
    } else {
      const searchCmd = COMMANDS.find((c) => (c.query || []).some(isSearchKey));
      if (!searchCmd) throw new Error('Command tidak dikenal: ' + cmdName);
      result = await run(searchCmd, [cmdName].concat(positional), flags);
    }

    const out = JSON.stringify(result, null, 2);
    if (flags.save && flags.save !== true) fs.writeFileSync(String(flags.save), out);
    console.log(out);
  } catch (err) {
    console.log(JSON.stringify({ ...WM, error: err.message }, null, 2));
    process.exit(1);
  }
})();
