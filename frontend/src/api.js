// Bu proje artık TAMAMEN STATİK çalışacak şekilde kurulu — ayrı bir backend
// sunucusuna (Express) ihtiyaç yok. Veri, frontend'in kendi public/ klasörü
// içinden (public/data/hospital-data.json) servis ediliyor, yani `npm run
// build` sonrası çıkan dist/ klasörünü herhangi bir statik barındırma
// servisine (GitHub Pages, Vercel, Netlify, Cloudflare Pages...) atman
// yeterli — ayrı bir sunucu çalıştırmana gerek kalmıyor.
//
// Not: backend/ klasörü hâlâ projede duruyor — ileride "gerçek" bir sunucu
// üzerinden (örn. admin panelinden veri güncelleme) gitmek istersen orası
// hazır, ama bu statik/deneme dağıtımı için gerekli değil.

export async function fetchHospitalData() {
  const res = await fetch(`${import.meta.env.BASE_URL}data/hospital-data.json`);
  if (!res.ok) throw new Error('Harita verisi alınamadı');
  return res.json();
}

// QR kodun taşıdığı waypoint ID'sinin geçerli olup olmadığını, zaten
// yüklenmiş olan veri üzerinden (ağ isteği atmadan) doğrular.
export function resolveLocationFromData(data, waypointId) {
  const wp = data.waypoints[waypointId];
  if (!wp) return null;
  return { id: waypointId, ...wp };
}
