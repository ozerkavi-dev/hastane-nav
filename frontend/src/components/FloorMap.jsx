import { useCallback, useEffect, useRef, useState } from 'react';
import { usePanZoom } from '../usePanZoom';
import RoutePath from './RoutePath';
import { offsetRoadPoints, getFrameAtWaypoint, ROAD_HALF_WIDTH } from '../roadGeometry';
import {
  getProjection,
  computeOrientTransform,
  transformToSvgString,
  rotatedBounds,
} from '../svgProjection';
import { getCategoryStyle, getRoomColors } from '../categoryStyles';

// Resim kullanmak istersen buraya yolu yaz, örn: '/icons/location-pin.png'
// (dosyayı frontend/public/icons/ klasörüne koyman yeterli — asansör/merdiven
// ikonlarıyla aynı mantık). null bırakırsan vektör pin kullanılır.
const TARGET_MARKER_IMAGE = null;

// Asansör/merdiven gibi kategoriler için, oda içine metin yerine ikon
// basıyoruz. İkon 24x24'lük kendi çizim uzayında tanımlı, odaya göre ölçekleniyor.
const ICON_CATEGORIES = new Set(['asansor', 'merdiven']);

const PADDING = 12;

// Bulunduğun/hedefe giden yön ekranın ne kadar altında görünsün ve ne kadar
// yakınlaştırılmış olsun. screenFrac.y = 0.9 => alttan %10 yukarıda.
const ORIENT_SCREEN_FRAC = { x: 0.5, y: 0.9 };
const ORIENT_SCALE = 2.5;


// Yeni bir rota hesaplandığında: önce tüm rotayı gösteren "genel görünüm",
// sonra otomatik olarak yakın (yön odaklı) görünüme geçiş.
const OVERVIEW_HOLD_MS = 1400; // genel görünümün ekranda kalma süresi
const OVERVIEW_PADDING = 0.7; // rotanın görünür alanın ne kadarını dolduracağı
const OVERVIEW_TRANSITION_MS = 650; // geçiş animasyonu süresi (styles.css ile eşleşmeli)

function computeViewBoxRect(waypoints, policlinics, floor) {
  const wpPoints = Object.values(waypoints).filter((w) => w.floor === floor);
  const roomPoints = policlinics
    .filter((p) => p.floor === floor && p.coordinates)
    .flatMap((p) => p.coordinates);
  const points = [...wpPoints, ...roomPoints];

  if (points.length === 0) return { minX: 0, minY: 0, width: 100, height: 100 };

  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const minX = Math.min(...xs) - PADDING;
  const minY = Math.min(...ys) - PADDING;
  const width = Math.max(...xs) - Math.min(...xs) + PADDING * 2;
  const height = Math.max(...ys) - Math.min(...ys) + PADDING * 2;

  return { minX, minY, width, height };
}

// Bir çokgenin (poliklinik) etiket metnini yerleştireceğimiz merkez noktası.
function polygonCentroid(coordinates) {
  return {
    x: coordinates.reduce((s, c) => s + c.x, 0) / coordinates.length,
    y: coordinates.reduce((s, c) => s + c.y, 0) / coordinates.length,
  };
}

// Oda kutusunun en dar kenarına göre makul bir ikon boyutu hesaplar.
function roomIconSize(coordinates) {
  const xs = coordinates.map((c) => c.x);
  const ys = coordinates.map((c) => c.y);
  const w = Math.max(...xs) - Math.min(...xs);
  const h = Math.max(...ys) - Math.min(...ys);
  return Math.max(4, Math.min(8, Math.min(w, h) * 0.7));
}

function normalizeVec(v) {
  const len = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / len, y: v.y / len };
}

// Bir waypoint'ten çıkan tüm koridor yönlerini (o noktayı içeren her road'un
// o noktadaki komşusuna doğru birim vektör) döner. Düz bir koridorda 2 yön,
// bir kavşakta 3-4 yön dönebilir — "hangi yön yukarı baksın" kararını bu
// adaylar arasından veriyoruz.
function getOutgoingDirections(waypointId, waypoint, corridorRoads, waypoints) {
  const dirs = [];
  for (const [, road] of corridorRoads) {
    const idx = road.nodes.indexOf(waypointId);
    if (idx === -1 || road.nodes.length < 2) continue;

    const neighborIds = [];
    if (idx > 0) neighborIds.push(road.nodes[idx - 1]);
    if (idx < road.nodes.length - 1) neighborIds.push(road.nodes[idx + 1]);

    for (const nid of neighborIds) {
      const n = waypoints[nid];
      if (!n) continue;
      dirs.push(normalizeVec({ x: n.x - waypoint.x, y: n.y - waypoint.y }));
    }
  }
  return dirs;
}

