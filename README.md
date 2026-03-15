# MCP Finance Server

A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server providing currency exchange tools for use with Claude Desktop, Cursor, and other MCP clients.

## Tools (4 total)

| Tool | Description |
|------|-------------|
| `currency_convert` | Convert an amount between two currencies (e.g., USD to EUR) |
| `currency_rates` | Get all exchange rates for a base currency |
| `currency_list` | List all 30+ supported currencies |
| `currency_historical` | Get historical rates for a specific date (back to 1999) |

## Install

```bash
npx @easysolutions906/mcp-finance
```

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "finance": {
      "command": "npx",
      "args": ["-y", "@easysolutions906/mcp-finance"]
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "finance": {
      "command": "npx",
      "args": ["-y", "@easysolutions906/mcp-finance"]
    }
  }
}
```

## Data Source

Exchange rates from the [Frankfurter API](https://www.frankfurter.app/) (European Central Bank reference rates). Supports 30+ currencies with rates cached for 1 hour.

## Transport

- **stdio** (default) — for local use with Claude Desktop and Cursor
- **HTTP** — set `PORT` env var to start in Streamable HTTP mode on `/mcp`
