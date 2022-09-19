// wallpaper properties
// https://docs.wallpaperengine.io/en/web/customization/properties.html

// Object;
// index: 2;
// order: 102;
// text: "<br />老婆去除<br />Waifu Remove<br />";
// type: "bool";
// value: true;

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
      shootingstarnumber = properties.shootingstarnumber.value;
      entities = [];
      entitiesUpdate();
    }
    if (properties.starnumber) {
      starnumber = properties.starnumber.value;
      entities = [];
      entitiesUpdate();
    }
    if (properties.waifuvisibility) {
      properties.waifuvisibility.value
        ? document.getElementById("sachi").classList.add("visibility")
        : document.getElementById("sachi").classList.remove("visibility");
    }
    if (properties.clockcolor) {
      var customColor = properties.clockcolor.value.split(" ");
      customColor = customColor.map(function (c) {
        return Math.ceil(c * 255);
      });
      var customColorAsCSS = "rgb(" + customColor + ")";
      document.getElementById("clock").style.color = customColorAsCSS;
    }
    if (properties.textshadowcolor) {
      var customColor = properties.textshadowcolor.value.split(" ");
      customColor = customColor.map(function (c) {
        return Math.ceil(c * 255);
      });
      var customColorAsCSS = "rgb(" + customColor + ")";
      document.getElementById("clock").style.textShadow =
        "0 0 35px " + customColorAsCSS;
    }
    if (properties.rgbmode) {
      properties.rgbmode.value
        ? document.getElementById("sachi").classList.add("rgb_effect")
        : document.getElementById("sachi").classList.remove("rgb_effect");
    }
  },
};
