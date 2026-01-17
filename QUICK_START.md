# ⚡ HIZLI BAŞLANGIÇ

## 🎯 3 Adımda Kurulum

### 1️⃣ Projeyi İndirin
İki seçenek:
- **ZIP:** `whale-detection-complete.zip` indir, çıkart
- **VEYA Klasör:** `whale-detection-project/` klasörünü kopyala

### 2️⃣ Terminalde Çalıştırın
```bash
cd whale-detection-project
npm install
npm run dev
```

### 3️⃣ Tarayıcıda Açın
```
http://localhost:3000
```

---

## 🐋 İlk Whale Alert

### Adım A: Whale Mode'u Aktif Edin
1. Sağ panelde **🐋 WHALE** butonuna tıklayın
2. Mor-pembe gradient görünecek

### Adım B: Ayarları Yapın
```
Min Score: 55 (varsayılan)
Dynamic SL: ON
```

### Adım C: Alert Bekleyin
1-3 dakika içinde **🐋 75** badge'li alert gelecek!

---

## 📁 Proje İçeriği

```
✅ App.tsx                    # Ana logic (1056 satır)
✅ types.ts                   # Type definitions
✅ constants.tsx              # Config
✅ components/                # 5 adet component
   ├── AlertsPanel.tsx        # Whale UI ⭐
   ├── TradingControls.tsx    # Bot settings ⭐
   ├── PositionsPanel.tsx     # Live trades ⭐
   ├── MarketOverview.tsx     # Market scanner
   └── TradingChart.tsx       # TradingView chart
✅ Dokümantasyon/             # 4 adet MD dosyası
```

---

## 🎨 UI Özellikleri

| Feature | Description |
|---------|-------------|
| **🐋 Whale Badge** | Purple-pink gradient, score gösterimi |
| **Whale Panel** | Progress bar, metrics, SL uyarısı |
| **🎯 Dynamic SL** | Pump başlangıcına göre SL |
| **Whale Entry** | Özel gradient button |
| **Config Panel** | Min score + Dynamic SL toggle |

---

## ⚠️ İlk Çalıştırmada

1. **WebSocket bağlantısı** birkaç saniye sürebilir
2. **İlk alert** 1-5 dakika içinde gelecek
3. **Test için** whaleMinScore: 45 yapabilirsiniz (daha fazla alert)

---

## 🆘 Sorun mu Var?

### Port 3000 kullanımda?
```bash
# Port değiştirin
npm run dev -- --port 3001
```

### Component'ler yüklenmiyor?
```bash
# Node_modules'ü temizle
rm -rf node_modules package-lock.json
npm install
```

### Whale alert gelmiyor?
```typescript
// constants.tsx
whaleMinScore: 45  // Düşürün
```

---

## 📚 Detaylı Dokümantasyon

Proje klasöründe:
1. **README.md** - Genel bakış
2. **INSTALLATION_GUIDE.md** - Detaylı kurulum
3. **WHALE_DETECTION_README.md** - Sistem açıklaması
4. **COMPONENT_UPDATES.md** - UI detayları
5. **TECHNICAL_CHANGES.md** - Backend detayları

---

## 🚀 İyi Tradeler!

**Not:** Bu bir simülasyon/backtest aracıdır. Canlı trading kendi sorumluluğunuzdadır.

Whale detection sistemi FHE benzeri pump'ları yakalamak için optimize edilmiştir! 🐋
