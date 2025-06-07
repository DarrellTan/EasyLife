const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

defaultConfig.resolver.assetExts.push('onnx');

module.exports = defaultConfig;

config.resolver.sourceExts.push('cjs');

// This is the new line you should add in, after the previous lines
config.resolver.unstable_enablePackageExports = false;

module.exports = withNativeWind(config, { input: './app/global.css' });

