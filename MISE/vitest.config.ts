import { defineConfig } from 'vitest/config';

// Pruebas unitarias del dominio puro (Node).
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
