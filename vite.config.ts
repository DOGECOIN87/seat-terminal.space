import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';

/* The dev server injects inline scripts for hot reload, which the
   Content-Security-Policy in index.html forbids. Drop the policy in dev only;
   every production build ships it. */
const devWithoutCsp: Plugin = {
  name: 'dev-without-csp',
  apply: 'serve',
  transformIndexHtml: (html) => html.replace(/<meta\s+http-equiv="Content-Security-Policy"[\s\S]*?\/>/, ''),
};

export default defineConfig({
  plugins: [react(), devWithoutCsp],
  // The site lives at the root of seat-terminal.space.
  base: '/',
  build: {
    // Never inline assets as data: URIs — the Content-Security-Policy only allows 'self'.
    assetsInlineLimit: 0,
    target: 'es2020',
  },
});
