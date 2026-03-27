#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { searchRestaurants } from "./tools/search.js";
import { checkAvailability } from "./tools/availability.js";
import { getRestaurantDetails } from "./tools/details.js";
import { getRestaurantMenu } from "./tools/menu.js";
import { getRestaurantReviews } from "./tools/reviews.js";
import { closeBrowser } from "./browser.js";

const server = new McpServer({
  name: "opentable-mcp",
  version: "1.0.0",
});

server.registerTool(
  "search_restaurants",
  {
    description:
      "Search OpenTable for restaurants by query, location, cuisine type, etc. Returns a list of matching restaurants with basic info.",
    inputSchema: {
      query: z
        .string()
        .describe(
          "Search query — restaurant name, cuisine type, or keywords (e.g. 'Italian', 'sushi', 'Trattoria Nervosa')"
        ),
      location: z
        .string()
        .describe(
          "City or neighborhood to search in (e.g. 'Toronto', 'Yorkville Toronto')"
        ),
      date: z
        .string()
        .optional()
        .describe("Date in YYYY-MM-DD format (e.g. '2026-04-04')"),
      time: z
        .string()
        .optional()
        .describe("Time in HH:MM format, 24-hour (e.g. '19:00')"),
      partySize: z
        .number()
        .optional()
        .describe("Number of guests (e.g. 5)"),
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: true,
    },
  },
  async (params) => {
    try {
      const results = await searchRestaurants(params);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(results, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error searching restaurants: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "check_availability",
  {
    description:
      "Check available reservation time slots for a specific restaurant on OpenTable. Returns the available times closest to your requested time.",
    inputSchema: {
      restaurantUrl: z
        .string()
        .describe(
          "Full OpenTable restaurant URL (e.g. 'https://www.opentable.ca/r/trattoria-nervosa-toronto')"
        ),
      date: z
        .string()
        .describe("Date in YYYY-MM-DD format (e.g. '2026-04-04')"),
      time: z
        .string()
        .describe(
          "Desired time in HH:MM format, 24-hour (e.g. '15:00' for 3pm)"
        ),
      partySize: z
        .number()
        .describe("Number of guests (e.g. 5)"),
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: true,
    },
  },
  async (params) => {
    try {
      const result = await checkAvailability(params);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error checking availability: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "get_restaurant_details",
  {
    description:
      "Get detailed information about a restaurant including hours, address, price range, cuisine, dress code, parking, and more.",
    inputSchema: {
      restaurantUrl: z
        .string()
        .describe(
          "Full OpenTable restaurant URL (e.g. 'https://www.opentable.ca/r/sotto-sotto-ristorante')"
        ),
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: true,
    },
  },
  async (params) => {
    try {
      const result = await getRestaurantDetails(params);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error getting restaurant details: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "get_restaurant_menu",
  {
    description:
      "Get the menu for a restaurant, including section names, item names, descriptions, and prices.",
    inputSchema: {
      restaurantUrl: z
        .string()
        .describe(
          "Full OpenTable restaurant URL (e.g. 'https://www.opentable.ca/r/blu-ristorante-toronto')"
        ),
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: true,
    },
  },
  async (params) => {
    try {
      const result = await getRestaurantMenu(params);
      if (result.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No menu data found on the OpenTable page. The restaurant may not have uploaded their menu, or it may be in a non-standard format.",
            },
          ],
        };
      }
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error getting menu: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "get_restaurant_reviews",
  {
    description:
      "Get reviews and ratings for a restaurant, including overall score, dimensional ratings (food, service, ambience, value), noise level, and individual review text.",
    inputSchema: {
      restaurantUrl: z
        .string()
        .describe(
          "Full OpenTable restaurant URL (e.g. 'https://www.opentable.ca/r/la-vecchia-toronto')"
        ),
      maxReviews: z
        .number()
        .optional()
        .describe("Maximum number of individual reviews to return (default: 10)"),
      sortBy: z
        .enum(["newest", "highest", "lowest"])
        .optional()
        .describe("Sort order for reviews (default: 'newest')"),
    },
    annotations: {
      readOnlyHint: true,
      openWorldHint: true,
    },
  },
  async (params) => {
    try {
      const result = await getRestaurantReviews(params);
      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Error getting reviews: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Cleanup browser on exit
process.on("SIGINT", async () => {
  await closeBrowser();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  await closeBrowser();
  process.exit(0);
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("OpenTable MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
