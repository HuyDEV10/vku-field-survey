import { defineConfig } from 'vite';
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
export default defineConfig({
  plugins: [
    {
      name: 'offline-shell',
      async generateBundle(_, bundle) {
        const assets = [
          '/',
          '/index.html',
          '/manifest.json',
          '/icons/icon-192.png',
          '/icons/icon-512.png',
          '/icons/maskable-512.png',
          ...Object.keys(bundle)
            .filter((n) => /\.(js|css|woff2)$/.test(n))
            .map((n) => '/' + n),
        ];
        const version = createHash('sha256')
          .update(
            Object.values(bundle)
              .map((v) => v.code ?? v.source)
              .join(''),
          )
          .digest('hex')
          .slice(0, 12);
        const result = await build({
          entryPoints: ['src/sw.js'],
          bundle: true,
          write: false,
          format: 'iife',
          target: 'es2022',
          define: {
            __PRECACHE__: JSON.stringify(assets),
            __CACHE_NAME__: JSON.stringify('vku-shell-' + version),
          },
        });
        this.emitFile({ type: 'asset', fileName: 'sw.js', source: result.outputFiles[0].text });
      },
    },
  ],
});
