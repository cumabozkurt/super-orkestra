# Limit senaryoları (S3/S4)
S3 — 429 devri: `MOCK_PLAN` = `{"opencode/nemotron-3-ultra-free":["429"],"opencode/mimo-v2.6-flash-free":["429"]}` → görev 3. işçiye devredilir.
S4 — hepsi limitte: üç işçiye `["limit"]` → görev `paused`, ~/.orkestra/resume-queue.json'a yazılır, sıfırlanınca aynı CLI oturumu devam eder.
```
MOCK_PLAN=plan.json MOCK_REAL=$(which opencode) ORKESTRA_BIN_OPENCODE=scripts/scenarios/mock-opencode.mjs \
ORKESTRA_TICK_MS=2000 node packages/cli/dist/index.js run "<görev>"
```
