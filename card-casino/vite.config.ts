import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    // Screens with many clicks can take a few seconds when the whole suite runs at once.
    testTimeout: 15_000,
  },
});
