import { defineConfig } from 'vite';
import obfuscatorPlugin from 'rollup-plugin-obfuscator';

export default defineConfig({
  base: '/Dojin-econ-game/',
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
