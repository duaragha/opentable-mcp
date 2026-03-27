import { withPage, isOpenTableUrl } from "../browser.js";
import type { ReviewSummary } from "../types.js";

export async function getRestaurantReviews(params: {
  restaurantUrl: string;
  maxReviews?: number;
  sortBy?: "newest" | "highest" | "lowest";
}): Promise<ReviewSummary> {
  if (!isOpenTableUrl(params.restaurantUrl)) {
    throw new Error(`Invalid URL: must be an OpenTable restaurant URL. Got: ${params.restaurantUrl}`);
  }

  return withPage(async (page) => {
    const { restaurantUrl, maxReviews = 10, sortBy = "newest" } = params;

    await page.goto(restaurantUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => null);

    // Click on Reviews tab if it exists
    const reviewsTab = page.locator('a[href*="review"], button:has-text("Reviews"), [data-test*="review"]').first();
    const tabVisible = await reviewsTab.isVisible({ timeout: 5000 }).catch(() => false);

    if (tabVisible) {
      await reviewsTab.click();
      await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => null);
    }

    // Try sorting if the option exists
    if (sortBy === "newest") {
      await page
        .locator('select[class*="sort"], [data-test*="sort"]')
        .selectOption({ label: "Newest" })
        .catch(() => null);
      await page.waitForLoadState("networkidle", { timeout: 5000 }).catch(() => null);
    }

    const result = await page.evaluate(
      (maxCount: number) => {
        // Extract overall rating — look near the rating element, not full body
        let overall = 0;
        let totalReviews = 0;

        const ratingEl = document.querySelector('[class*="rating"], [class*="Rating"]');
        if (ratingEl) {
          const container = ratingEl.closest('[class*="header"], [class*="Header"], [class*="overview"], [class*="summary"]') || ratingEl.parentElement;
          const containerText = container?.textContent || "";
          const overallMatch = containerText.match(/(\d\.\d)/);
          if (overallMatch) overall = parseFloat(overallMatch[1]);
          const countMatch = containerText.match(/\(?([\d,]+)\)?\s*(?:reviews?|ratings?)/i);
          if (countMatch) totalReviews = parseInt(countMatch[1].replace(",", ""));
        }

        // Dimensional ratings — look for labeled rating elements specifically
        const findDimensionRating = (dimension: string): number => {
          const labels = document.querySelectorAll('[class*="label"], [class*="Label"], [class*="dimension"], [class*="Dimension"], dt, th');
          for (const label of labels) {
            if (label.textContent?.trim().toLowerCase() === dimension.toLowerCase()) {
              const sibling = label.nextElementSibling;
              const valueText = sibling?.textContent?.trim() || "";
              const match = valueText.match(/(\d\.\d)/);
              if (match) return parseFloat(match[1]);

              // Try parent container
              const parent = label.parentElement;
              const parentText = parent?.textContent?.trim() || "";
              const parentMatch = parentText.match(/(\d\.\d)/);
              if (parentMatch) return parseFloat(parentMatch[1]);
            }
          }
          return 0;
        };

        const food = findDimensionRating("food");
        const service = findDimensionRating("service");
        const ambience = findDimensionRating("ambience");
        const value = findDimensionRating("value");

        // Noise level
        const noiseLabels = document.querySelectorAll('[class*="noise"], [class*="Noise"]');
        let noise = "";
        for (const el of noiseLabels) {
          const text = el.textContent?.trim() || "";
          const match = text.match(/(quiet|moderate|energetic|loud)/i);
          if (match) { noise = match[1]; break; }
        }

        // Individual reviews
        const reviews: Array<{
          rating: number;
          date: string;
          text: string;
          diningDate?: string;
        }> = [];

        const reviewEls = document.querySelectorAll(
          '[class*="Review"]:not([class*="ReviewSummary"]):not([class*="ReviewCount"]), [data-test*="review-item"], [class*="review-item"], [class*="reviewItem"]'
        );

        for (const el of reviewEls) {
          if (reviews.length >= maxCount) break;

          const text =
            el.querySelector(
              "p, [class*='body'], [class*='Body'], [class*='text'], [class*='Text'], [class*='comment']"
            )?.textContent?.trim() || "";

          if (!text || text.length < 10) continue;

          const ratingEl = el.querySelector('[class*="rating"], [class*="Rating"], [class*="star"]');
          const ratingText = ratingEl?.textContent?.trim() || "";
          const rMatch = ratingText.match(/([\d.]+)/);
          const reviewRating = rMatch ? parseFloat(rMatch[1]) : 0;

          const dateEl = el.querySelector('[class*="date"], [class*="Date"], time');
          const dateText = dateEl?.textContent?.trim() || "";

          const diningDateEl = el.querySelector('[class*="dining"], [class*="Dining"]');
          const diningDate = diningDateEl?.textContent?.trim() || undefined;

          reviews.push({
            rating: reviewRating,
            date: dateText,
            text,
            diningDate,
          });
        }

        return {
          overall,
          food,
          service,
          ambience,
          value,
          totalReviews,
          noise,
          reviews,
        };
      },
      maxReviews
    );

    return { ...result, url: restaurantUrl };
  }, params.restaurantUrl);
}
