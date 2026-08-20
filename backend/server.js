const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

const dataPath = path.join(__dirname, 'data', 'hospital-data.json');

// Veriyi her istekte diskten okumak yerine bellekte tutuyoruz.
// (Admin paneli eklenirse burada bir "reload" mekanizması gerekir.)
let hospitalData = null;

function loadData() {
  const raw = fs.readFileSync(dataPath, 'utf8');
  hospitalData = JSON.parse(raw);
}
loadData();

// Tüm harita verisi: waypoint'ler, koridorlar(road), poliklinikler
// Frontend rota hesabını (BFS) kendi tarafında yapacağı için bu veriye ihtiyaç duyar.
app.get('/api/data', (req, res) => {
  res.json(hospitalData);
});

// Sadece poliklinik listesi (arama kutusu için hafif endpoint)
app.get('/api/policlinics', (req, res) => {
  res.json(hospitalData.policlinics);
});

// QR kod bu formatta bir link taşır: https://site.com/?loc=F1_A1
// Bu endpoint, gelen waypoint ID'sinin gerçekten var olup olmadığını doğrular
// ve konumun x/y/kat bilgisini döner. Böylece frontend geçersiz/bozuk bir QR
// linkiyle çalışmaya çalışmaz.
app.get('/api/location/:waypointId', (req, res) => {
  const { waypointId } = req.params;
  const point = hospitalData.waypoints[waypointId];

  if (!point) {
    return res.status(404).json({ error: 'Konum bulunamadı', waypointId });
  }

  res.json({ id: waypointId, ...point });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Hastane navigasyon backend http://localhost:${PORT} adresinde çalışıyor`);
});
