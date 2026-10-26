import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin';
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

// Pruebas de integración HTTP: el Worker real dentro de workerd con D1 local (Miniflare).
export default defineConfig(async () => {
  if (!existsSync('dist/client/index.html')) {
    mkdirSync('dist/client', { recursive: true });
    writeFileSync('dist/client/index.html', '<!doctype html><title>MISE</title><div id="root"></div>');
  }
  const migrations = await readD1Migrations('./migrations');
  return {
    plugins: [
      cloudflareTest({
        main: './src/worker/index.ts',
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            AUTH_MODE: 'access',
            ACCESS_TEAM_DOMAIN: 'https://mise-test.cloudflareaccess.com',
            ACCESS_AUD: 'test-aud-123',
            OWNER_EMAILS: 'chef@example.com,ayudante@example.com',
            APP_ENV: 'test',
            MAX_UPLOAD_BYTES: '2000000',
          },
        },
      }),
    ],
    test: {
      include: ['tests/integration/**/*.test.ts'],
      setupFiles: ['./tests/integration/setup.ts'],
      testTimeout: 30000,
    },
  };
});
