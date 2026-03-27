import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

let browser: Browser | null = null;
let context: BrowserContext | null = null;
const warmedDomains = new Set<string>();

const DEFAULT_TIMEOUT = 60_000;

function getBrowserChannel(): string | undefined {
  return process.env.OPENTABLE_BROWSER_CHANNEL || undefined;
}

async function warmDomain(ctx: BrowserContext, url: string): Promise<void> {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return;
  }
  if (warmedDomains.has(hostname)) return;

  // OpenTable blocks direct navigation to /r/ pages from automated browsers.
  // Visiting the homepage first sets the required anti-bot cookies.
  const page = await ctx.newPage();
  try {
    await page.goto(`https://${hostname}`, { waitUntil: "domcontentloaded", timeout: 15000 });
  } catch {
    // Non-fatal — some tool calls may still work without warmup
  } finally {
    await page.close();
  }
  warmedDomains.add(hostname);
}

async function ensureContext(): Promise<BrowserContext> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({
      headless: true,
      channel: getBrowserChannel(),
    });
    context = await browser.newContext({
      userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36 Edg/136.0.0.0",
      viewport: { width: 1280, height: 800 },
      locale: process.env.OPENTABLE_LOCALE || "en-US",
      timezoneId: process.env.OPENTABLE_TIMEZONE || Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    warmedDomains.clear();
  }
  return context!;
}

export async function getPage(): Promise<Page> {
  const ctx = await ensureContext();
  return ctx.newPage();
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
    context = null;
    warmedDomains.clear();
  }
}

export async function withPage<T>(fn: (page: Page) => Promise<T>, targetUrl?: string): Promise<T> {
  const ctx = await ensureContext();
  if (targetUrl) {
    await warmDomain(ctx, targetUrl);
  }
  const page = await ctx.newPage();
  try {
    const result = await Promise.race([
      fn(page),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Operation timed out after 60 seconds")), DEFAULT_TIMEOUT)
      ),
    ]);
    return result;
  } finally {
    await page.close();
  }
}

export function isOpenTableUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return /^(www\.)?opentable\.(com|ca|co\.uk|com\.au|de|es|fr|it|nl|ie|com\.mx|co\.jp)$/.test(parsed.hostname);
  } catch {
    return false;
  }
}
