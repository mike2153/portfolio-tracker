const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Debug configuration for propTypes issues
config.resolver.unstable_enablePackageExports = false;
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Add resolver to help with propTypes issues
config.resolver.resolverMainFields = ['react-native', 'browser', 'main'];

// Add shared module to watch folders and node modules paths
const sharedPath = path.resolve(__dirname, '../shared');
config.watchFolders = [sharedPath];
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(__dirname, '../shared'),
];

// Add support for Victory Native
config.resolver.assetExts = [...config.resolver.assetExts, 'svg'];
config.resolver.sourceExts = [...config.resolver.sourceExts, 'svg', 'ts', 'tsx', 'js', 'jsx', 'json'];

// Transform configuration
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: true,
  },
});

module.exports = config;