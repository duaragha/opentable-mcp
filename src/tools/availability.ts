import { withPage, gotoOpenTable, isOpenTableUrl } from "../browser.js";
import type { Availability, TimeSlot } from "../types.js";

/** Normalize time strings like "3:00 p.m.", "15:00", "3:00 PM" to "3:00 PM" format */
function normalizeTime(raw: string): string {
  // Strip extra whitespace and common suffixes
  let t = raw.replace(/\s+/g, " ").replace(/\+[\d,]+\s*pts?/i, "").trim();

  // Already in 12-hour format like "3:00 p.m." or "3:00 PM"
  const match12 = t.match(/^(\d{1,2}:\d{2})\s*(p\.?m\.?|a\.?m\.?|PM|AM)$/i);
  if (match12) {
    const period = match12[2].replace(/\./g, "").toUpperCase();
    return `${match12[1]} ${period}`;
  }

  // 24-hour format like "15:00"
  const match24 = t.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    let hour = parseInt(match24[1]);
    const min = match24[2];
    const period = hour >= 12 ? "PM" : "AM";
    if (hour > 12) hour -= 12;
    if (hour === 0) hour = 12;
    return `${hour}:${min} ${period}`;
  }

  return t;
}

export async function checkAvailability(params: {
  restaurantUrl: string;
  date: string;
  time: string;
  partySize: number;
}): Promise<Availability> {
  const { restaurantUrl, date, time, partySize } = params;

  if (!isOpenTableUrl(restaurantUrl)) {
    throw new Error(`Invalid URL: must be an OpenTable restaurant URL (e.g. https://www.opentable.com/r/restaurant-name). Got: ${restaurantUrl}`);
  }

  return withPage(async (page) => {
    const url = new URL(restaurantUrl);
    url.searchParams.set("dateTime", `${date}T${time}`);
    url.searchParams.set("covers", partySize.toString());

    // Intercept availability API responses
    const interceptedSlots: TimeSlot[] = [];

    page.on("response", (response) => {
      const reqUrl = response.url();
      if (
        reqUrl.includes("availability") ||
        reqUrl.includes("timeslot") ||
        reqUrl.includes("slot")
      ) {
        response.json().then((json) => {
          const slots =
            json.availability?.timeslots ||
            json.timeslots ||
            json.data?.availability?.timeslots ||
            json.slots ||
            [];
          for (const slot of slots) {
            const slotTime = slot.dateTime || slot.time || slot.startTime || "";
            const timeStr = slotTime.includes("T")
              ? slotTime.split("T")[1]?.substring(0, 5)
              : slotTime;
            if (timeStr) {
              interceptedSlots.push({
                time: normalizeTime(timeStr),
                type: slot.type || slot.slotType || "standard",
              });
            }
          }
        }).catch(() => {});
      }
    });

    await gotoOpenTable(page, url.toString());

    // Wait for time slots or a "no availability" indicator
    await page
      .waitForSelector(
        '[data-test="time-slot"], [class*="TimeSlot"], [class*="timeslot"], button[data-time], [class*="NoAvailability"], [data-test*="notify"]',
        { timeout: 15000 }
      )
      .catch(() => null);

    // Let any remaining API calls finish
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => null);

    // Parse time slots from the DOM
    const domSlots = await page.evaluate(() => {
      const slots: Array<{ time: string; type: string }> = [];

      const selectors = [
        '[data-test="time-slot"]',
        '[class*="TimeSlot"] button',
        '[class*="timeslot"] button',
        'button[data-time]',
        'button[class*="slot"]',
        '[data-test*="slot"]',
      ];

      for (const selector of selectors) {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          const timeText = el.textContent?.trim() || "";
          // Match individual time patterns — avoid concatenated strings
          const timeMatch = timeText.match(
            /^(\d{1,2}:\d{2}\s*(?:p\.?m\.?|a\.?m\.?|PM|AM)?)$/i
          );
          if (timeMatch) {
            slots.push({
              time: timeMatch[1].trim(),
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

    // Check for status messages
    const statusMessage = await page.evaluate(() => {
      const noAvail = document.querySelector(
        '[class*="NoAvailability"], [class*="no-availability"], [data-test="no-availability"]'
      );
      if (noAvail) return noAvail.textContent?.trim() || "No availability";

      const notifyMe = document.querySelector(
        'button[class*="notify"], [class*="Notify"], [data-test*="notify"]'
      );
      if (notifyMe) return "No exact match — Notify Me option available";

      const body = document.body.textContent || "";
      if (body.includes("no times available")) return "No times available for this selection";
      if (body.includes("Notify me")) return "Limited availability — Notify Me option shown";

      return null;
    });

    const restaurantName = await page.evaluate(() => {
      return (
        document.querySelector("h1")?.textContent?.trim() ||
        document.title.split("|")[0]?.trim() ||
        ""
      );
    });

    // Normalize and deduplicate across both sources
    const allSlots = [
      ...interceptedSlots,
      ...domSlots.map((s) => ({ ...s, time: normalizeTime(s.time) })),
    ];
    const seen = new Set<string>();
    const uniqueSlots = allSlots.filter((s) => {
      if (seen.has(s.time)) return false;
      seen.add(s.time);
      return true;
    });

    // Build a direct booking URL with params pre-filled
    const bookingUrl = new URL(restaurantUrl);
    bookingUrl.searchParams.set("dateTime", `${date}T${time}`);
    bookingUrl.searchParams.set("covers", partySize.toString());

    return {
      restaurantName,
      url: restaurantUrl,
      bookingUrl: bookingUrl.toString(),
      date,
      requestedTime: time,
      partySize,
      timeSlots: uniqueSlots,
      message: statusMessage || undefined,
    };
  });
}
