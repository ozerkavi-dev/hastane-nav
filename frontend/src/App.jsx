import { useEffect, useMemo, useState } from 'react';
import { fetchHospitalData, resolveLocationFromData } from './api';
import { findRoute, annotateRoute, splitRouteByFloor } from './routeFinder';
import SearchBox from './components/SearchBox';
import FloorMap from './components/FloorMap';
import FloorSwitcher from './components/FloorSwitcher';
import './styles.css';

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [userLocation, setUserLocation] = useState(null); // {id,x,y,floor}
  const [selectedTarget, setSelectedTarget] = useState(null); // poliklinik objesi
  const [activeFloor, setActiveFloor] = useState(null);

  // 1) Veriyi çek, 2) URL'deki ?loc= parametresini oku ve doğrula
  useEffect(() => {
    async function init() {
      try {
        const hospitalData = await fetchHospitalData();
        setData(hospitalData);

        const params = new URLSearchParams(window.location.search);
        const locParam = params.get('loc');

        if (locParam) {
          const resolved = resolveLocationFromData(hospitalData, locParam);
          if (resolved) {
            setUserLocation(resolved);
            setActiveFloor(resolved.floor);
          } else {
            setError(`QR kodundaki konum ("${locParam}") tanınmadı.`);
            setActiveFloor(1);
          }
        } else {
          // QR okutulmadan direkt açılmışsa: kullanıcı konumu bilinmiyor,
          // sadece harita/arama gösterilir, rota hesaplanamaz.
          setActiveFloor(1);
        }
      } catch (e) {
        setError('Harita verisi yüklenemedi.');
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // Rota: kullanıcı konumu + seçilen poliklinik ikisi de varsa hesapla
  const routeInfo = useMemo(() => {
    if (!data || !userLocation || !selectedTarget) return null;

    const waypointIds = findRoute(userLocation.id, selectedTarget.entry_waypoint, data);
    if (!waypointIds) return null;

    const annotated = annotateRoute(waypointIds, data);
    const segments = splitRouteByFloor(annotated);

    // Sadece GERÇEK kat geçişinin olduğu waypoint çiftini işaretliyoruz —
    // "rota bu noktadan geçiyor mu" değil, "rota burada asansör/merdiven
    // KULLANIYOR mu" sorusu bu. Aksi halde, merdivenin önünden yürüyerek
    // geçen düz bir rota da o merdiveni yanlışlıkla "kullanılıyor" gösterirdi.
    const connectorWaypointIds = new Set();
    for (let i = 0; i < segments.length - 1; i++) {
      const a = segments[i].points[segments[i].points.length - 1];
      const b = segments[i + 1].points[0];
      connectorWaypointIds.add(a.id);
      connectorWaypointIds.add(b.id);
    }

    return {
      segments,
      floorsOnRoute: segments.map((s) => s.floor),
      connectorWaypointIds,
    };
  }, [data, userLocation, selectedTarget]);

function handleSelectPoliklinik(p) {
  setSelectedTarget(p);
  // Farklı katta bir hedef seçilse bile, önce BULUNDUĞUN katı göster —
  // hedef kata geçiş "Diğer kata geç" butonuyla kullanıcının kararı olsun.
  setActiveFloor(userLocation ? userLocation.floor : p.floor);
}

  const isMultiFloorRoute = Boolean(routeInfo && routeInfo.floorsOnRoute.length > 1);

  // Rota birden fazla katı kapsıyorsa, rotanın geçtiği katlar arasında (sırayla)
  // gidip gelmeyi tek bir düğmeyle yapıyoruz — aynı düğme "diğer kata geç",
  // tekrar basınca "ilk kata dön" gibi çalışır.
  const routeFloors = isMultiFloorRoute ? [...new Set(routeInfo.floorsOnRoute)] : [];
  const routeFloorIndex = routeFloors.indexOf(activeFloor);
  const nextRouteFloor =
    routeFloorIndex === -1 ? routeFloors[0] : routeFloors[(routeFloorIndex + 1) % routeFloors.length];

  if (loading) return <div className="status-message">Yükleniyor...</div>;
  if (!data) return <div className="status-message error">{error}</div>;

  const floors = [...new Set(Object.values(data.waypoints).map((w) => w.floor))].sort(
    (a, b) => a - b
  );

  return (
    <div className="app">
      <header className="app-header">
        <h1>Hastane Navigasyon</h1>
      </header>

      {error && <div className="banner-error">{error}</div>}

      <SearchBox policlinics={data.policlinics} onSelect={handleSelectPoliklinik} />

      {!userLocation && (
        <div className="banner-info">
          Konumunuz bilinmiyor — QR kod okutmadan rota hesaplanamaz, sadece harita gösteriliyor.
        </div>
      )}

      {isMultiFloorRoute && (
        <div className="banner-info">
          Rota {routeInfo.floorsOnRoute.length} kat içeriyor — asansör/merdiven ile
          Kat {routeInfo.floorsOnRoute.join(' → Kat ')} sırasını takip edin.
        </div>
      )}

      {selectedTarget && !routeInfo && userLocation && (
        <div className="banner-error">Bu iki nokta arasında bir rota bulunamadı.</div>
      )}

      {isMultiFloorRoute ? (
        <button className="view-mode-toggle" onClick={() => setActiveFloor(nextRouteFloor)}>
          ↕ Kat {activeFloor} → Kat {nextRouteFloor}
        </button>
      ) : (
        <FloorSwitcher
          floors={floors}
          activeFloor={activeFloor}
          onChange={setActiveFloor}
          floorsOnRoute={routeInfo ? routeInfo.floorsOnRoute : []}
        />
      )}

      <FloorMap
        data={data}
        floor={activeFloor}
        routeSegments={routeInfo ? routeInfo.segments : []}
        connectorWaypointIds={routeInfo ? routeInfo.connectorWaypointIds : null}
        userLocation={userLocation}
        selectedTarget={selectedTarget}
      />
    </div>
  );
}
