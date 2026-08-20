// ─────────────────────────────────────────────────────────────
// Rota bulma mantığı — waypoint seviyesinde, gerçek mesafeye göre
// en kısa yol (Dijkstra). Kat değişimine (asansör/merdiven) çok yüksek
// bir "ceza" veriliyor ki hiçbir yürüme mesafesi, gereksiz bir kat
// değişimine değecek kadar "ucuz" görünmesin — yani rota, fiziksel
// olarak mantıklı olan en az kat değişimli yolu her zaman tercih eder,
// aralarında eşitlik varsa gerçek mesafeye göre en kısayı seçer.
// ─────────────────────────────────────────────────────────────

const FLOOR_CHANGE_PENALTY = 5000;

function buildAdjacency(data) {
  const { roads, waypoints } = data;
  const adj = {};

  function addEdge(a, b, weight) {
    if (!adj[a]) adj[a] = [];
    if (!adj[b]) adj[b] = [];
    adj[a].push({ to: b, weight });
    adj[b].push({ to: a, weight });
  }

  for (const road of Object.values(roads)) {
    const nodes = road.nodes;
    for (let i = 0; i < nodes.length - 1; i++) {
      const a = nodes[i];
      const b = nodes[i + 1];
      const wa = waypoints[a];
      const wb = waypoints[b];
      if (!wa || !wb) continue;

      const weight =
        wa.floor !== wb.floor
          ? FLOOR_CHANGE_PENALTY
          : Math.hypot(wa.x - wb.x, wa.y - wb.y);

      addEdge(a, b, weight);
    }
  }

  return adj;
}

function dijkstra(adj, start, end) {
  const dist = { [start]: 0 };
  const prev = {};
  const visited = new Set();
  const queue = new Set([start]);

  while (queue.size > 0) {
    let u = null;
    let best = Infinity;
    for (const n of queue) {
      if (dist[n] < best) {
        best = dist[n];
        u = n;
      }
    }
    if (u === null) break;
    queue.delete(u);
    if (u === end) break;
    visited.add(u);

    for (const { to, weight } of adj[u] || []) {
      if (visited.has(to)) continue;
      const nd = dist[u] + weight;
      if (dist[to] === undefined || nd < dist[to]) {
        dist[to] = nd;
        prev[to] = u;
        queue.add(to);
      }
    }
  }

  if (dist[end] === undefined) return null;

  const path = [end];
  let cur = end;
  while (cur !== start) {
    cur = prev[cur];
    if (cur === undefined) return null;
    path.push(cur);
  }
  path.reverse();
  return path;
}

/**
 * İki waypoint arası en kısa (gerçek mesafeye göre, kat değişimini
 * caydıran) rotayı bulur.
 * @returns {string[]|null} waypoint ID dizisi (start -> end), bulunamazsa null
 */
export function findRoute(startWaypoint, endWaypoint, data) {
  if (startWaypoint === endWaypoint) return [startWaypoint];
  const adj = buildAdjacency(data);
  return dijkstra(adj, startWaypoint, endWaypoint);
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