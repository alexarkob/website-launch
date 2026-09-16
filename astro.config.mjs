// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

import tailwindcss from '@tailwindcss/vite';
import { adpDevApi } from './src/lib/adpDevApi.ts';
import { thinkersDevApi } from './src/lib/thinkersDevApi.ts';
import { softballDevApi } from './src/lib/softballDevApi.ts';

// https://astro.build/config
export default defineConfig({
  integrations: [react()],
  vite: {
    plugins: [tailwindcss(), adpDevApi(), thinkersDevApi(), softballDevApi()],
    optimizeDeps: {
      include: ["jspdf", "jspdf-autotable", "pdfjs-dist", "jszip", "minisearch", "@dnd-kit/core", "@dnd-kit/sortable", "@dnd-kit/utilities"],
    },
  }
});
