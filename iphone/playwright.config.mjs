import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests',workers:1,reporter:'list',use:{browserName:'chromium',channel:'chrome',viewport:{width:393,height:852}},webServer:{command:'node tests/server.mjs',port:4179,reuseExistingServer:false}});
