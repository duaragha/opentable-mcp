import type { Browser, BrowserContext, Page } from "playwright";
import { chromium } from "playwright-extra";
import StealthPlugin from "puppeteer-extra-plugin-stealth";

chromium.use(StealthPlugin());

let browser: Browser | null = null;
let context: BrowserContext | null = null;

const DEFAULT_TIMEOUT = 60_000;

function getBrowserChannel(): string | undefined {
  return process.env.OPENTABLE_BROWSER_CHANNEL || undefined;
}

async function ensureContext(): Promise<BrowserContext> {
  if (!browser || !browser.isConnected()) {
    // Use playwright-extra with stealth plugin to patch automation telltales
    // (navigator.webdriver, chrome runtime, permissions, plugin array, etc.)
    browser = (await chromium.launch({
      headless: true,
      channel: getBrowserChannel(),
    })) as Browser;

    // No manual userAgent override — let the launched browser (Edge/Chrome)
    // set its own native UA so it matches the real binary's version.
    context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      locale: process.env.OPENTABLE_LOCALE || "en-US",
      timezoneId: process.env.OPENTABLE_TIMEZONE || Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
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
  }
}

/**
 * Navigate to an OpenTable URL with anti-bot warmup.
 * OpenTable blocks direct navigation to /r/ pages — the page must visit
 * the homepage first on the SAME page (not a separate tab) so the
 * navigation chain and referer are set correctly.
 */
export async function gotoOpenTable(page: Page, url: string, options?: { waitUntil?: "domcontentloaded" | "load" | "networkidle"; timeout?: number }): Promise<void> {
  const hostname = new URL(url).hostname;
  const waitUntil = options?.waitUntil || "domcontentloaded";
  const timeout = options?.timeout || 30000;

  await page.goto(`https://${hostname}`, { waitUntil: "domcontentloaded", timeout: 15000 });
  await page.goto(url, { waitUntil, timeout });
}

export async function withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
  const ctx = await ensureContext();
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
