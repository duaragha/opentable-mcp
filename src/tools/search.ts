import { withPage } from "../browser.js";
import type { Restaurant } from "../types.js";

export async function searchRestaurants(params: {
  query: string;
  location: string;
  date?: string;
  time?: string;
  partySize?: number;
}): Promise<Restaurant[]> {
  return withPage(async (page) => {
    const { query, location, date, time, partySize } = params;

    const searchUrl = new URL("https://www.opentable.com/s");
    const searchTerm = query ? `${query} ${location}` : location;
    searchUrl.searchParams.set("term", searchTerm);
    if (date) searchUrl.searchParams.set("dateTime", `${date}T${time || "19:00"}`);
    if (partySize) searchUrl.searchParams.set("covers", partySize.toString());

    await page.goto(searchUrl.toString(), { waitUntil: "domcontentloaded", timeout: 30000 });

    // Wait for search results to render
    await page.waitForSelector('[data-test="search-result-item"], [class*="RestaurantSearchResult"], [class*="restaurant-card"]', {
      timeout: 15000,
    }).catch(() => null);

    // Wait for network to settle instead of arbitrary sleep
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => null);

    const restaurants = await page.evaluate(() => {
      const results: Array<{
        name: string;
        url: string;
        cuisine: string;
        priceRange: string;
        rating: number;
        reviewCount: number;
        neighborhood: string;
        address?: string;
        imageUrl?: string;
      }> = [];

      // Target search result cards specifically, not all links
      const cards = document.querySelectorAll(
        '[data-test="search-result-item"], [class*="RestaurantSearchResult"], [class*="restaurant-card"]'
      );

      const seen = new Set<string>();

      for (const card of cards) {
        const anchor = card.querySelector('a[href*="/r/"]') as HTMLAnchorElement | null;
        if (!anchor?.href || seen.has(anchor.href)) continue;
        seen.add(anchor.href);

        const name = card.querySelector('h2, [class*="name"], [class*="Name"]')?.textContent?.trim()
          || anchor.textContent?.trim()?.split("\n")[0]
          || "";
        if (!name || name.length > 100) continue;

        const ratingEl = card.querySelector('[class*="rating"], [class*="Rating"], [class*="star"]');
        const ratingText = ratingEl?.textContent?.trim() || "";
        const ratingMatch = ratingText.match(/([\d.]+)/);
        const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 0;

        const reviewMatch = card.textContent?.match(/\((\d[\d,]*)\s*(?:reviews?|ratings?)\)/i)
          || card.textContent?.match(/(\d[\d,]*)\s*(?:reviews?|ratings?)/i);
        const reviewCount = reviewMatch ? parseInt(reviewMatch[1].replace(",", "")) : 0;

        const priceEl = card.querySelector('[class*="price"], [class*="Price"]');
        const priceRange = priceEl?.textContent?.trim()
          || (card.textContent?.match(/(\${2,4}|CAN\$[\d]+)/)?.[1] ?? "");

        const cuisineEl = card.querySelector('[class*="cuisine"], [class*="Cuisine"]');
        const cuisine = cuisineEl?.textContent?.trim() || "";

        const neighborhoodEl = card.querySelector('[class*="neighborhood"], [class*="Neighborhood"], [class*="location"]');
        const neighborhood = neighborhoodEl?.textContent?.trim() || "";

        const imgEl = card.querySelector("img");
        const imageUrl = imgEl?.src || "";

        results.push({
          name,
          url: anchor.href,
          cuisine,
          priceRange,
          rating,
          reviewCount,
          neighborhood,
          imageUrl: imageUrl || undefined,
        });
      }

      return results;
    });

    return restaurants;
  }, "https://www.opentable.com");
}
