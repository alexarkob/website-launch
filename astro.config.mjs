// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

import tailwindcss from '@tailwindcss/vite';
import { adpDevApi } from './src/lib/adpDevApi.ts';

// https://astro.build/config
export default defineConfig({
  integrations: [react()],
  vite: {
    plugins: [tailwindcss(), adpDevApi()],
    optimizeDeps: {
      include: ["jspdf", "jspdf-autotable"],
    },
  }
});
