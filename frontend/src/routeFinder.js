// ─────────────────────────────────────────────────────────────
// Rota bulma mantığı
//
// Temel fikir: her koridor (ve asansör) bir "road" = waypoint ID
// kümesidir. İki road, ortak bir waypoint paylaşıyorsa komşudur.
// BFS, road'lar üzerinde çalışıp start->end arası en az sayıda
// road değişimi gerektiren zinciri bulur. Asansör da bir road
// olduğu için (iki kattaki lobi noktasını içerir), kat geçişi
// ayrı bir özel durum değil, algoritmanın doğal bir sonucu olur.
// ─────────────────────────────────────────────────────────────

function findRoadsContaining(waypointId, roads) {
  return Object.keys(roads).filter((roadId) =>
    roads[roadId].nodes.includes(waypointId)
  );
}

function getNeighborRoads(roadId, roads) {
  const nodes = new Set(roads[roadId].nodes);
  return Object.keys(roads).filter((otherId) => {
    if (otherId === roadId) return false;
    return roads[otherId].nodes.some((n) => nodes.has(n));
  });
}

function getIntersection(roadA, roadB, roads) {
  const setA = new Set(roads[roadA].nodes);
  return roads[roadB].nodes.find((n) => setA.has(n)) || null;
}

// start road'undan end road'una, road'lar arası BFS.
// Birden fazla eşit uzunlukta yol bulunabileceği için hepsini roadMap'e toplar,
// aralarından en kısa waypoint dizisine sahip olanı sonda seçeceğiz.
function bfsRoads(startRoad, endRoad, roads) {
  const queue = [[startRoad]];
  const visited = new Set();
  const roadMap = [];

  while (queue.length > 0) {
    const currentPath = queue.shift();
    const road = currentPath[currentPath.length - 1];

    if (road === endRoad) {
      const roadlink = [];
      for (let i = 0; i < currentPath.length - 1; i++) {
        roadlink.push(getIntersection(currentPath[i], currentPath[i + 1], roads));
      }
      roadMap.push({ road: currentPath, roadlink });
      continue;
    }

    if (!visited.has(road)) {
      visited.add(road);
      for (const neighbor of getNeighborRoads(road, roads)) {
        queue.push([...currentPath, neighbor]);
      }
    }
  }

  return roadMap;
}

// Bir road içinde iki waypoint arasındaki sıralı alt diziyi döner.
function getValuesInRange(roadId, startWaypoint, endWaypoint, roads) {
  const nodes = roads[roadId].nodes;
  const startIndex = nodes.indexOf(startWaypoint);
  const endIndex = nodes.indexOf(endWaypoint);

  if (startIndex === -1 || endIndex === -1) return null;

  let slice = nodes.slice(Math.min(startIndex, endIndex), Math.max(startIndex, endIndex) + 1);
  if (startIndex > endIndex) slice = slice.reverse();
  return slice;
}

// roadMap (road zincirleri) üzerinden gerçek waypoint dizilerini üretir.
function buildWaypointSequences(startWaypoint, endWaypoint, roadMap, roads) {
  const sequences = [];

  for (const item of roadMap) {
    let points = [];
    let ok = true;

    for (let i = 0; i < item.road.length; i++) {
      const roadId = item.road[i];
      const segStart = i === 0 ? startWaypoint : item.roadlink[i - 1];
      const segEnd = i === item.road.length - 1 ? endWaypoint : item.roadlink[i];

      const segment = getValuesInRange(roadId, segStart, segEnd, roads);
      if (!segment) {
        ok = false;
        break;
      }

      // Ardışık segmentlerin ortak noktasını iki kere eklememek için ilk noktayı atla
      points = points.concat(i === 0 ? segment : segment.slice(1));
    }

    if (ok) sequences.push(points);
  }

  return sequences;
}

/**
 * İki waypoint arası en kısa (en az adımlı) rotayı bulur.
 * @returns {string[]|null} waypoint ID dizisi (start -> end), bulunamazsa null
 */
function countFloorChanges(seq, waypoints) {
  let changes = 0;
  for (let i = 1; i < seq.length; i++) {
    if (waypoints[seq[i]].floor !== waypoints[seq[i - 1]].floor) changes++;
  }
  return changes;
}

export function findRoute(startWaypoint, endWaypoint, data) {
  const { roads, waypoints } = data;

  if (startWaypoint === endWaypoint) return [startWaypoint];

  const startRoads = findRoadsContaining(startWaypoint, roads);
  const endRoads = findRoadsContaining(endWaypoint, roads);

  if (startRoads.length === 0 || endRoads.length === 0) return null;

  // Sıralama kriteri artık İKİ aşamalı: önce EN AZ KAT DEĞİŞİMİ (fiziksel
  // olarak mantıklı rota), sadece kat değişimi sayısı eşitse waypoint
  // sayısına (mesafeye) bakılıyor. Eskiden sadece waypoint sayısına bakıyordu,
  // bu da bazen gereksiz kat atlayan ama "sayıca kısa" rotaları seçtiriyordu.
  let best = null;
  let bestFloorChanges = Infinity;

  for (const sRoad of startRoads) {
    for (const eRoad of endRoads) {
      const roadMap = bfsRoads(sRoad, eRoad, roads);
      const sequences = buildWaypointSequences(startWaypoint, endWaypoint, roadMap, roads);

      for (const seq of sequences) {
        const floorChanges = countFloorChanges(seq, waypoints);
        const better =
          floorChanges < bestFloorChanges ||
          (floorChanges === bestFloorChanges && (!best || seq.length < best.length));

        if (better) {
          best = seq;
          bestFloorChanges = floorChanges;
        }
      }
    }
  }

  return best;
}

/**
 * Waypoint ID dizisini, koordinat + kat bilgisiyle zenginleştirir
 * ve kat geçişlerini ayrı "segment"lere böler (her segment tek katta).
 */
export function annotateRoute(waypointIds, data) {
  if (!waypointIds) return [];
  return waypointIds.map((id) => ({ id, ...data.waypoints[id] }));
}

export function splitRouteByFloor(annotatedRoute) {
  const segments = [];
  let current = null;

  for (const point of annotatedRoute) {
    if (!current || current.floor !== point.floor) {
      current = { floor: point.floor, points: [] };
      segments.push(current);
    }
    current.points.push(point);
  }

  return segments;
}
