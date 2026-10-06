# Güvenlik politikası

## Desteklenen sürümler
En son `1.x` sürümü güvenlik düzeltmesi alır.

## Açık bildirme
Güvenlik açıklarını **herkese açık issue olarak açmayın**. GitHub'daki [özel güvenlik bildirimi](https://github.com/cumabozkurt/super-orkestra/security/advisories/new) özelliğini ya da info@cumabozkurt.tr adresini kullanın. 72 saat içinde dönüş yapılır.

## Tasarım gereği güvenlik önlemleri
- İşçi ajanlar izole git worktree'lerde çalışır; ACP üzerinden dosya erişimi worktree köküyle sınırlıdır ve izinler yalnızca tek seferlik verilir.
- Ajan süreçleri kabuk (shell) olmadan başlatılır; masaüstü uygulaması kullanıcı metnini argüman olarak değil ortam değişkeniyle iletir.
- API anahtarları yapılandırma dosyasına yazılmaz, ortam değişkeninden okunur (`apiKeyEnv`).
- Birden çok abonelik hesabı arasında otomatik geçiş varsayılan olarak kapalıdır.
