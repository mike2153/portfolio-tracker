const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Minimal config for debugging
config.resolver.unstable_enablePackageExports = false;

module.exports = config;