# OpenTable MCP Server

An [MCP](https://modelcontextprotocol.io/) server that gives AI assistants the ability to search restaurants, check real-time reservation availability, pull menus, and read reviews directly from OpenTable — no API key required.

Built with [Playwright](https://playwright.dev/) for reliable data extraction from OpenTable's React frontend.

## Features

- **Search** restaurants by name, cuisine, location, date, time, and party size
- **Check availability** for a specific restaurant, date, time, and party size — returns actual bookable time slots
- **Get restaurant details** including hours, address, price range, dress code, parking, and more
- **Pull menus** with sections, item names, descriptions, and prices
- **Read reviews** with overall scores, dimensional ratings (food, service, ambience, value), noise level, and individual review text

## Tools

| Tool | Description | Parameters |
|------|-------------|------------|
| `search_restaurants` | Search OpenTable for restaurants | `query`, `location`, `date?`, `time?`, `partySize?` |
| `check_availability` | Check available reservation time slots | `restaurantUrl`, `date`, `time`, `partySize` |
| `get_restaurant_details` | Get full restaurant info (hours, address, etc.) | `restaurantUrl` |
| `get_restaurant_menu` | Pull the current menu | `restaurantUrl` |
| `get_restaurant_reviews` | Get ratings and review text | `restaurantUrl`, `maxReviews?`, `sortBy?` |

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/) (recommended) or [Node.js](https://nodejs.org/) 18+
- Playwright's bundled Chromium (installed automatically in the setup steps below), or a Chromium-based browser (Edge, Chrome)

### 1. Clone and build

```bash
git clone https://github.com/duaragha/opentable-mcp.git
cd opentable-mcp
bun install
bunx playwright install chromium
bun run build
```

<details>
<summary>Using npm instead of bun</summary>

```bash
git clone https://github.com/duaragha/opentable-mcp.git
cd opentable-mcp
npm install
npx playwright install chromium
npm run build
```

</details>

### 2. Connect to your AI client

Choose one of the following:

#### Claude Code (CLI)

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "opentable": {
      "command": "bun",
      "args": ["/absolute/path/to/opentable-mcp/build/index.js"]
    }
  }
}
```

#### Claude Desktop

Add to your `claude_desktop_config.json`:

| OS | Config path |
|----|-------------|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |
| Linux | `~/.config/Claude/claude_desktop_config.json` |

```json
{
  "mcpServers": {
    "opentable": {
      "command": "bun",
      "args": ["/absolute/path/to/opentable-mcp/build/index.js"]
    }
  }
}
```

#### Cursor / Windsurf / Other MCP clients

Follow your client's MCP server configuration docs. The server communicates over **stdio** using the standard MCP protocol.

```json
{
  "command": "bun",
  "args": ["/absolute/path/to/opentable-mcp/build/index.js"]
}
```

### 3. Configure browser (recommended)

**Important:** OpenTable's anti-bot protection may block Playwright's bundled Chromium. Using a locally installed browser (Edge or Chrome) is recommended for reliable results. Configure via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENTABLE_BROWSER_CHANNEL` | *(bundled Chromium)* | Browser to use: `msedge`, `chrome`, or omit for Chromium |
| `OPENTABLE_LOCALE` | `en-US` | Browser locale (e.g. `en-CA`, `en-GB`, `fr-FR`) |
| `OPENTABLE_TIMEZONE` | *(system timezone)* | IANA timezone (e.g. `America/Toronto`, `Europe/London`) |

Example with Edge (recommended):

```json
{
  "mcpServers": {
    "opentable": {
      "command": "bun",
      "args": ["/absolute/path/to/opentable-mcp/build/index.js"],
      "env": {
        "OPENTABLE_BROWSER_CHANNEL": "msedge",
        "OPENTABLE_LOCALE": "en-CA",
        "OPENTABLE_TIMEZONE": "America/Toronto"
      }
    }
  }
}
```

### 4. Restart your AI client

After adding the config, restart your client. The OpenTable tools should now be available.

## Usage Examples

Once connected, just talk to your AI assistant naturally:

### Search for restaurants

> "Find upscale Italian restaurants in Yorkville, Toronto"

> "Search for sushi places in Manhattan for 4 people next Friday at 7pm"

### Check reservation availability

> "Is there a table at Trattoria Nervosa for 5 people on April 4th at 3pm?"

> "Check availability at BLU Ristorante this Saturday evening for 2"

### Get restaurant details

> "What are the hours and dress code for Sotto Sotto?"

> "Tell me about Canoe restaurant — address, parking, price range"

### Pull a menu

> "Show me the dinner menu at GEORGE restaurant"

> "What vegetarian options does Amal have on their menu?"

### Read reviews

> "What do people say about La Vecchia? Pull the latest reviews"

