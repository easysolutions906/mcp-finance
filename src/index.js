#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import * as currency from './tools/currency.js';

const server = new McpServer({
  name: 'mcp-finance',
  version: '1.0.0',
});

// --- Currency Tools ---

server.tool(
  'currency_convert',
  'Convert an amount between two currencies using live exchange rates from Frankfurter API. Returns the conversion rate, result, and rate date.',
  {
    from: z.string().describe('Source currency code, 3 uppercase letters (e.g., "USD", "EUR", "GBP")'),
    to: z.string().describe('Target currency code, 3 uppercase letters (e.g., "EUR", "JPY", "CAD")'),
    amount: z.number().optional().describe('Amount to convert (default 1)'),
  },
  async ({ from, to, amount }) => ({
    content: [{ type: 'text', text: JSON.stringify(await currency.convert(from, to, amount), null, 2) }],
  }),
);

server.tool(
  'currency_rates',
  'Get all current exchange rates for a base currency. Returns rates for ~30 currencies from Frankfurter API (European Central Bank data).',
  {
    base: z.string().optional().describe('Base currency code, 3 uppercase letters (default "USD")'),
  },
  async ({ base }) => ({
    content: [{ type: 'text', text: JSON.stringify(await currency.rates(base), null, 2) }],
  }),
);

server.tool(
  'currency_list',
  'List all supported currency codes and their full names. Frankfurter supports ~30 currencies based on European Central Bank reference rates.',
  {},
  async () => ({
    content: [{ type: 'text', text: JSON.stringify(await currency.list(), null, 2) }],
  }),
);

server.tool(
  'currency_historical',
  'Get historical exchange rates for a specific past date. Uses European Central Bank reference rates. Data available from 1999-01-04 onwards.',
  {
    date: z.string().describe('Date in YYYY-MM-DD format (e.g., "2024-01-15"). Must be a past date.'),
    base: z.string().optional().describe('Base currency code, 3 uppercase letters (default "USD")'),
  },
  async ({ date, base }) => ({
    content: [{ type: 'text', text: JSON.stringify(await currency.historical(date, base), null, 2) }],
  }),
);

// --- Start ---

const main = async () => {
  const transport = new StdioServerTransport();
  await server.connect(transport);
};

main().catch((err) => {
  console.error('Failed to start MCP finance server:', err);
  process.exit(1);
});
