const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Add support for JSON files in exercises and ONNX models
config.resolver.assetExts.push('json', 'onnx');

// The local firebase/ directory (Cloud Functions) conflicts with the firebase
// npm package. When Metro resolves 'firebase/functions', it finds
// firebase/functions/package.json (Cloud Functions) instead of
// node_modules/firebase/functions/. Fix by:
// 1. Blocking the local firebase/ directory from the module graph
// 2. Explicitly mapping 'firebase' to node_modules
config.resolver.blockList = [
  ...(config.resolver.blockList ? [config.resolver.blockList] : []),
  new RegExp(path.resolve(__dirname, 'firebase') + '/.*'),
];
config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  firebase: path.resolve(__dirname, 'node_modules/firebase'),
};

module.exports = config;
