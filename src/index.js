#!/usr/bin/env node

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import express from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import * as currency from './tools/currency.js';
import { authMiddleware, createKey, revokeKey, PLANS } from './keys.js';
import { createCheckoutSession, handleWebhook } from './stripe.js';

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

const TOOL_COUNT = 4;

const main = async () => {
  const port = process.env.PORT;

  if (port) {
    const app = express();
    app.use(express.json());

    app.get('/health', (_req, res) => {
      res.json({ status: 'ok' });
    });

    app.get('/', (_req, res) => {
      res.json({
        name: 'mcp-finance',
        version: '1.0.0',
        tools: TOOL_COUNT,
        transport: 'streamable-http',
        plans: PLANS,
      });
    });

    // --- Stripe checkout ---
    app.post('/checkout', async (req, res) => {
      try {
        const { plan, success_url, cancel_url } = req.body;
        const session = await createCheckoutSession(plan, success_url, cancel_url);
        res.json(session);
      } catch (err) {
        res.status(400).json({ error: err.message });
      }
    });

    // --- Stripe webhook (raw body needed for signature verification) ---
    app.post('/webhook/stripe', express.raw({ type: 'application/json' }), (req, res) => {
      try {
        const result = handleWebhook(req.body, req.headers['stripe-signature']);
        res.json({ received: true, result });
      } catch (err) {
        console.error('[webhook] Error:', err.message);
        res.status(400).json({ error: err.message });
      }
    });

    // --- Admin key management ---
    const adminAuth = (req, res, next) => {
      const secret = process.env.ADMIN_SECRET;
      if (!secret || req.headers['x-admin-secret'] !== secret) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      next();
    };

    app.post('/admin/keys', adminAuth, (req, res) => {
      const { plan, email } = req.body;
      const result = createKey(plan, email);
      res.json(result);
    });

    app.delete('/admin/keys/:key', adminAuth, (req, res) => {
      const revoked = revokeKey(req.params.key);
      res.json({ revoked });
    });

    const transports = {};

    app.post('/mcp', async (req, res) => {
      const sessionId = req.headers['mcp-session-id'];
      let transport = transports[sessionId];

      if (!transport) {
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
        });
        transport.onclose = () => {
          if (transport.sessionId) {
            delete transports[transport.sessionId];
          }
        };
        await server.connect(transport);
        transports[transport.sessionId] = transport;
      }

      await transport.handleRequest(req, res, req.body);
    });

    app.get('/mcp', async (req, res) => {
      const sessionId = req.headers['mcp-session-id'];
      const transport = transports[sessionId];
      if (!transport) {
        res.status(400).json({ error: 'No active session. Send a POST to /mcp first.' });
        return;
      }
      await transport.handleRequest(req, res);
    });

    app.delete('/mcp', async (req, res) => {
      const sessionId = req.headers['mcp-session-id'];
      const transport = transports[sessionId];
      if (!transport) {
        res.status(400).json({ error: 'No active session.' });
        return;
      }
      await transport.handleRequest(req, res);
    });

    app.listen(parseInt(port, 10), () => {
      console.log(`MCP finance server running on HTTP port ${port}`);
    });
  } else {
    const transport = new StdioServerTransport();
    await server.connect(transport);
  }
};

main().catch((err) => {
  console.error('Failed to start MCP finance server:', err);
  process.exit(1);
});
