# İkon dosyaları buraya

Vite'ta `public/` klasörüne koyduğun her dosya, derleme olmadan doğrudan
kök URL'den servis edilir. Yani:

  frontend/public/icons/asansor.png  →  tarayıcıda /icons/asansor.png

Şu an kod şu iki dosyayı arıyor (categoryStyles.jsx içinde tanımlı):

  - icons/asansor.png
  - icons/merdiven.png

Bu dosyaları buraya (frontend/public/icons/ klasörüne) atman yeterli,
başka hiçbir şey değiştirmene gerek yok — kod otomatik bulur.

İstersen diğer kategoriler için de PNG ekleyebilirsin (wc.png, guvenlik.png,
kantin.png, poliklinik.png gibi) — eklediğin her PNG için
categoryStyles.jsx içindeki ilgili kategoriye `image: '/icons/dosya.png'`
satırını eklemen yeterli, aşağıda örneği var.
