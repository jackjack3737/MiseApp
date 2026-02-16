const appJson = require('./app.json');

module.exports = () => {
  const name = process.env.APP_DISPLAY_NAME || appJson.expo.name;
  return {
    ...appJson,
    expo: {
      ...appJson.expo,
      name,
    },
  };
};
