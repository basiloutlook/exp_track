module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'], // handles Expo Router and env
    plugins: [], // no inline-dotenv or expo-router/babel
  };
};