export default function FloorMap({
  data,
  floor,
  routeSegments,
  connectorWaypointIds,
  userLocation,
  selectedTarget,
}) {
  const { waypoints, roads, policlinics } = data;

  const corridorRoads = Object.entries(roads).filter(([, road]) => road.floor === floor);
  const floorSegments = (routeSegments || []).filter((seg) => seg.floor === floor);
  const floorPoliclinics = policlinics.filter((p) => p.floor === floor);

  const viewBoxRect = computeViewBoxRect(waypoints, policlinics, floor);
  const viewBoxAttr = `${viewBoxRect.minX} ${viewBoxRect.minY} ${viewBoxRect.width} ${viewBoxRect.height}`;

  // "Konuma göre ortala": öncelik bu kattaki rota segmentinin yönü (hedef
  // seçildiyse, gidiş yönünü gösterir); rota yoksa kullanıcının bulunduğu
  // koridorun yönü (sayfa ilk açıldığında); ikisi de yoksa katın tamamı
  // (kimlik dönüşümü, kuzey-yukarı).
  // Saf hesaplama — setTransform çağırmaz, sadece {focusPoint, headingVector}
  // döner (ya da bulamazsa null). recenter() ve genel-görünüm efekti ikisi de
  // bunu kullanıyor.
  const computeFocusAndHeading = useCallback(() => {
    let focusPoint = null;
    let headingVector = null;

    if (floorSegments.length > 0 && floorSegments[0].points.length >= 2) {
      const [p0, p1] = floorSegments[0].points;
      focusPoint = { x: p0.x, y: p0.y };
      headingVector = { x: p1.x - p0.x, y: p1.y - p0.y };
    } else if (userLocation && userLocation.floor === floor) {
      const wp = waypoints[userLocation.id];
      focusPoint = { x: userLocation.x, y: userLocation.y };

      const floorCenter = {
        x: viewBoxRect.minX + viewBoxRect.width / 2,
        y: viewBoxRect.minY + viewBoxRect.height / 2,
      };
      const towardCenter = normalizeVec({
        x: floorCenter.x - focusPoint.x,
        y: floorCenter.y - focusPoint.y,
      });

      const candidates = wp
        ? getOutgoingDirections(userLocation.id, wp, corridorRoads, waypoints)
        : [];

      if (candidates.length > 0) {
        headingVector = candidates.reduce((best, d) => {
          const scoreD = d.x * towardCenter.x + d.y * towardCenter.y;
          const scoreBest = best.x * towardCenter.x + best.y * towardCenter.y;
          return scoreD > scoreBest ? d : best;
        });
      } else {
        const ownerRoad = corridorRoads.find(([, road]) => road.nodes.includes(userLocation.id));
        if (ownerRoad) {
          headingVector = getFrameAtWaypoint(ownerRoad[1].nodes, waypoints, userLocation.id).tangent;
        }
      }
    }

    return focusPoint && headingVector ? { focusPoint, headingVector } : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    viewBoxRect.minX,
    viewBoxRect.minY,
    viewBoxRect.width,
    viewBoxRect.height,
    floor,
    floorSegments,
    userLocation,
    corridorRoads,
    waypoints,
  ]);

  // Manuel "ortala" (⌂ butonu / çift dokunma) — HER ZAMAN anında, animasyonsuz.
  const recenter = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const found = computeFocusAndHeading();
    if (!found) {
      setTransform({ scale: 1, rotateDeg: 0, tx: 0, ty: 0 });
      return;
    }

    setTransform(
      computeOrientTransform({
        ...found,
        screenFrac: ORIENT_SCREEN_FRAC,
        scale: ORIENT_SCALE,
        proj: getProjection(viewBoxRect, rect),
        containerRect: rect,
      })
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computeFocusAndHeading, viewBoxRect]);

  const { containerRef, transform, setTransform } = usePanZoom({
    viewBox: viewBoxRect,
    onDoubleTap: recenter,
  });

  // Genel görünüm sırasında CSS transition uygulansın diye (gesture'lar
  // sırasında bu KAPALI kalmalı, yoksa parmakla sürüklerken gecikme hissi olur).
  const [orientAnimating, setOrientAnimating] = useState(false);
  const overviewTimersRef = useRef([]);

  // Kat/konum/hedef değiştiğinde (sayfa açılışı, poliklinik seçimi) otomatik
  // olarak ortala. Yeni bir ROTA varsa: önce 1-2 saniye tüm rotayı gösteren
  // "genel görünüm", sonra otomatik olarak yakın (yön odaklı) görünüme geçiş.
  useEffect(() => {
    overviewTimersRef.current.forEach(clearTimeout);
    overviewTimersRef.current = [];

    const raf = requestAnimationFrame(() => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const found = computeFocusAndHeading();
      if (!found) {
        setOrientAnimating(false);
        setTransform({ scale: 1, rotateDeg: 0, tx: 0, ty: 0 });
        return;
      }

      const proj = getProjection(viewBoxRect, rect);
      const tight = computeOrientTransform({
        ...found,
        screenFrac: ORIENT_SCREEN_FRAC,
        scale: ORIENT_SCALE,
        proj,
        containerRect: rect,
      });

      const hasRoute = floorSegments.length > 0 && floorSegments[0].points.length >= 2;

      if (!hasRoute) {
        // Rota yok (sayfa ilk açılışı, hedef seçilmemiş) — direkt yakın görünüm.
        setOrientAnimating(false);
        setTransform(tight);
        return;
      }

      // Rotanın tamamını (bu kattaki segment) kapsayacak bir "genel görünüm"
      // hesapla — AYNI rotate açısını koruyarak, sadece zoom'u ayarlayarak.
      const bounds = rotatedBounds(floorSegments[0].points, tight.rotateDeg);
      const spanX = Math.max(bounds.width, 1);
      const spanY = Math.max(bounds.height, 1);
      const overviewScale = Math.min(
        (viewBoxRect.width * OVERVIEW_PADDING) / spanX,
        (viewBoxRect.height * OVERVIEW_PADDING) / spanY,
        ORIENT_SCALE
      );
      const overviewFocus = {
        x: floorSegments[0].points.reduce((s, p) => s + p.x, 0) / floorSegments[0].points.length,
        y: floorSegments[0].points.reduce((s, p) => s + p.y, 0) / floorSegments[0].points.length,
      };
      const overview = computeOrientTransform({
        focusPoint: overviewFocus,
        rotateDeg: tight.rotateDeg,
        screenFrac: { x: 0.5, y: 0.5 },
        scale: overviewScale,
        proj,
        containerRect: rect,
      });

      setOrientAnimating(true);
      setTransform(overview);

      const t1 = setTimeout(() => {
        setTransform(tight);
        const t2 = setTimeout(() => setOrientAnimating(false), OVERVIEW_TRANSITION_MS);
        overviewTimersRef.current.push(t2);
      }, OVERVIEW_HOLD_MS);
      overviewTimersRef.current.push(t1);
    });

    return () => {
      cancelAnimationFrame(raf);
      overviewTimersRef.current.forEach(clearTimeout);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floor, userLocation && userLocation.id, selectedTarget && selectedTarget.id]);

  const gTransform = transformToSvgString(transform);

  return (
    <div className="floor-map-wrapper">
      <div className="floor-map-viewport" ref={containerRef} style={{ touchAction: 'none' }}>
        <svg viewBox={viewBoxAttr} className="floor-map-svg">
          <defs>
            {/* Rota üzerindeki yön okları — her ara waypoint'te yönü gösterir */}
            <marker
              id="route-arrow"
              viewBox="0 0 10 10"
              refX="5"
              refY="5"
              markerWidth="3.2"
              markerHeight="3.2"
              orient="auto-start-reverse"
            >
              <path d="M1,1 L9,5 L1,9 z" className="route-arrow-head" />
            </marker>
          </defs>

            <g
              transform={gTransform}
              className={orientAnimating ? 'floor-content-animated' : undefined}
            >
            {/* Koridorlar: merkez çizgi + iki paralel kenar çizgisi ("yol" görünümü) */}
            {corridorRoads.map(([roadId, road]) => {
              const centerPts = road.nodes
                .map((id) => waypoints[id])
                .filter(Boolean)
                .map((p) => `${p.x},${p.y}`)
                .join(' ');

              const leftPts = offsetRoadPoints(road.nodes, waypoints, ROAD_HALF_WIDTH)
                .map((p) => `${p.x},${p.y}`)
                .join(' ');

              const rightPts = offsetRoadPoints(road.nodes, waypoints, -ROAD_HALF_WIDTH)
                .map((p) => `${p.x},${p.y}`)
                .join(' ');

              return (
                <g key={roadId}>
                  <polyline points={leftPts} className="corridor-edge-line" fill="none" />
                  <polyline points={rightPts} className="corridor-edge-line" fill="none" />
                  <polyline points={centerPts} className="corridor-line" fill="none" />
                </g>
              );
            })}

            {/* Poliklinikler: kendi çokgen koordinatlarından çizilir.
                Renk: p.color varsa o, yoksa kategorinin varsayılanı.
                Asansör/merdiven gibi kategorilerde metin yerine ikon (PNG
                varsa PNG, yoksa vektör) basılır. Hedef poliklinik VE rotanın
                gerçekten kullandığı asansör/merdiven odaları yanıp sönüyor. */}
            {floorPoliclinics.map((p) => {
              if (!p.coordinates || p.coordinates.length < 3) return null;
              const isTarget = selectedTarget && selectedTarget.id === p.id;
              const isUsedConnector =
                (p.category === 'asansor' || p.category === 'merdiven') &&
                connectorWaypointIds &&
                connectorWaypointIds.has(p.entry_waypoint);
              const shouldBlink = isTarget || isUsedConnector;

              const pts = p.coordinates.map((c) => `${c.x},${c.y}`).join(' ');
              const center = polygonCentroid(p.coordinates);
              const textAngle = p.textAngle || 0;
              const colors = getRoomColors(p);
              const showIcon = ICON_CATEGORIES.has(p.category);
              const iconStyle = showIcon ? getCategoryStyle(p.category) : null;
              const iconSize = showIcon ? roomIconSize(p.coordinates) : 0;

              return (
                <g
                  key={p.id}
                  className={`poliklinik-room ${isTarget ? 'active' : ''} ${
                    shouldBlink ? 'room-blink' : ''
                  }`}
                >
                  <polygon
                    points={pts}
                    style={isTarget ? undefined : { fill: colors.fill, stroke: colors.stroke }}
                  />
                  {showIcon ? (
                    iconStyle.image ? (
                      <image
                        href={iconStyle.image}
                        x={center.x - iconSize / 2}
                        y={center.y - iconSize / 2}
                        width={iconSize}
                        height={iconSize}
                        preserveAspectRatio="xMidYMid meet"
                      />
                    ) : (
                      <g
                        transform={`translate(${center.x - iconSize / 2} ${
                          center.y - iconSize / 2
                        }) scale(${iconSize / 24})`}
                        fill={iconStyle.stroke}
                        stroke={iconStyle.stroke}
                        strokeWidth="1"
                      >
                        {iconStyle.icon}
                      </g>
                    )
                  ) : (
                  <text
                    textAnchor="middle"
                    transform={
                      textAngle ? `rotate(${textAngle} ${center.x} ${center.y})` : undefined
                    }
                  >
                    {p.name.split('\n').map((line, i, arr) => (
                      <tspan
                        key={i}
                        x={center.x}
                        y={center.y + (i - (arr.length - 1) / 2) * 3.2}
                      >
                        {line}
                      </tspan>
                    ))}
                  </text>
                  )}
                </g>
              );
            })}

            {/* Rota — sürekli akan kesikli çizgi + yön okları */}
            {floorSegments.map((seg, i) => (
              <RoutePath key={seg.floor + '-' + i} points={seg.points} />
            ))}

            {/* Kullanıcı konumu — hızlı yanıp sönen, büyük işaretçi */}
            {userLocation && userLocation.floor === floor && (
              <g className="user-marker">
                <circle cx={userLocation.x} cy={userLocation.y} r={6} className="user-marker-pulse" />
                <circle cx={userLocation.x} cy={userLocation.y} r={3.2} className="user-marker-dot" />
              </g>
            )}

            {/* Varış noktası — bulunduğun nokta işaretçisiyle aynı tarzda,
                biraz daha küçük ve farklı renkte (kırmızı/kiremit) */}
            {selectedTarget &&
              selectedTarget.floor === floor &&
              waypoints[selectedTarget.entry_waypoint] && (
                <g className="target-marker">
                  <circle
                    cx={waypoints[selectedTarget.entry_waypoint].x}
                    cy={waypoints[selectedTarget.entry_waypoint].y}
                    r={4}
                    className="target-marker-pulse"
                  />
                  {/* rotate(-transform.rotateDeg): harita ne kadar dönerse dönsün, pin
                      bunun tersini uygulayıp ekranda hep dik kalır */}
                  <g
                    transform={`translate(${waypoints[selectedTarget.entry_waypoint].x} ${
                      waypoints[selectedTarget.entry_waypoint].y
                    }) rotate(${-transform.rotateDeg})`}
                  >
                    {TARGET_MARKER_IMAGE ? (
                      <image href={TARGET_MARKER_IMAGE} x={-5} y={-11} width={10} height={11} />
                    ) : (
                      <path
                        d="M0,0 C-3,-5 -6,-8.5 -6,-12 A6,6 0 1,1 6,-12 C6,-8.5 3,-5 0,0 Z"
                        className="target-marker-pin"
                      />
                    )}
                  </g>
                </g>
              )}
          </g>
        </svg>
      </div>

      <button className="reset-view-btn" onClick={recenter} aria-label="Konuma göre ortala">
        ⌂
      </button>
    </div>
  );
}
