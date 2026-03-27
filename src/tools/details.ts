import { withPage } from "../browser.js";
import type { RestaurantDetails } from "../types.js";

export async function getRestaurantDetails(params: {
  restaurantUrl: string;
}): Promise<RestaurantDetails> {
  return withPage(async (page) => {
    await page.goto(params.restaurantUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // Wait for the main content to load
    await page
      .waitForSelector("h1", { timeout: 15000 })
      .catch(() => null);

    await page.waitForTimeout(2000);

    const details = await page.evaluate(() => {
      const getText = (selector: string): string =>
        document.querySelector(selector)?.textContent?.trim() || "";

      const name =
        document.querySelector("h1")?.textContent?.trim() ||
        document.title.split("|")[0]?.trim() ||
        "";

      // Rating and reviews
      const ratingText = document.body.textContent || "";
      const ratingMatch = ratingText.match(
        /(\d\.\d)\s*(?:based on|from|\()\s*([\d,]+)\s*(?:reviews?|ratings?)/i
      );
      const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 0;
      const reviewCount = ratingMatch
        ? parseInt(ratingMatch[2].replace(",", ""))
        : 0;

      // Description
      const descEl = document.querySelector(
        '[class*="description"], [class*="Description"], [class*="about"] p, [data-test="restaurant-description"]'
      );
      const description = descEl?.textContent?.trim() || "";

      // Address
      const addressEl = document.querySelector(
        '[class*="address"], [class*="Address"], address, [data-test="restaurant-address"]'
      );
      const address = addressEl?.textContent?.trim() || "";

      // Tags (neighborhood gem, lively, etc.)
      const tagEls = document.querySelectorAll(
        '[class*="tag"], [class*="Tag"], [class*="badge"], [class*="Badge"]'
      );
      const tags: string[] = [];
      for (const el of tagEls) {
        const t = el.textContent?.trim();
        if (t && t.length < 50) tags.push(t);
      }

      // Price range
      const priceEl = document.querySelector(
        '[class*="price"], [class*="Price"]'
      );
      const priceRange =
        priceEl?.textContent?.trim() ||
        (document.body.textContent?.match(/(\${2,4}|CAN\$[\d]+ and (?:under|over))/)?.[1] ?? "");

      // Cuisine
      const cuisineEl = document.querySelector(
        '[class*="cuisine"], [class*="Cuisine"]'
      );
      const cuisine = cuisineEl?.textContent?.trim() || "";

      // Neighborhood
      const neighborhoodEl = document.querySelector(
        '[class*="neighborhood"], [class*="Neighborhood"]'
      );
      const neighborhood = neighborhoodEl?.textContent?.trim() || "";

      // Restaurant info section (dining style, dress code, parking, etc.)
      const infoItems = document.querySelectorAll(
        '[class*="InfoItem"], [class*="info-item"], [class*="detail-item"], [class*="DetailItem"]'
      );
      let diningStyle = "";
      let dressCode = "";
      let parking = "";
      let paymentOptions = "";
      let website = "";
      let phone = "";

      for (const item of infoItems) {
        const text = item.textContent?.trim().toLowerCase() || "";
        const value = item.textContent?.trim() || "";
        if (text.includes("dining style")) diningStyle = value.replace(/dining style/i, "").trim();
        if (text.includes("dress code")) dressCode = value.replace(/dress code/i, "").trim();
        if (text.includes("parking")) parking = value.replace(/parking/i, "").trim();
        if (text.includes("payment")) paymentOptions = value.replace(/payment/i, "").trim();
        if (text.includes("website")) website = value.replace(/website/i, "").trim();
        if (text.includes("phone")) phone = value.replace(/phone/i, "").trim();
      }

      // Hours — try to extract from the page
      const hours: Record<string, string> = {};
      const hoursSection = document.querySelector(
        '[class*="Hours"], [class*="hours"], [class*="schedule"]'
      );
      if (hoursSection) {
        const rows = hoursSection.querySelectorAll("tr, [class*='row'], li");
        for (const row of rows) {
          const text = row.textContent?.trim() || "";
          const dayMatch = text.match(
            /(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)/i
          );
          if (dayMatch) {
            const day = dayMatch[1];
            const timeRange = text.replace(day, "").trim();
            if (timeRange) hours[day] = timeRange;
          }
        }
      }

      return {
        name,
        address,
        neighborhood,
        cuisine,
        priceRange,
        rating,
        reviewCount,
        description,
        hours,
        diningStyle: diningStyle || undefined,
        dressCode: dressCode || undefined,
        parking: parking || undefined,
        paymentOptions: paymentOptions || undefined,
        website: website || undefined,
        phone: phone || undefined,
        tags,
      };
    });

    return details;
  });
}
