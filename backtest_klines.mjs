import { OpenApiClient } from "gmgn-cli/dist/client/OpenApiClient.js";
import { getConfig } from "gmgn-cli/dist/config.js";

const TOKEN = "B6f27ETGcjgGNB1fqULJbXVmw9FnL8HgBp7R83hmpump";
const CANDLES = 233;
const RESOLUTION = "30m"; // try 30m

const client = new OpenApiClient(getConfig());

async function main() {
  const fromMs = Date.now() - CANDLES * 30 * 60 * 1000;
  let data;
  try {
    data = await client.getTokenKline("sol", TOKEN, RESOLUTION, fromMs);
  } catch (e) {
    console.error("GMGN 30m error:", e.message);
    console.log("\nTrying 15m instead...");
    data = await client.getTokenKline("sol", TOKEN, "15m", Date.now() - 233 * 15 * 60 * 1000);
  }

  const bars = data?.list;
  if (!bars || bars.length === 0) {
    console.log("No kline data returned");
    return;
  }

  console.log(`Got ${bars.length} candles\n`);

  const klines = bars.map((b, i) => ({
    idx: i,
    time: new Date(b.time).toISOString().slice(0, 19).replace("T", " "),
    open: parseFloat(b.open),
    close: parseFloat(b.close),
    high: parseFloat(b.high),
    low: parseFloat(b.low),
    vol: parseFloat(b.volume ?? 0),
  }));

  // Rolling SMA20 (need at least 20 candles)
  const results = [];
  for (let i = 19; i < klines.length; i++) {
    const window = klines.slice(i - 19, i + 1); // 20 candles for SMA
    const sma20 = window.reduce((s, k) => s + k.close, 0) / 20;
    const candle = klines[i];

    // Point 1: ada close yg > SMA20*1.20 di 20 candle ini?
    const above120pct = window.filter(k => k.close > sma20 * 1.20).length;

    // Point 2: latest close (candle ini) antara SMA20*1.20 dan SMA20*1.45?
    const pctAboveSMA = (candle.close / sma20 - 1) * 100;
    const p2Pass = pctAboveSMA >= 20 && pctAboveSMA <= 45;

    results.push({
      idx: candle.idx,
      time: candle.time,
      close: candle.close.toFixed(6),
      sma20: sma20.toFixed(6),
      pctAbove: pctAboveSMA.toFixed(2),
      p2Pass: p2Pass ? "✅" : "❌",
      above120count: above120pct,
    });
  }

  // Print summary
  const total = results.length;
  const p2PassCount = results.filter(r => r.p2Pass === "✅").length;
  const p1Triggered = results.filter(r => r.above120count > 0).length;

  console.log(`=== RESULTS (${total} SMA20 windows) ===`);
  console.log(`Point 1 (bullish candle > SMA*1.20 in window): ${p1Triggered}/${total} windows`);
  console.log(`Point 2 (close between SMA*1.20-1.45): ${p2PassCount}/${total} candles`);
  console.log("");

  // Print every candle that triggers point 2
  console.log("=== Point 2: PASS entries ===");
  const p2 = results.filter(r => r.p2Pass === "✅");
  for (const r of p2) {
    console.log(`  #${r.idx} ${r.time} close:${r.close} SMA:${r.sma20} ${r.pctAbove}% above SMA | P1: ${r.above120count} bullish candles`);
  }
  console.log("");

  // Print candles near the boundary (17-23% or 43-47%) for context
  console.log("=== Near entry range edges (17-23% or 43-47%) ===");
  const edges = results.filter(r => {
    const p = parseFloat(r.pctAbove);
    return (p >= 17 && p < 23) || (p >= 43 && p < 47);
  }).slice(0, 10);
  for (const r of edges) {
    console.log(`  #${r.idx} ${r.time} close:${r.close} SMA:${r.sma20} ${r.pctAbove}% | P2:${r.p2Pass} P1:${r.above120count}`);
  }
  console.log("");

  // Print last 10 candles
  console.log("=== Last 10 candles ===");
  for (const r of results.slice(-10)) {
    console.log(`  #${r.idx} ${r.time} close:${r.close} SMA:${r.sma20} ${r.pctAbove}% | P2:${r.p2Pass} P1:${r.above120count}`);
  }
}

main().catch(console.error);
