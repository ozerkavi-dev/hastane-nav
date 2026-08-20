// Her poliklinik/lokasyon isteğe bağlı bir `category` taşıyabilir
// (data içinde: "category": "wc" gibi). Kategori belirtilmezse "poliklinik"
// varsayılan kabul edilir. Her kategorinin bir varsayılan rengi ve arama
// çubuğunda/haritada kullanılacak küçük bir ikonu var.
//
// Renk override: bir poliklinikte `color` alanı varsa (data içinde
// "color": "#3498db" gibi), kategori renginin yerine o kullanılır — kategori
// sadece İKON'u belirlemeye devam eder.
//
// Resim (PNG) ikon: bir kategoride `image` alanı tanımlıysa (aşağıdaki
// asansor/merdiven gibi), harita üzerinde vektör ikon yerine bu PNG
// kullanılır. Dosyayı frontend/public/icons/ klasörüne koyman yeterli —
// detay için o klasördeki README.md'ye bak. `image` tanımlı değilse (örn.
// wc, güvenlik, kantin, poliklinik, genel) aşağıdaki vektör ikon kullanılır.

export const DEFAULT_CATEGORY = 'poliklinik';

export const CATEGORY_STYLES = {
  poliklinik: {
    label: 'Poliklinik',
    color: '#fbe4d0',
    stroke: '#ec6e00',
    // Basit bir "artı/tıbbi" ikon
    icon: (
      <>
        <rect x="4" y="9" width="16" height="6" rx="1.5" />
        <rect x="9" y="4" width="6" height="16" rx="1.5" />
      </>
    ),
  },
  wc: {
    label: 'WC',
    color: '#dbeafe',
    stroke: '#2563eb',
    icon: (
      <text x="12" y="16" textAnchor="middle" fontSize="9" fontWeight="700">
        WC
      </text>
    ),
  },
  guvenlik: {
    label: 'Güvenlik',
    color: '#e5e7eb',
    stroke: '#374151',
    icon: (
      // Basit kalkan silueti
      <path d="M12 3 L20 6 V11 C20 16.5 16.5 20.2 12 21.5 C7.5 20.2 4 16.5 4 11 V6 Z" />
    ),
  },
  asansor: {
    label: 'Asansör',
    color: '#dbeafe',
    stroke: '#1d4ed8',
    image: '/icons/asansor.png',
    icon: (
      <>
        <rect x="4" y="3" width="16" height="18" rx="1.5" />
        <path d="M9 10 L12 6.5 L15 10" fill="none" strokeWidth="1.6" />
        <path d="M9 14 L12 17.5 L15 14" fill="none" strokeWidth="1.6" />
      </>
    ),
  },
  merdiven: {
    label: 'Merdiven',
    color: '#ede9d8',
    stroke: '#8a6d1f',
    image: '/icons/merdiven.png',
    icon: (
      // Basit merdiven basamağı silueti (zigzag)
      <path d="M4 20 H9 V16 H13 V12 H17 V8 H20 V4" fill="none" strokeWidth="2" />
    ),
  },
  kantin: {
    label: 'Kantin / Kafe',
    color: '#fde68a',
    stroke: '#b45309',
    icon: (
      // Basit fincan silueti
      <>
        <path d="M5 8 H16 V13 C16 17 13 19 10.5 19 C8 19 5 17 5 13 Z" fill="none" strokeWidth="1.6" />
        <path d="M16 9.5 H18 C19.5 9.5 19.5 13.5 16 13.5" fill="none" strokeWidth="1.6" />
      </>
    ),
  },
  genel: {
    label: 'Genel Alan',
    color: '#f1f2f4',
    stroke: '#9aa1a8',
    icon: (
      <circle cx="12" cy="12" r="7" />
    ),
  },
};

export function getCategoryStyle(category) {
  return CATEGORY_STYLES[category] || CATEGORY_STYLES[DEFAULT_CATEGORY];
}

// Bir poliklinik nesnesinin dolgu/kenar rengini döner — `color` alanı
// tanımlıysa onu, yoksa kategorisinin varsayılanını kullanır.
export function getRoomColors(p) {
  const style = getCategoryStyle(p.category);
  return {
    fill: p.color || style.color,
    stroke: p.strokeColor || style.stroke,
  };
}
