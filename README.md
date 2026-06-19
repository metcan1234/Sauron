# Sauron

Sauron, üç ayrı bileşeni ortak bir workspace üzerinden birleştiren bir AI asistan ürünüdür:

| Bileşen | Uygulama | Rol |
|---------|----------|-----|
| **Sauron Core** | OpenGuider (Electron) | Sohbet, planlama, rehberlik — **kod yazmaz** |
| **Sauron Workspace** | Cline (VS Code extension) | Kod yazma, dosya düzenleme, terminal |
| **Sauron Bridge** | `sauron-vscode-bridge` | Handoff dosyalarını okur, Cline API ile görev başlatır |

İki ana process (Core + VS Code/Cline) birbirine gömülmez. Köprü: paylaşılan `workspacePath` + `.sauron/handoff-<id>.json`.

## Önkoşullar

- Node.js
- VS Code + `code` CLI
- **Cline** — Marketplace `saoudrizwan.claude-dev` (⌘ ile hazır akış) veya fork ([`PATCHES.md`](cline-main/PATCHES.md)) tam model routing için
- **Sauron VS Code Bridge** — ⌘ basınca otomatik kurulur veya Settings → Workspace → **Bridge'i kur / yenile**

> Marketplace Cline'da model routing (`setActiveModel`) yoktur; görev başlatma ve handoff çalışır. Tam otomatik model seçimi için Cline fork gerekir.

## Kurulum

### 1. Sauron Core

```bash
cd OpenGuider-main
npm install
npm start
```

### 2. Cline (Marketplace — önerilen)

VS Code Extensions → **Cline** (`saoudrizwan.claude-dev`) kurun. API key'leri Cline Settings'te bir kez girin.

### 3. Sauron Bridge (otomatik)

İlk ⌘ **Çalışma Kısmı** basışında Bridge otomatik kurulur. Manuel derleme:

```powershell
cd OpenGuider-main/scripts
./build-workspace-stack.ps1
```

veya:

```bash
cd sauron-vscode-bridge
npm install
npm run package:vsix
code --install-extension dist/sauron-vscode-bridge.vsix --force
```

### 4. Cline fork (isteğe bağlı — tam routing)

```bash
cd cline-main/apps/vscode
npm install
npm run compile
```

Patch listesi: [`cline-main/PATCHES.md`](cline-main/PATCHES.md)

### 5. Workspace path

Sauron Core → Settings → Workspace → proje kök klasörünü seçin.

## Çalışma Kısmı akışı

1. Sauron Core'da görev konuşulur / planlanır.
2. **Çalışma Kısmı** (⌘) butonuna basılır.
3. Core:
   - Pending handoff varsa kullanıcıdan onay ister (sessiz overwrite yok)
   - `.sauron/handoff-<id>.json` yazar
   - `.clinerules/sauron-workspace.md` yoksa oluşturur
   - VS Code'u `code <workspacePath>` ile açar
4. Bridge:
   - En güncel pending handoff'u bulur
   - Aktif Cline görevi **yoksa** otomatik başlatır
   - Aktif görev **varsa** modal uyarı gösterir; kullanıcı seçmeden `clearTask` çağrılmaz
   - İşlenen dosya `.consumed` veya `.rejected` olarak işaretlenir
   - 7 günden eski consumed/rejected dosyalar `.sauron/archive/` altına taşınır

## Handoff şeması (v2)

```json
{
  "version": 2,
  "id": "2026-06-19T12-00-00-000Z-uuid",
  "source": "sauron-core",
  "workspacePath": "C:/path/to/project",
  "taskSummary": "Cline prompt",
  "goal": "...",
  "sessionId": "...",
  "createdAt": "2026-06-19T12:00:00.000Z",
  "autoStart": true
}
```

Legacy `handoff.json` okunmaya devam eder.

## FinOps (Faz 3 + 4A)

- **Core LLM** maliyeti: OpenGuider içindeki çağrılar → `.sauron/usage/logs.jsonl`
- **Cline maliyeti:** Bridge, görev bitince aynı `logs.jsonl` dosyasına `operation: "cline-task"` yazar (fork Cline + `getActiveTaskMetrics()` patch gerekir)
- **Settings → Bütçe / FinOps:** Toplam harcama, işlem/provider kırılımı, bütçe uyarıları
- **Workspace config:** Core kayıt sonrası `.sauron/finops-config.json` (USD/TL kuru bridge için)

