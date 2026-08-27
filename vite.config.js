import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  base: './',
  server: {
    port: 5173,
    open: false,
    watch: {
      // 忽略项目数据/临时目录：避免 watch 到浏览器 profile 等被锁文件触发 EBUSY
      ignored: ['**/.workbuddy/**']
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
