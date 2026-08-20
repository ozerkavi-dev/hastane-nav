import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // './' => göreli yollar üretir, yani proje kök domainde de
  // ('https://x.vercel.app/'), bir alt yolda da ('https://kullanici.github.io/proje/')
  // sorunsuz çalışır. Statik/deneme dağıtımı için bu en taşınabilir seçenek.
  base: './',
  server: {
    port: 5173,
    // host: true => 0.0.0.0'da dinler, yani aynı ağdaki başka cihazlar
    // (telefon gibi) bu bilgisayarın IP'si üzerinden erişebilir.
    // Varsayılan (host verilmezse) sadece localhost'tan erişilebilir olurdu.
    host: true,
  },
});
