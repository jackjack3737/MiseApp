const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Esclude la cartella dist dal file map e dal watcher (evita ENOENT quando dist viene cancellata)
const defaultBlockList = config.resolver.blockList;
const distPattern = /[/\\]dist[/\\].*/;
config.resolver.blockList = Array.isArray(defaultBlockList)
  ? [...defaultBlockList, distPattern]
  : [defaultBlockList, distPattern];

module.exports = config;
