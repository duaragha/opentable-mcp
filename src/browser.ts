import { chromium, type Browser, type BrowserContext, type Page } from "playwright";

let browser: Browser | null = null;
let context: BrowserContext | null = null;

const BROWSER_CHANNEL = "msedge";

export async function getPage(): Promise<Page> {
  if (!browser || !browser.isConnected()) {
    browser = await chromium.launch({
      headless: true,
      channel: BROWSER_CHANNEL,
    });
    context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
      viewport: { width: 1280, height: 800 },
      locale: "en-CA",
      timezoneId: "America/Toronto",
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
    return await fn(page);
  } finally {
    await page.close();
  }
}
