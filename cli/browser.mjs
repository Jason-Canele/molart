// Shared headless-browser helpers for the CLI and browser tests.
import { createServer } from 'node:http';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { extname, join, resolve } from 'node:path';
import { chromium } from 'playwright-core';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.cif': 'text/plain', '.pdb': 'text/plain', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };

/** Minimal static file server for the built app (dist/). Local only. */
export function serveStatic(root) {
  root = resolve(root);
  return new Promise((res) => {
    const srv = createServer((req, rsp) => {
      const url = decodeURIComponent((req.url || '/').split('?')[0]);
      let p = resolve(join(root, url));
      if (!p.startsWith(root)) {
        rsp.writeHead(403).end();
        return;
      }
      if (existsSync(p) && statSync(p).isDirectory()) p = join(p, 'index.html');
      if (!existsSync(p)) {
        rsp.writeHead(404).end();
        return;
      }
      rsp.writeHead(200, { 'content-type': MIME[extname(p)] || 'application/octet-stream' });
      rsp.end(readFileSync(p));
    });
    srv.listen(0, '127.0.0.1', () => res({ url: `http://127.0.0.1:${srv.address().port}/`, close: () => srv.close() }));
  });
}

/** Find a Chromium executable: $MOLART_CHROMIUM, Playwright cache, or system Chrome. */
export function findChromium() {
  if (process.env.MOLART_CHROMIUM) return process.env.MOLART_CHROMIUM;
  const cache = join(homedir(), '.cache', 'ms-playwright');
  if (existsSync(cache)) {
    const dirs = readdirSync(cache).filter((d) => /^chromium-\d+$/.test(d)).sort().reverse();
    for (const d of dirs) {
      for (const sub of ['chrome-linux/chrome', 'chrome-linux64/chrome', 'chrome-mac/Chromium.app/Contents/MacOS/Chromium', 'chrome-win/chrome.exe']) {
        const p = join(cache, d, sub);
        if (existsSync(p)) return p;
      }
    }
  }
  for (const p of ['/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']) if (existsSync(p)) return p;
  return undefined; // let Playwright try its default
}

export async function launch({ width = 1200, height = 900 } = {}) {
  const browser = await chromium.launch({
    executablePath: findChromium(),
    headless: true,
    args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  return { browser, page, errors };
}

export async function openApp(page, baseUrl, query = 'empty=1') {
  await page.goto(`${baseUrl}?${query}`);
  await page.waitForFunction(() => !!window.molart, null, { timeout: 30000 });
}