Detay: [`OpenGuider-main/docs/finops-cline-export-report.md`](OpenGuider-main/docs/finops-cline-export-report.md)

## Cost Optimizer + 4-Agent Matrix

- **Settings → AI Agents:** Gemini, DeepSeek, OpenAI key + Ollama URL (model seçimi otomatik)
- **Settings → Bütçe / FinOps:** Toplam bütçe, harcanan, günlük bütçe, handoff limitleri
- **Core routing:** Gemini (sohbet/plan) → DeepSeek (yüksek karmaşıklık) → Ollama fallback
- **Cline routing:** DeepSeek (düşük) → Gemini (orta) → GPT-4o-mini (yüksek) — bridge `setActiveModel`
- **Cline key mirror:** Anahtarları Cline'a bir kez manuel kopyalayın → [`agent-setup-cline.md`](OpenGuider-main/docs/agent-setup-cline.md)

Detay: [`OpenGuider-main/docs/finops-cost-optimizer.md`](OpenGuider-main/docs/finops-cost-optimizer.md)

## Cline kuralları

`.clinerules/sauron-workspace.md` — token disiplini ve onay kapıları. İlk handoff'ta Core oluşturur; mevcut dosya ezilmez.

## Cline güncellemesi nasıl alınır

1. Upstream [cline/cline](https://github.com/cline/cline) tag veya branch'i `cline-main/` içine merge/rebase edin.
2. [`cline-main/PATCHES.md`](cline-main/PATCHES.md) dosyasındaki iki export dosyasını yeniden uygulayın:
   - `apps/vscode/src/exports/cline.d.ts`
   - `apps/vscode/src/exports/index.ts`
3. Sauron handoff hook'larının geri gelmediğini doğrulayın (`HandoffLoader`, `VscodeWebviewProvider`, `common.ts`).
4. Derleyin ve test edin:

```bash
cd cline-main/apps/vscode && npm run compile
cd ../../sauron-vscode-bridge && npm run compile && npm test
cd ../OpenGuider-main && npm test
```

5. Bridge extension'ı VS Code'da yeniden yükleyin.

Handoff mantığı artık Cline çekirdeğinde değil; upstream merge conflict riski düşüktür.

## Sorun giderme

| Sorun | Çözüm |
|-------|-------|
| VS Code CLI bulunamadı | Command Palette → Shell Command: Install 'code' command in PATH |
| Bridge handoff okumuyor | Bridge extension kurulu ve etkin mi? Cline fork patch'leri uygulandı mı? |
| Aktif görev varken uyarı çıkmıyor | Marketplace Cline yerine fork derlemesi kullanın |
| Pending handoff uyarısı (Core) | VS Code tarafında önceki handoff işlenmemiş; onaylayın veya `.sauron/` içini kontrol edin |
| Handoff tekrar yüklenmiyor | `.consumed` dosyalar tekrar okunmaz; Core'dan yeni handoff oluşturun |

## Manuel test checklist

- [ ] Core açılır, Workspace path kaydedilir
- [ ] Çalışma Kısmı → `handoff-<id>.json` oluşur, VS Code açılır
- [ ] Bridge görevi Cline'a yükler
- [ ] Aktif Cline görevi varken yeni handoff → modal uyarı, otomatik silme yok
- [ ] Hızlı çift tıklama → Core pending uyarısı veya debounce
- [ ] Settings → AI Agents → 3 API key kaydedilir
- [ ] Settings → FinOps → `.sauron/finops-config.json` oluşur (`agentMatrix` dahil)
- [ ] Handoff → bridge `cline-agent-routing` ledger kaydı
- [ ] Cline key mirror tamam (agent-setup-cline.md)
- [ ] FinOps Harcanan TL Core + Cline toplamını gösterir

## Proje yapısı

```
ai-asistan001/
├── OpenGuider-main/        # Sauron Core
├── cline-main/             # Cline fork (+ PATCHES.md)
├── sauron-vscode-bridge/   # Handoff bridge extension
├── .clinerules/
└── README.md
```
