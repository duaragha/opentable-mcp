import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

let browser: Browser | null = null;
let context: BrowserContext | null = null;

const DEFAULT_TIMEOUT = 60_000;

function getBrowserChannel(): string | undefined {
  return process.env.OPENTABLE_BROWSER_CHANNEL || undefined;
}

export async function getPage(): Promise<Page> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({
      headless: true,
      channel: getBrowserChannel(),
    });
    context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      locale: process.env.OPENTABLE_LOCALE || "en-US",
      timezoneId: process.env.OPENTABLE_TIMEZONE || Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  }
  return context!.newPage();
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
    context = null;
  }
}

export async function withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
  const page = await getPage();
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
