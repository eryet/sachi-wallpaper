// wallpaper properties
// https://docs.wallpaperengine.io/en/web/customization/properties.html

var clearT = function () {
  // t == timeout
  try {
    clearTimeout(t);
  } catch (e) {
    console.log(e);
  }
};

var starnumber = 1000;
var shootingstarnumber = 5;

window.wallpaperPropertyListener = {
  applyUserProperties: function (properties) {
    if (properties.shootingstarnumber) {
      clearT();
      shootingstarnumber = properties.shootingstarnumber.value;
      entities = [];
      entitiesUpdate();
    }
    if (properties.starnumber) {
      clearT();
      starnumber = properties.starnumber.value;
      entities = [];
      entitiesUpdate();
    }
  },
};
