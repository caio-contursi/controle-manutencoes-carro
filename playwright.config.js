import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/start-server.js',
  workers: 1,
  use: {
    actionTimeout: 7000,
    baseURL: 'http://127.0.0.1:5189',
    timezoneId: 'America/Sao_Paulo',
  },
})