> "Get the top-rated reviews for Miku Toronto"

## Tool Reference

### `search_restaurants`

Search OpenTable's restaurant directory.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | Yes | Restaurant name, cuisine, or keywords (e.g. `"Italian"`, `"Trattoria Nervosa"`) |
| `location` | string | Yes | City or neighborhood (e.g. `"Toronto"`, `"Yorkville Toronto"`) |
| `date` | string | No | Date in `YYYY-MM-DD` format |
| `time` | string | No | Time in `HH:MM` 24-hour format (e.g. `"19:00"`) |
| `partySize` | number | No | Number of guests |

**Returns:** Array of restaurants with name, URL, cuisine, price range, rating, review count, neighborhood.

---

### `check_availability`

Check real-time reservation availability for a specific restaurant.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `restaurantUrl` | string | Yes | Full OpenTable URL (e.g. `https://www.opentable.ca/r/trattoria-nervosa-toronto`) |
| `date` | string | Yes | Date in `YYYY-MM-DD` format |
| `time` | string | Yes | Desired time in `HH:MM` 24-hour format |
| `partySize` | number | Yes | Number of guests |

**Returns:** Restaurant name, requested parameters, available time slots, and any status messages (e.g. "No availability", "Notify Me").

---

### `get_restaurant_details`

Get comprehensive details about a restaurant.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `restaurantUrl` | string | Yes | Full OpenTable URL |

**Returns:** Name, address, neighborhood, cuisine, price range, rating, review count, description, hours, dining style, dress code, parking, payment options, website, phone, tags.

---

### `get_restaurant_menu`

Pull the restaurant's menu from OpenTable.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `restaurantUrl` | string | Yes | Full OpenTable URL |

**Returns:** Array of menu sections, each with section name and items (name, description, price).

> Note: Not all restaurants upload their full menu to OpenTable. If the menu is empty, try checking the restaurant's own website.

---

### `get_restaurant_reviews`

Get ratings and reviews for a restaurant.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `restaurantUrl` | string | Yes | Full OpenTable URL |
| `maxReviews` | number | No | Max reviews to return (default: 10) |
| `sortBy` | string | No | `"newest"`, `"highest"`, or `"lowest"` (default: `"newest"`) |

**Returns:** Overall rating, food/service/ambience/value scores, noise level, total review count, and individual reviews with text, date, and ratings.

## How It Works

OpenTable's website is a React/Next.js single-page app. Traditional HTTP scraping doesn't work because the content is rendered client-side and protected by anti-bot measures.

This server uses a **hybrid extraction approach**:

1. **Playwright browser automation** — launches a headless Chromium browser that loads pages like a real user
2. **Network interception** — captures the JSON API responses that OpenTable's frontend fetches from its own backend (cleaner and more structured than HTML)
3. **DOM parsing** — extracts data from the rendered page as a fallback when API interception doesn't capture everything

This makes it significantly more reliable than pure CSS-selector scraping, which breaks every time OpenTable changes their class names.

### Architecture

```
src/
  index.ts              # MCP server entry point, tool registration
  browser.ts            # Shared Playwright browser lifecycle
  types.ts              # TypeScript interfaces
  tools/
    search.ts           # search_restaurants implementation
    availability.ts     # check_availability implementation
    details.ts          # get_restaurant_details implementation
    menu.ts             # get_restaurant_menu implementation
    reviews.ts          # get_restaurant_reviews implementation
```

## Development

```bash
# Watch mode — recompiles on file changes
bun run dev

# One-time build
bun run build

# Run the server directly
bun run start
```

### Testing with MCP Inspector

The [MCP Inspector](https://github.com/modelcontextprotocol/inspector) lets you test tools interactively without an AI client:

```bash
bunx @modelcontextprotocol/inspector bun build/index.js
```

This opens a web UI where you can list tools, fill in parameters, and see raw responses.

### Debugging

The server logs to `stderr` (not `stdout`, which is reserved for MCP protocol messages). To see logs:

```bash
bun build/index.js 2>debug.log
```

## Troubleshooting

**"Browser not found" or Playwright errors**
```bash
bunx playwright install chromium
```

**Server doesn't start / no tools show up**

Make sure you built first:
```bash
bun run build
```

Verify the server initializes:
```bash
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | bun build/index.js
```

**Timeouts on OpenTable pages**

OpenTable can be slow to load. The default timeout is 30 seconds per page load. If you're on a slow connection, you may need to increase timeouts in the source.

**Empty results from search or menu**

OpenTable's page structure changes periodically. If a tool returns empty data, the CSS selectors may need updating. Open an issue or PR.

## Contributing

PRs welcome. If OpenTable changes their page structure and a tool breaks, the fix is usually updating the CSS selectors in the relevant `src/tools/*.ts` file.

## License

MIT
