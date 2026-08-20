// Koridor çizgisine "yol görünümü" kazandırmak için: merkez çizginin solunda
// ve sağında, aynı yöne paralel iki çizgi daha çiziyoruz (yol kenarı gibi).
// Poliklinikler artık kendi çokgen koordinatlarını (data.policlinics[].coordinates)
// taşıyor, bu yüzden burada oda geometrisi hesaplanmıyor.

export const ROAD_HALF_WIDTH = 2.4;

function normalize(v) {
  const len = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / len, y: v.y / len };
}

// Her düğüm için hem teğet (yol yönü) hem de "sola bakan" birim normal
// vektörünü hesaplar. Köşelerde önceki/sonraki segment yönünün ortalaması
// alınır (basit miter yaklaşımı) — keskin dönüşlerde ufak görsel sapmalar
// olabilir ama koridor genişliği ölçeğinde fark edilmez.
function computeNodeFrames(nodeIds, waypoints) {
  const pts = nodeIds.map((id) => waypoints[id]);
  const frames = [];

  for (let i = 0; i < pts.length; i++) {
    const prev = pts[i - 1];
    const curr = pts[i];
    const next = pts[i + 1];

    let tangent;
    if (prev && next) {
      const t1 = normalize({ x: curr.x - prev.x, y: curr.y - prev.y });
      const t2 = normalize({ x: next.x - curr.x, y: next.y - curr.y });
      tangent = normalize({ x: t1.x + t2.x, y: t1.y + t2.y });
    } else if (next) {
      tangent = normalize({ x: next.x - curr.x, y: next.y - curr.y });
    } else if (prev) {
      tangent = normalize({ x: curr.x - prev.x, y: curr.y - prev.y });
    } else {
      tangent = { x: 1, y: 0 };
    }

    const normal = { x: -tangent.y, y: tangent.x }; // 90° sola döndür
    frames.push({ tangent, normal });
  }

  return frames;
}

// Bir road'u verilen mesafede paralel kaydırılmış nokta dizisi olarak döner.
// distance pozitifse sola, negatifse sağa kayar.
export function offsetRoadPoints(nodeIds, waypoints, distance) {
  const pts = nodeIds.map((id) => waypoints[id]);
  const frames = computeNodeFrames(nodeIds, waypoints);
  return pts.map((p, i) => ({
    x: p.x + frames[i].normal.x * distance,
    y: p.y + frames[i].normal.y * distance,
  }));
}

// Belirli bir waypoint'in, içinde bulunduğu road'daki teğet + normal
// vektörünü döner — otomatik yön/ortalama (recenter) hesaplarında
// "bu koridorun yönü ne tarafa bakıyor" sorusunu cevaplamak için kullanılır.
export function getFrameAtWaypoint(nodeIds, waypoints, waypointId) {
  const index = nodeIds.indexOf(waypointId);
  if (index === -1) return { tangent: { x: 1, y: 0 }, normal: { x: 0, y: -1 } };
  return computeNodeFrames(nodeIds, waypoints)[index];
}
