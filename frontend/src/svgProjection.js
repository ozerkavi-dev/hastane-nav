// Üç koordinat sistemi var:
//   1) "content" — waypoint'lerin kendi orijinal (x,y) koordinatları
//   2) "world"   — SVG'nin viewBox'ı (kata göre sabit, pan/zoom'dan etkilenmez)
//   3) "screen"  — kullanıcının gerçekten dokunduğu piksel koordinatı
//
// content -> world dönüşümü, bizim pan/zoom/rotate durumumuz (transform).
// world -> screen dönüşümü ise viewBox + container boyutuna bağlı, sabit bir
// projeksiyon (S). Bu dosya ikisini de kurup tersine çevirmek için gereken
// matematiği topluyor.

export function getProjection(viewBox, containerRect) {
  const k =
    Math.min(containerRect.width / viewBox.width, containerRect.height / viewBox.height) || 1;
  const renderedW = viewBox.width * k;
  const renderedH = viewBox.height * k;
  return {
    k,
    offsetX: (containerRect.width - renderedW) / 2,
    offsetY: (containerRect.height - renderedH) / 2,
    viewBox,
  };
}

export function worldToScreen(proj, p) {
  return {
    x: proj.offsetX + (p.x - proj.viewBox.minX) * proj.k,
    y: proj.offsetY + (p.y - proj.viewBox.minY) * proj.k,
  };
}

export function screenToWorld(proj, p) {
  return {
    x: proj.viewBox.minX + (p.x - proj.offsetX) / proj.k,
    y: proj.viewBox.minY + (p.y - proj.offsetY) / proj.k,
  };
}

function rotateVec(v, deg) {
  const r = (deg * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return { x: v.x * cos - v.y * sin, y: v.x * sin + v.y * cos };
}

// transform = { scale, rotateDeg, tx, ty }
// SVG karşılığı: <g transform="translate(tx,ty) rotate(rotateDeg) scale(scale)">
// content noktasını world koordinatına çevirir.
export function applyTransform(t, p) {
  const r = rotateVec(p, t.rotateDeg);
  return { x: r.x * t.scale + t.tx, y: r.y * t.scale + t.ty };
}

// world koordinatını, verilen transform'un tersini alarak content'e çevirir.
export function invertTransform(t, q) {
  const inv = { x: (q.x - t.tx) / t.scale, y: (q.y - t.ty) / t.scale };
  return rotateVec(inv, -t.rotateDeg);
}

export function transformToSvgString(t) {
  return `translate(${t.tx} ${t.ty}) rotate(${t.rotateDeg}) scale(${t.scale})`;
}

export function angleOfDeg(v) {
  return (Math.atan2(v.y, v.x) * 180) / Math.PI;
}

// Bir content noktasının (focusPoint), ekranın belirli bir oranında
// (screenFrac: {x,y}, 0-1 arası) ve o noktadaki "heading" (teğet yön)
// vektörünün ekranın YUKARISINI göstereceği bir transform üretir.
// Sayfa açılışında "bulunduğun nokta altta-ortada, yürüyüş yönün yukarı
// baksın" davranışı bununla kuruluyor.
export function computeOrientTransform({
  focusPoint,
  headingVector,
  rotateDeg: fixedRotateDeg,
  screenFrac,
  scale,
  proj,
  containerRect,
}) {
  const targetScreen = {
    x: containerRect.width * screenFrac.x,
    y: containerRect.height * screenFrac.y,
  };
  const targetWorld = screenToWorld(proj, targetScreen);

  // rotateDeg doğrudan verildiyse (örn. "genel görünüm" için aynı yönü
  // korumak istediğimizde) onu kullan; verilmediyse heading vektöründen hesapla.
  const rotateDeg =
    fixedRotateDeg !== undefined ? fixedRotateDeg : -90 - angleOfDeg(headingVector);

  const rotatedFocus = rotateVec(focusPoint, rotateDeg);

  return {
    scale,
    rotateDeg,
    tx: targetWorld.x - rotatedFocus.x * scale,
    ty: targetWorld.y - rotatedFocus.y * scale,
  };
}

// content noktalarını verilen açıyla döndürüp kapladıkları alanı (bbox) döner
// — "genel görünüm" için gereken zoom seviyesini hesaplamakta kullanılır.
export function rotatedBounds(points, rotateDeg) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    const r = rotateVec(p, rotateDeg);
    minX = Math.min(minX, r.x);
    maxX = Math.max(maxX, r.x);
    minY = Math.min(minY, r.y);
    maxY = Math.max(maxY, r.y);
  }
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}
