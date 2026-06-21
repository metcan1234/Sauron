# Sauron Workspace — Cline Kuralları

## Token / Maliyet Disiplini
1. Her görev öncesi kısa bir plan yaz (2-5 madde), onaysız uzun kod bloklarına girme.
2. Büyük dosyaları (200+ satır) tam okumadan önce, gerçekten gerekli mi diye düşün; sadece ilgili bölümü oku/düzenle.
3. Aynı bağlamı (dosya içeriği, önceki cevaplar) tekrar tekrar modele gönderme; oturum içi hafızayı kullan.
4. Ucuz/yerel model (Ollama) yeterli olan basit işlerde (formatlama, küçük refactor, dosya arama) GPT/Gemini gibi pahalı modellere geçme; görev karmaşıklığına göre model seç.
5. Bir günlük/oturumluk yaklaşık bir bütçe sınırın varsa, sınıra yaklaşınca kullanıcıyı uyar ve ucuz modele düşmeyi öner.

## Onay Kapıları (Approval Gates)
6. Dosya yazma/silme işleminden önce mutlaka diff göster ve onay iste — "yolo" / oto-onay modu sadece kullanıcı açıkça etkinleştirirse kullanılsın.
7. Git commit ve push işlemlerini kullanıcı onayı olmadan yapma; commit mesajını göster, push'tan önce ayrıca sor.
8. Terminalde yıkıcı olabilecek komutları (rm -rf, force push, paket kaldırma vb.) çalıştırmadan önce açıkça belirt ve onay iste.
9. Mimari karar gerektiren değişikliklerde (yeni bağımlılık ekleme, klasör yapısını değiştirme) önce kısa bir gerekçe sun, kullanıcı onaylamadan uygulama.
10. Görev tamamlandığında ne yapıldığını kısa özetle (post-flight); sessizce bitirme.

## Genel
11. Hangi modeli (Gemini/Ollama/GPT/DeepSeek) kullandığını görev başında belirt, böylece maliyet/performans takibi yapılabilsin.
12. Workspace dışına (proje klasörü dışındaki dosyalara) yazma yapma.

## Kod Kalitesi (Cursor tarzı)
13. Değişiklik yapmadan önce ilgili dosyaları oku; gereksiz geniş tarama veya tüm klasörü listeleme yapma.
14. Büyük refactor veya mimari değişiklikten önce kısa bir plan sun (Cline Plan modu veya madde listesi); onaysız sıçrama yapma.
15. Projede test script varsa (ör. `npm test`) anlamlı kod değişikliğinden sonra çalıştır; kırıldıysa düzelt veya raporla.
16. Gereksiz yeni dosya veya tek satırlık yardımcı oluşturma; mevcut modülü genişlet, tekrarlayan soyutlama ekleme.
17. Handoff özeti ve kullanıcı mesajı bağlamı kaynaktır; onlarla çelişen varsayımlar yapma.
