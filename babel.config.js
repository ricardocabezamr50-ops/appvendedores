module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // ⚠️ SIEMPRE último:
      'react-native-worklets/plugin',
    ],
  };
};
