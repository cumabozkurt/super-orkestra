/**
 * Token tasarrufu kuralları (Anthropic/OpenAI belgelerine göre):
 *  - Sabit önek sırası: araçlar -> sistem -> proje hafızası -> görev. Önek değişmezse önbellek okuması ~0.1x fiyat
 *    ve Anthropic'te önbellek okumaları rate-limit'e sayılmaz.
 *  - Araç listesini görev başına değiştirme (önbellek kırılır); kısıtlamayı allowed_tools ile yap.
 *  - Yavaş işçiler için 1 saatlik TTL; şef için 5 dk.
 *  - Eski araç sonuçlarını temizle (clear_tool_uses) + sunucu tarafı compaction'a güven.
 *  - İşçiler arası devirde tam transcript değil, ≤300 token'lık özet taşınır.
 */
export function stablePrefix(parts: { tools: string; system: string; memory: string }) {
  return [
    { type: "text", text: parts.tools },
    { type: "text", text: parts.system },
    { type: "text", text: parts.memory, cache_control: { type: "ephemeral", ttl: "1h" } },
  ];
}
export const handoffSummaryLimitTokens = 300;
