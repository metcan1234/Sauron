# Unreal Game Dev Kurulumu

Sauron Game Dev kanali Unreal Editor ile TCP uzerinden konusur (port **55557**).

## 1. Unreal Editor

- UE 5.3+ onerilir (Windows)
- Proje acik olmali

## 2. MCP plugin (Funplay veya ue-mcp)

1. [FunplayAI/funplay-unreal-mcp](https://github.com/FunplayAI/funplay-unreal-mcp) veya [db-lyon/ue-mcp](https://github.com/db-lyon/ue-mcp) kurun
2. Editor plugin'i projeye ekleyin
3. TCP bridge `127.0.0.1:55557` dinlemeli

## 3. Sauron tarafinda

- Ayarlar → Game Dev → engine: **unreal**
- Doctor: `gamedev-unreal-bridge` kontrolu
- Karmasik isler icin handoff `execute_python` pointer kullanir (tam script govdesi degil)

## 4. Sorun giderme

- World outliner bos: Editor acik mi, level yuklu mu
- MCP timeout: Unreal plugin loglarini kontrol edin
