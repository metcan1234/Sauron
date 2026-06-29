# OpenGuider Kurulum ve Kullanim Rehberi (TR)

Bu rehber, OpenGuider'i tamamen ucretsiz kredi kombinasyonlariyla gunluk ihtiyaclar icin nasil kurup kullanabileceginizi anlatir.

## 1) Hedeflenen Ucretsiz Kurulum Kombinasyonu

- **AI Provider:** OpenRouter
- **Model:** `google/gemini-3.1-flash-image-preview` (hizli ve gorsel baglamda verimli)
- **STT (Speech-to-Text):** Groq `whisper-large-v3-turbo`
- **TTS (Text-to-Speech):** ElevenLabs
  - Erkek Voice ID: `pNInz6obpgDQGcFmaJgB`
  - Kiz Voice ID: `EXAVITQu4vr4xnSDxMaL`

Bu kombinasyonla ucretsiz kredilerle gunluk kullanim senaryolarinin buyuk bolumunu karsilayabilirsiniz. Kredi biterse yeni bir hesap acip devam etmek de pratik bir alternatiftir.

---

## 2) Kurulum: Uygulamayi Hazirlama

1. OpenGuider'i acin.
2. `Settings` ekranina gidin.
3. Asagidaki servisler icin API anahtarlarini hazirlayin:
   - OpenRouter
   - Groq
   - ElevenLabs

### 2.1 OpenRouter API Key Alma

1. Tarayicidan OpenRouter sitesine gidin: <https://openrouter.ai/>
2. Hesap olusturun veya giris yapin.
3. Dashboard/Keys bolumune gidin.
4. `Create Key` secenegine tiklayip yeni bir anahtar olusturun.
5. Anahtari kopyalayip OpenGuider `Settings > AI Provider` alanina yapistirin.
6. Provider olarak `OpenRouter` secin.
7. Model olarak `google/gemini-3.1-flash-image-preview` secin.

### 2.2 Groq API Key Alma (STT)

1. Groq sitesine gidin: <https://console.groq.com/>
2. Giris yapin, API keys sayfasina gecin.
3. Yeni bir key olusturun ve kopyalayin.
4. OpenGuider'da `Settings > Voice > STT Provider` bolumune key'i girin.
5. STT modeli olarak `whisper-large-v3-turbo` secin.

### 2.3 ElevenLabs API Key Alma (TTS)

1. ElevenLabs sitesine gidin: <https://elevenlabs.io/>
2. Hesap olusturun/giris yapin.
3. Profil veya API bolumunden API key olusturun.
4. OpenGuider'da `Settings > Voice > TTS Provider` alanina key'i girin.
5. Asagidaki voice ID'lerden birini secin:
   - Erkek: `pNInz6obpgDQGcFmaJgB`
   - Kiz: `EXAVITQu4vr4xnSDxMaL`

---

## 3) Kullanim Rehberi: Best Practices

Context'in sisip kalite dusurmesini onlemek icin asagidaki kullanim pratiklerini uygulayin:

1. **Tek gorev, tek oturum mantigi kullanin.**
   - Her oturumda tek bir net hedefe odaklanin.
2. **Promptlari kisa ve amac odakli yazin.**
   - Gereksiz gecmis detaylari her mesajda tekrar etmeyin.
3. **Adim adim ilerleyin.**
   - "Bir sonraki adima gec" gibi net gecis komutlari kullanin.
4. **Guncel ekran baglami verin.**
   - UI degistiginde net bir metinsel tarif ekleyin.
5. **Uzun gorevlerde periyodik ozet isteyin.**
   - "Simdiye kadar ne yaptik?" diyerek context temizligi yapin.
6. **Model secimini goreve gore yapin.**
   - Gunluk hizli isler: flash model.
   - Kritik planlama: daha guclu model (gerekirse).

### 3.1 Diger Providerlari Ekleme (Normal ve Onerilen Kullanim)

OpenGuider'da provider degistirmek veya yedek provider eklemek icin:

1. `Settings > AI Provider` alanina gidin.
2. Eklemek istediginiz provideri secin.
3. O providerin API key'ini girin.
4. Uygun modeli secip test mesaji atin.
5. Sorun olursa ana providera geri donun.

**Normal (butce-dostu) kurulum onerisi:**
- Varsayilan: OpenRouter + `google/gemini-3.1-flash-image-preview`
- STT: Groq `whisper-large-v3-turbo`
- TTS: ElevenLabs voice ID'leri
- Neden: Dusuk maliyet, hizli yanit, gunluk islerde yeterli kalite.

**Onerilen (kalite-odakli) kurulum secenegi:**
- Zor planlama/analiz islerinde Claude Opus ailesi daha tutarli ve kaliteli cevaplar verebilir.
- Ancak Claude Opus genelde daha yuksek maliyetlidir.
- Pratik strateji:
  - Gunluk kullanimda flash model ile devam et.
  - Sadece kritik ve zor adimlarda Claude Opus'a gec.
  - Is bitince tekrar dusuk maliyetli modele don.

---

## 4) Siklikla Karsilasilan Durumlar

- **Yanlis/eksik yonlendirme alirsaniz:**
  - Daha net hedef yazin, mevcut ekrani tarif edin, yeni baglam verin.
- **Ses tanima kotu ise:**
  - Mikrofon izinlerini ve Groq key'ini kontrol edin.
- **TTS ses kalitesi beklentiyi karsilamiyorsa:**
  - Diger ElevenLabs voice ID'sini deneyin.
- **Kredi limiti dolarsa:**
  - Kullanim yogunluguna gore yeni hesap acarak devam edin.
