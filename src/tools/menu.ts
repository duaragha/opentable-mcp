import { withPage, isOpenTableUrl } from "../browser.js";
import type { MenuSection } from "../types.js";

export async function getRestaurantMenu(params: {
  restaurantUrl: string;
}): Promise<MenuSection[]> {
  if (!isOpenTableUrl(params.restaurantUrl)) {
    throw new Error(`Invalid URL: must be an OpenTable restaurant URL. Got: ${params.restaurantUrl}`);
  }

  return withPage(async (page) => {
    await page.goto(params.restaurantUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => null);

    // Click on the Menu tab if it exists
    const menuTab = page.locator('a[href*="menu"], button:has-text("Menu"), [data-test*="menu"]').first();
    const tabVisible = await menuTab.isVisible({ timeout: 5000 }).catch(() => false);

    if (tabVisible) {
      await menuTab.click();
      await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => null);
    }

    // Wait for menu content
    await page
      .waitForSelector(
        '[class*="menu"], [class*="Menu"], [data-test*="menu"]',
        { timeout: 10000 }
      )
      .catch(() => null);

    const sections = await page.evaluate(() => {
      const results: Array<{
        section: string;
        items: Array<{ name: string; description: string; price: string }>;
      }> = [];

      // Strategy 1: Look for structured menu sections
      const sectionEls = document.querySelectorAll(
        '[class*="MenuSection"], [class*="menu-section"], [class*="menuSection"]'
      );

      if (sectionEls.length > 0) {
        for (const sec of sectionEls) {
          const sectionName =
            sec.querySelector("h2, h3, h4, [class*='title'], [class*='Title']")
              ?.textContent?.trim() || "Other";

          const items: Array<{
            name: string;
            description: string;
            price: string;
          }> = [];

          const itemEls = sec.querySelectorAll(
            '[class*="MenuItem"], [class*="menu-item"], [class*="menuItem"], li'
          );

          for (const item of itemEls) {
            const name =
              item.querySelector(
                "h3, h4, [class*='name'], [class*='Name'], [class*='title']"
              )?.textContent?.trim() || "";
            const desc =
              item.querySelector(
                "p, [class*='description'], [class*='Description']"
              )?.textContent?.trim() || "";
            const price =
              item.querySelector(
                "[class*='price'], [class*='Price'], span[class*='cost']"
              )?.textContent?.trim() || "";

            if (name) items.push({ name, description: desc, price });
          }

          if (items.length > 0) {
            results.push({ section: sectionName, items });
          }
        }
      }

      // Strategy 2: Fallback — scrape elements with price patterns
      if (results.length === 0) {
        const menuContainer = document.querySelector(
          '[class*="menu"], [class*="Menu"], [id*="menu"]'
        );

        if (menuContainer) {
          const items: Array<{
            name: string;
            description: string;
            price: string;
          }> = [];

          const allEls = menuContainer.querySelectorAll("*");
          for (const el of allEls) {
            const text = el.textContent?.trim() || "";
            const priceMatch = text.match(/\$[\d,.]+/);
            if (
              priceMatch &&
              el.children.length < 5 &&
              text.length < 300
            ) {
              const price = priceMatch[0];
              const name = text.replace(price, "").trim().split("\n")[0] || "";
              if (name && name.length > 2 && name.length < 100) {
                items.push({ name, description: "", price });
              }
            }
          }

          if (items.length > 0) {
            results.push({ section: "Menu", items });
          }
        }
      }

      return results;
    });

    return sections;
  });
}
