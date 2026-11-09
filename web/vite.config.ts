import {defineConfig} from 'vitest/config';
import react from '@vitejs/plugin-react';
export default defineConfig({plugins:[react()],base:'./',build:{outDir:'../frontend/app',emptyOutDir:true,sourcemap:false},server:{proxy:{'/api':'http://127.0.0.1:5000','/runtime-config.js':'http://127.0.0.1:5000'}},test:{environment:'jsdom',setupFiles:['./src/test-setup.ts']}});
