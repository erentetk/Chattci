const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Web için React Native'i yapılandır
config.resolver.sourceExts.push('jsx', 'js', 'ts', 'tsx', 'json');
config.resolver.assetExts.push('db', 'mp3', 'ttf', 'obj', 'png', 'jpg');

module.exports = config; 