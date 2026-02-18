const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Non escludere /dist/ in node_modules (serve per event-target-shim e altri pacchetti)
module.exports = config;
