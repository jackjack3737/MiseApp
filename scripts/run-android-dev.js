#!/usr/bin/env node
/**
 * Build developer (debug) app senza richiesta interattiva della porta.
 * Imposta NODE_ENV e EXPO_USE_METRO_PORT prima di expo run:android.
 */
const { spawn } = require('child_process');
const path = require('path');

const env = {
  ...process.env,
  NODE_ENV: 'development',
  EXPO_USE_METRO_PORT: '8083',
};

const cwd = path.resolve(__dirname, '..');
const child = spawn('npx', ['expo', 'run:android'], {
  stdio: 'inherit',
  env,
  cwd,
  shell: true,
});

child.on('exit', (code) => process.exit(code != null ? code : 0));
