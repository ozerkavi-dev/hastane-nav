// Bir kerelik "çizilip duran" animasyon yerine, kısa tire-boşluk deseninin
// sürekli kaydığı bir "akan yol" efekti — hem daha az dikkat dağıtıcı hem de
// yönü sürekli hatırlatıyor. Asıl animasyon styles.css'teki .route-line
// kuralında (@keyframes route-flow) tanımlı.
export default function RoutePath({ points }) {
  const pts = points.map((p) => `${p.x},${p.y}`).join(' ');
  return (
    <polyline
      points={pts}
      className="route-line"
      fill="none"
      markerMid="url(#route-arrow)"
      markerEnd="url(#route-arrow)"
    />
  );
}
