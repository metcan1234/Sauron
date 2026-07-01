# Sauron Game Dev Unity Package (opsiyonel)

Editor penceresi, TCP echo testi ve Play Mode log iletimi. `gamedevUnityPackageEnabled` ayarı açıkken Game Dev sihirbazından Assets'e kopyalanabilir.

## Kurulum

1. `templates/unity/sauron-gamedev-package` klasörünü Unity projenizin `Packages/` altına kopyalayın veya Git URL ile ekleyin.
2. Unity Editor'de **Sauron → Game Dev Bridge** menüsünü açın.
3. CoplayDev unity-mcp bridge (TCP 7890) ile birlikte kullanın.

## Özellikler

- Editor status penceresi
- Basit TCP echo (localhost test)
- Play Mode console log özetini `.sauron/gamedev-play-log.txt` dosyasına yazar
