// node:sqlite deneysel uyarısını sustur (CLI çıktısını ve MCP stdio'yu temiz tutar)
process.removeAllListeners("warning");
process.on("warning", w => { if (!String(w.message).includes("SQLite")) console.error(`${w.name}: ${w.message}`); });
export {};
