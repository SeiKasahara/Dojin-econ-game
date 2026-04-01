import { defineConfig } from 'vite';
import obfuscatorPlugin from 'rollup-plugin-obfuscator';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig({
  base: '/Dojin-econ-game/',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    rollupOptions: {
      plugins: [
        obfuscatorPlugin({
          include: [
            'src/engine/**/*.js',
            'src/save.js',
            'src/hash.js',
            'src/achievements.js',
            'src/chat-npc.js',
            'src/market.js',
          ],
          options: {
            compact: true,
            stringArray: true,
            stringArrayThreshold: 0.75,
          },
        }),
      ],
    },
  },
  test: {
    // Mock CSS/font imports that icons.js pulls in
    css: false,
    deps: {
      inline: ['@phosphor-icons/web'],
    },
  },
});
