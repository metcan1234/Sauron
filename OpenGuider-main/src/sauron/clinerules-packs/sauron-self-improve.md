# Sauron Self-Improve — Dogfood Kuralları

Bu workspace Sauron kaynak kodudur. Görev: mevcut mimariye uygun, minimal diff ile iyileştirme.

## Güvenlik
1. Git commit/push kullanıcı onayı olmadan yapma.
2. `git reset --hard`, force push, hook skip yasak.
3. Secret dosyaları (.env, key) commit etme.

## Kalite
4. Değişiklik sonrası `npm test` zorunlu (OpenGuider-main kökünde).
5. Yalnızca görevle ilgili dosyaları değiştir; drive-by refactor yapma.
6. Mevcut i18n, FinOps, handoff davranışını kırma.

## Maliyet
7. Plan fazında dosya listesi çıkar; gereksiz tarama yapma.
8. Test ve lint için Ollama/yerel model yeterliyse pahalı modele geçme.
