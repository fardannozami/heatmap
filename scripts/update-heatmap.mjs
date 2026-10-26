#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const DATA_FILE = new URL('../public/data/heatmap.json', import.meta.url);
const SYMBOL = process.env.YAHOO_SYMBOL || 'GC=F';
const INTERVAL = process.env.YAHOO_INTERVAL || '5m';
const LOOKBACK_DAYS = Number(process.env.YAHOO_DAYS || 59);
const PIP_SIZE = Number(process.env.GOLD_PIP_SIZE || 0.01);
const HORIZON_HOURS = Number(process.env.GOLD_HORIZON_HOURS || 24);
const PERIOD_LABEL = process.env.HEATMAP_PERIOD || '3 Bulan';

function arg(name, fallback) {
  const prefix = `--${name}=`;
  const found = process.argv.find((item) => item.startsWith(prefix));
  return found ? found.slice(prefix.length) : fallback;
}

const symbol = arg('symbol', SYMBOL);
const interval = arg('interval', INTERVAL);
const days = Number(arg('days', LOOKBACK_DAYS));
const pipSize = Number(arg('pip-size', PIP_SIZE));
const horizonHours = Number(arg('horizon-hours', HORIZON_HOURS));
const periodLabel = arg('period', PERIOD_LABEL);
const csvFile = arg('csv', '');

if (!Number.isFinite(days) || days < 1 || days > 60) {
  throw new Error('--days harus antara 1 dan 60 karena batas Yahoo Finance untuk data intraday.');
}
if (!Number.isFinite(pipSize) || pipSize <= 0) throw new Error('--pip-size harus lebih besar dari 0.');

let candles;
let sourceLabel;
if (csvFile) {
  const text = await readFile(resolve(csvFile), 'utf8');
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean);
  const delimiter = lines[0]?.includes(';') ? ';' : ',';
  const header = lines.shift().split(delimiter).map((item) => item.trim().toLowerCase());
  const indexOf = (...names) => names.map((name) => header.indexOf(name)).find((index) => index >= 0);
  const timeIndex = indexOf('timestamp', 'time', 'datetime', 'date');
  const openIndex = indexOf('open');
  const highIndex = indexOf('high');
  const lowIndex = indexOf('low');
  const closeIndex = indexOf('close');
  if ([timeIndex, openIndex, highIndex, lowIndex, closeIndex].some((index) => index === undefined)) {
    throw new Error('CSV harus memiliki kolom timestamp, open, high, low, close.');
  }
  const parseTimestamp = (value) => {
    const trimmed = value.trim();
    if (/^\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed) * 1000;
    const parsed = Date.parse(trimmed.replace(/\./g, '-').replace(' ', 'T') + 'Z');
    return parsed;
  };
  candles = lines.map((line) => {
    const values = line.split(delimiter).map((item) => item.trim());
    return {
      timestamp: parseTimestamp(values[timeIndex]),
      open: Number(values[openIndex]),
      high: Number(values[highIndex]),
      low: Number(values[lowIndex]),
      close: Number(values[closeIndex]),
    };
  }).filter((candle) => Number.isFinite(candle.timestamp) && [candle.open, candle.high, candle.low, candle.close].every(Number.isFinite))
    .sort((a, b) => a.timestamp - b.timestamp);
  sourceLabel = `HFM MT5 CSV (${csvFile})`;
} else {
  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`);
  url.search = new URLSearchParams({
    period1: String(Math.floor(start.getTime() / 1000)),
    period2: String(Math.floor(end.getTime() / 1000)),
    interval,
    events: 'history',
    includePrePost: 'true',
  }).toString();
  const response = await fetch(url, { headers: { 'User-Agent': 'TM-Chrono-Heatmap/1.0' } });
  if (!response.ok) throw new Error(`Yahoo Finance HTTP ${response.status}`);
  const payload = await response.json();
  const result = payload.chart?.result?.[0];
  if (!result) throw new Error(payload.chart?.error?.description || 'Yahoo tidak mengembalikan data.');
  const quote = result.indicators?.quote?.[0];
  const timestamps = result.timestamp || [];
  candles = timestamps.map((timestamp, index) => ({
    timestamp: timestamp * 1000,
    open: quote?.open?.[index],
    high: quote?.high?.[index],
    low: quote?.low?.[index],
    close: quote?.close?.[index],
  })).filter((candle) => [candle.open, candle.high, candle.low, candle.close].every(Number.isFinite));
  sourceLabel = `Yahoo Finance ${symbol} (${interval})`;
}

if (candles.length < 20) throw new Error('Data candle dari Yahoo terlalu sedikit untuk menghitung heatmap.');

const wib = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false,
});
const dateWib = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit',
});
const toTimeIndex = (timestamp) => {
  const parts = wib.formatToParts(new Date(timestamp));
  const hour = Number(parts.find((part) => part.type === 'hour').value);
  const minute = Number(parts.find((part) => part.type === 'minute').value);
  return hour * 60 + minute;
};
const toDate = (timestamp) => dateWib.format(new Date(timestamp));

const targets = [50, 100, 150, 200, 250, 300, 350, 400, 450, 500];
const horizonMs = horizonHours * 60 * 60 * 1000;
const buckets = Array.from({ length: 1440 }, () => targets.map(() => ({ up: 0, down: 0, voids: 0 })));

for (let i = 0; i < candles.length; i += 1) {
  const seed = candles[i];
  const row = buckets[toTimeIndex(seed.timestamp)];
  for (let targetIndex = 0; targetIndex < targets.length; targetIndex += 1) {
    const distance = targets[targetIndex] * pipSize;
    let upHit = false;
    let downHit = false;
    for (let j = i + 1; j < candles.length && candles[j].timestamp <= seed.timestamp + horizonMs; j += 1) {
      if (candles[j].high >= seed.open + distance) upHit = true;
      if (candles[j].low <= seed.open - distance) downHit = true;
      if (upHit || downHit) break;
    }
    if (upHit && !downHit) row[targetIndex].up += 1;
    else if (downHit && !upHit) row[targetIndex].down += 1;
    else row[targetIndex].voids += 1;
  }
}

const cells = buckets.map((row) => row.map((bucket) => {
  const observations = bucket.up + bucket.down;
  if (!observations) return ['NEUTRAL', 50, 0, bucket.voids];
  if (bucket.up === bucket.down) return ['NEUTRAL', 50, observations, bucket.voids];
  const direction = bucket.up > bucket.down ? 'UP' : 'DOWN';
  const winning = Math.max(bucket.up, bucket.down);
  return [direction, Number((winning / observations * 100).toFixed(2)), observations, bucket.voids];
}));

const data = JSON.parse(await readFile(DATA_FILE, 'utf8'));
const period = data.periods.find((item) => item.label === periodLabel);
if (!period) throw new Error(`Periode "${periodLabel}" tidak ditemukan di heatmap.json.`);

period.cells = cells;
period.from = toDate(candles[0].timestamp);
period.until = toDate(candles.at(-1).timestamp);
data.last_updated = new Date().toISOString().replace('T', ' ').slice(0, 16);
data.source = sourceLabel;
data.encoding_note = `Each cell is [direction, probability_percent, observations, voids]. Generated from ${sourceLabel}; direction uses the first +/- target barrier within the configured horizon.`;

await writeFile(DATA_FILE, `${JSON.stringify(data)}\n`);
console.log(`Updated ${periodLabel}: ${period.from} -> ${period.until}`);
console.log(`Source: ${sourceLabel}, candles: ${candles.length}`);
console.log(`File: ${DATA_FILE.pathname}`);
