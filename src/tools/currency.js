const CACHE_TTL_MS = 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10000;
const BASE_URL = 'https://api.frankfurter.app';

const cache = new Map();

const getCached = (key) => {
  const cached = cache.get(key);
  return (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) ? cached.data : null;
};

const setCache = (key, data) => {
  cache.set(key, { data, timestamp: Date.now() });
};

const fetchWithTimeout = async (url) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'MCP-Finance-Server/1.0',
        'Accept': 'application/json',
      },
    });
    if (!res.ok) { throw new Error(`Frankfurter API returned ${res.status}`); }
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
};

const fetchRates = async (base, date) => {
  const key = `rates-${base}-${date || 'latest'}`;
  const cached = getCached(key);
  if (cached) { return cached; }

  const url = date
    ? `${BASE_URL}/${date}?from=${base}`
    : `${BASE_URL}/latest?from=${base}`;

  const data = await fetchWithTimeout(url);
  setCache(key, data);
  return data;
};

const fetchCurrencies = async () => {
  const cached = getCached('currencies');
  if (cached) { return cached; }

  const data = await fetchWithTimeout(`${BASE_URL}/currencies`);
  setCache('currencies', data);
  return data;
};

export const convert = async (from, to, amount = 1) => {
  const base = from.toUpperCase();
  const target = to.toUpperCase();
  const data = await fetchRates(base);
  const rate = data.rates[target];

  if (!rate) {
    return { error: `Currency "${target}" not found in rates for ${base}` };
  }

  return {
    from: base,
    to: target,
    amount,
    rate,
    result: Math.round(amount * rate * 100) / 100,
    date: data.date,
  };
};

export const rates = async (base = 'USD') => {
  const data = await fetchRates(base.toUpperCase());
  return {
    base: data.base,
    date: data.date,
    total: Object.keys(data.rates).length,
    rates: data.rates,
  };
};

export const list = async () => {
  const currencies = await fetchCurrencies();
  return {
    total: Object.keys(currencies).length,
    currencies,
  };
};

export const historical = async (date, base = 'USD') => {
  const data = await fetchRates(base.toUpperCase(), date);
  return {
    base: data.base,
    date: data.date,
    total: Object.keys(data.rates).length,
    rates: data.rates,
  };
};
