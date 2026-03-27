import { withPage } from "../browser.js";
import type { Availability, TimeSlot } from "../types.js";

export async function checkAvailability(params: {
  restaurantUrl: string;
  date: string;
  time: string;
  partySize: number;
}): Promise<Availability> {
  return withPage(async (page) => {
    const { restaurantUrl, date, time, partySize } = params;

    // Build URL with reservation params
    const url = new URL(restaurantUrl);
    url.searchParams.set("dateTime", `${date}T${time}`);
    url.searchParams.set("covers", partySize.toString());

    // Intercept availability API responses
    const interceptedSlots: TimeSlot[] = [];

    page.on("response", async (response) => {
      const reqUrl = response.url();
      if (
        reqUrl.includes("availability") ||
        reqUrl.includes("timeslot") ||
        reqUrl.includes("slot")
      ) {
        try {
          const json = await response.json();
          // Try to extract slots from various response shapes
          const slots =
            json.availability?.timeslots ||
            json.timeslots ||
            json.data?.availability?.timeslots ||
            json.slots ||
            [];
          for (const slot of slots) {
            const slotTime =
              slot.dateTime || slot.time || slot.startTime || "";
            const timeStr = slotTime.includes("T")
              ? slotTime.split("T")[1]?.substring(0, 5)
              : slotTime;
            if (timeStr) {
              interceptedSlots.push({
                time: timeStr,
                type: slot.type || slot.slotType || "standard",
              });
            }
          }
        } catch {
          // Not JSON or unexpected shape — ignore
        }
      }
    });

    await page.goto(url.toString(), {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // Wait for the reservation widget to load
    await page
      .waitForSelector(
        '[data-test="time-slot"], [class*="TimeSlot"], [class*="timeslot"], button[data-time]',
        { timeout: 15000 }
      )
      .catch(() => null);

    await page.waitForTimeout(3000);

    // Parse time slots from the DOM as fallback/supplement
    const domSlots = await page.evaluate(() => {
      const slots: Array<{ time: string; type: string }> = [];

      // Try multiple selector strategies for time slot buttons
      const selectors = [
        '[data-test="time-slot"]',
        '[class*="TimeSlot"] button',
        '[class*="timeslot"] button',
        'button[data-time]',
        '[class*="slot"] button',
        // OpenTable often renders slots as colored buttons with time text
        'button[class*="slot"]',
        '[data-test*="slot"]',
      ];

      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          const timeText = el.textContent?.trim() || "";
          // Match time patterns like "7:00 p.m.", "19:00", "7:00 PM"
          const timeMatch = timeText.match(
            /(\d{1,2}:\d{2})\s*(p\.?m\.?|a\.?m\.?|PM|AM)?/i
          );
          if (timeMatch) {
            slots.push({
              time: timeText.trim(),
              type:
                el.getAttribute("data-type") ||
                el.getAttribute("data-test") ||
                "standard",
            });
          }
        }
      }

      return slots;
    });

    // Also check for "no availability" or "notify me" messages
    const statusMessage = await page.evaluate(() => {
      const noAvail = document.querySelector(
        '[class*="NoAvailability"], [class*="no-availability"], [data-test="no-availability"]'
      );
      if (noAvail) return noAvail.textContent?.trim() || "No availability";

      const notifyMe = document.querySelector(
        'button[class*="notify"], [class*="Notify"], [data-test*="notify"]'
      );
      if (notifyMe) return "No exact match — Notify Me option available";

      // Check for general availability messaging
      const body = document.body.textContent || "";
      if (body.includes("no times available")) return "No times available for this selection";
      if (body.includes("Notify me")) return "Limited availability — Notify Me option shown";

      return null;
    });

    // Get restaurant name from the page
    const restaurantName = await page.evaluate(() => {
      return (
        document.querySelector("h1")?.textContent?.trim() ||
        document.title.split("|")[0]?.trim() ||
        ""
      );
    });

    // Merge intercepted and DOM slots, deduplicate
    const allSlots = [...interceptedSlots, ...domSlots];
    const seen = new Set<string>();
    const uniqueSlots = allSlots.filter((s) => {
      const key = s.time;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return {
      restaurantName,
      date,
      requestedTime: time,
      partySize,
      timeSlots: uniqueSlots,
      message: statusMessage || undefined,
    };
  });
}
