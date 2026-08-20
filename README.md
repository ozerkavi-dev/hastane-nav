# Hastane İndoor Navigasyon — Sembolik Prototip

BFS tabanlı, çok katlı (asansör destekli) rota bulma mimarisinin çalışan bir
iskeleti. Veri sembolik: 2 kat, 4 koridor, 1 asansör, 4 poliklinik.

## Mimari

- **backend/** — Express. Sadece statik veri servisi + QR'dan gelen konum
  ID'sini doğrulayan bir endpoint sunar. Rota hesabı (BFS) burada YAPILMAZ.
- **frontend/** — React (Vite). Veriyi çeker, `?loc=` parametresinden gelen
  konumu okur, rotayı kendi tarafında (`src/routeFinder.js`) hesaplar, SVG
  üzerinde çizer.

Rota hesabının backend değil frontend'de yapılmasının sebebi: veri seti küçük
(yüzler-binler mertebesinde waypoint), ağ gecikmesi olmadan anlık sonuç
alınıyor. Veri seti büyürse veya admin panelinden sık güncelleniyorsa bu karar
gözden geçirilebilir.

## Çalıştırma

```bash
# Terminal 1 — backend
cd backend
npm install
npm start        # http://localhost:4000

# Terminal 2 — frontend
cd frontend
npm install
npm run dev       # http://localhost:5173
```

## QR kod simülasyonu

Gerçek hayatta QR kod, içinde `?loc=<waypointId>` taşıyan bir link barındırır
ve kullanıcı bunu okutunca tarayıcı bu URL'i açar. Elimizde fiziksel QR
olmadığı için, tarayıcıda doğrudan URL'e parametre ekleyerek simüle
ediyoruz:

- `http://localhost:5173/?loc=F1_A1` → Ana giriş, Kat 1
- `http://localhost:5173/?loc=F1_A2` → Kardiyoloji önü, Kat 1
- `http://localhost:5173/?loc=F1_A5` → Radyoloji önü, Kat 1
- `http://localhost:5173/?loc=F2_A2` → Nöroloji önü, Kat 2

Bu linklerden biriyle açıp arama kutusundan farklı katta bir poliklinik
seçersen (örn. F1_A1'den açıp "Ortopedi" ararsan), rota asansör üzerinden
otomatik hesaplanıyor ve kat sekmesinde "on-route" olarak işaretleniyor —
"Kat 1 → Kat 2" bandını üstte göreceksin.

`?loc=` olmadan açarsan (`http://localhost:5173/`), sadece harita ve arama
çalışır, rota hesaplanmaz — bu da beklenen davranış (konum bilinmiyor).

## Veri modelini genişletme

`backend/data/hospital-data.json` içine:
- Yeni koridor eklemek için `roads` altına yeni bir `{"nodes": [...], "floor": N}` girişi
- Yeni poliklinik eklemek için `policlinics` dizisine `{"id","name","floor","entry_waypoint"}`
- Yeni asansör/merdiven grubu için `floor: null` olan bir road + her kattaki
  lobi waypoint'lerini o road'un `nodes` listesine eklemek yeterli — BFS
  otomatik olarak kat geçişini bir "road değişimi" gibi ele alır.

## Mobil pan/zoom notu

`src/usePanZoom.js` kasıtlı olarak **rotate içermiyor** — hastanede kullanıcı
haritayı kazara döndürürse yön kaybı yaşar. Sadece tek parmak pan, iki parmak
pinch-zoom ve çift dokunma ile sıfırlama var. `touch-action: none` ile
tarayıcının kendi sayfa kaydırma/zoom davranışıyla çakışma engellendi.
