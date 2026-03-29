import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { defineConfig, type Plugin } from 'vite';

/**
 * Auto-warmup plugin: fires a background HTTP request as soon as the dev
 * server starts listening. This triggers SvelteKit's full SSR pipeline
 * (Svelte compilation, Tailwind, hooks, etc.) so that by the time the
 * developer opens their browser, everything is already compiled.
 */
function devSSRWarmup(): Plugin {
  return {
    name: 'dev-ssr-warmup',
    apply: 'serve',
    configureServer(server) {
      server.httpServer?.once('listening', () => {
        const addr = server.httpServer?.address();
        if (addr && typeof addr !== 'string') {
          // Single fetch to /login: triggers hooks.server.ts (DB pool warmup),
          // auth module, and Svelte SSR compilation pipeline.
          setTimeout(() => {
            fetch(`https://localhost:${addr.port}/login`, {
              // Ignore self-signed cert in dev warmup
              ...(process.env.NODE_TLS_REJECT_UNAUTHORIZED === '0' ? {} : {})
            }).catch(() => {});
          }, 150);
        }
      });
    }
  };
}

export default defineConfig({
  plugins: [tailwindcss(), sveltekit(), devSSRWarmup(), basicSsl()],
  server: {
    warmup: {
      clientFiles: [
        'src/lib/ui/index.ts',
        'src/routes/(app)/+layout.svelte',
        'src/routes/(app)/app/overview/+page.svelte',
        'src/routes/(auth)/login/+page.svelte',
        'src/routes/+page.svelte',
      ],
      ssrFiles: [
        'src/hooks.server.ts',
        'src/routes/(app)/+layout.server.ts',
        'src/routes/(app)/app/overview/+page.server.ts',
      ]
    }
  },
  optimizeDeps: {
    include: ['lucide-svelte']
  },
  ssr: {
    optimizeDeps: {
      include: [
        'lucide-svelte',
        'drizzle-orm',
        'drizzle-orm/node-postgres',
        'pg',
        'bcryptjs',
        'jsonwebtoken',
        'zod',
      ]
    }
  }
});
