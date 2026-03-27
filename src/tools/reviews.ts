import { withPage } from "../browser.js";
import type { Review, ReviewSummary } from "../types.js";

export async function getRestaurantReviews(params: {
  restaurantUrl: string;
  maxReviews?: number;
  sortBy?: "newest" | "highest" | "lowest";
}): Promise<ReviewSummary> {
  return withPage(async (page) => {
    const { restaurantUrl, maxReviews = 10, sortBy = "newest" } = params;

    // Navigate to the restaurant page
    await page.goto(restaurantUrl, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    await page.waitForTimeout(2000);

    // Click on Reviews tab if it exists
    await page
      .locator(
        'a[href*="review"], button:has-text("Reviews"), [data-test*="review"]'
      )
      .first()
      .click({ timeout: 5000 })
      .catch(() => null);

    await page.waitForTimeout(2000);

    // Try sorting if the option exists
    if (sortBy === "newest") {
      await page
        .locator('select[class*="sort"], [data-test*="sort"]')
        .selectOption({ label: "Newest" })
        .catch(() => null);
      await page.waitForTimeout(1000);
    }

    const result = await page.evaluate(
      (maxCount: number) => {
        // Extract overall rating summary
        const bodyText = document.body.textContent || "";

        const overallMatch = bodyText.match(
          /(\d\.\d)\s*(?:based on|from|\()\s*([\d,]+)/i
        );
        const overall = overallMatch ? parseFloat(overallMatch[1]) : 0;
        const totalReviews = overallMatch
          ? parseInt(overallMatch[2].replace(",", ""))
          : 0;

        // Try to find dimensional ratings
        const findDimensionRating = (dimension: string): number => {
          const pattern = new RegExp(
            `${dimension}[:\\s]*(\\d\\.\\d)`,
            "i"
          );
          const match = bodyText.match(pattern);
          return match ? parseFloat(match[1]) : 0;
        };

        const food = findDimensionRating("food");
        const service = findDimensionRating("service");
        const ambience = findDimensionRating("ambience");
        const value = findDimensionRating("value");

        // Noise level
        const noiseMatch = bodyText.match(
          /noise[:\s]*(quiet|moderate|energetic|loud)/i
        );
        const noise = noiseMatch ? noiseMatch[1] : "";

        // Extract individual reviews
        const reviews: Array<{
          rating: number;
          date: string;
          text: string;
          diningDate?: string;
          foodRating?: number;
          serviceRating?: number;
          ambienceRating?: number;
          valueRating?: number;
          noise?: string;
        }> = [];

        const reviewEls = document.querySelectorAll(
          '[class*="Review"]:not([class*="ReviewSummary"]), [data-test*="review-item"], [class*="review-item"], [class*="reviewItem"]'
        );

        for (const el of reviewEls) {
          if (reviews.length >= maxCount) break;

          const text =
            el.querySelector(
              "p, [class*='body'], [class*='Body'], [class*='text'], [class*='Text'], [class*='comment']"
            )?.textContent?.trim() || "";

          if (!text || text.length < 10) continue;

          const ratingEl = el.querySelector(
            '[class*="rating"], [class*="Rating"], [class*="star"]'
          );
          const ratingText = ratingEl?.textContent?.trim() || "";
          const rMatch = ratingText.match(/([\d.]+)/);
          const reviewRating = rMatch ? parseFloat(rMatch[1]) : 0;

          const dateEl = el.querySelector(
            '[class*="date"], [class*="Date"], time'
          );
          const dateText = dateEl?.textContent?.trim() || "";

          const diningDateEl = el.querySelector(
            '[class*="dining"], [class*="Dining"]'
          );
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

    return result;
  });
}
