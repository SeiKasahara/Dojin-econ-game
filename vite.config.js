import { defineConfig } from 'vite';

export default defineConfig({
  base: '/Dojin-econ-game/',
  test: {
    // Mock CSS/font imports that icons.js pulls in
    css: false,
    deps: {
      inline: ['@phosphor-icons/web'],
    },
  },
});
