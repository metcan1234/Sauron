# OpenGuider / Sauron Core — Kullanıcı Rehberi (TR)

## Başlangıç

1. **Ayarlar** → AI Agents sekmesinden Gemini, DeepSeek ve OpenAI anahtarlarını girin.
2. İsteğe bağlı **Ollama URL** ile yerel fallback ekleyin.
3. Panelde sohbet başlatın veya **Ctrl+Shift+Space** ile bas-konuş kullanın.

## Sohbet özellikleri

- **Mesaj düzenle / sil:** Kullanıcı ve asistan balonlarında ✏️ / 🗑
- **Yeniden üret:** Asistan yanıtında ↻
- **Ekler:** Görsel veya metin dosyalarını sürükle-bırak, yapıştır (max 5 dosya, 5MB)
- **Sohbet geçmişi:** `Ctrl+K` veya ☰ menüsü
- **Klasörler:** Drawer'da 📁 Yeni klasör; sohbetleri 📁 ile taşıyın
- **Geçici sohbet:** Uygulama yeniden başlayınca kaybolur

## Artifact paneli

Uzun kod bloklarında **⧉ Panel** ile sağdan açılan düzenlenebilir paneli kullanın. Kopyala ve indir desteklenir.

## Çalışma Kısmı (⌘)

Workspace butonu VS Code + Cline handoff akışını başlatır. Bridge kurulumu eksikse otomatik kurulmaya çalışılır.

## Kişilik ve hafıza

Ayarlar → Gelişmiş → **Asistan kişiliği** (`systemPromptOverride`) ve **Kullanıcı hafızası** (satır başına bir gerçek).

## Yedekleme

Ayarlar → Workspace → **Otomatik yerel yedekleme**. Klasör seçin; açılış/kapanışta JSON yedek oluşturulur. **Şimdi yedekle** / **İçe aktar** ile manuel işlem yapın.

## Kısayollar

| Kısayol | İşlev |
|---------|--------|
| Ctrl+K | Sohbet geçmişi |
| Ctrl+N | Yeni sohbet |
| Ctrl+Shift+Space | Bas-konuş |
| Ctrl+Alt+1…7 | Plan adımları (widget/panel) |

## FinOps rozeti

Header'daki rozet oturum ve toplam TL harcamasını gösterir. Bütçe Ayarlar → FinOps'tan yapılandırılır.
