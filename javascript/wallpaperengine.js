// wallpaper properties
// https://docs.wallpaperengine.io/en/web/customization/properties.html

// Object;
// index: 2;
// order: 102;
// text: "<br />老婆去除<br />Waifu Remove<br />";
// type: "bool";
// value: true;

var clearT = function () {
  try {
    clearTimeout(t);
  } catch (e) {
    console.log(e);
  }
};

var starnumber = 1000;
var shootingstarnumber = 5;
var starsize = 3;
var shootingstarsize = 3.5;
var shootingstarlength = 90;
var sachiElement = document.getElementById("sachi");
var clockElement = document.getElementById("clock");

function rgbToCSS(colorArray) {
  var customColor = colorArray.split(" ").map(function (c) {
    return Math.ceil(c * 255);
  });
  return "rgb(" + customColor + ")";
}

window.wallpaperPropertyListener = {
  applyUserProperties: function (properties) {
    if (properties.shootingstarnumber) {
      shootingstarnumber = properties.shootingstarnumber.value;
      entities = [];
      entitiesUpdate();
    }
    if (properties.starsize) {
      starsize = properties.starsize.value;
      entities = [];
      entitiesUpdate();
    }
    if (properties.shootingstarsize) {
      shootingstarsize = properties.shootingstarsize.value;
      entities = [];
      entitiesUpdate();
    }
    if (properties.shootingstarlength) {
      shootingstarlength = properties.shootingstarlength.value;
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
        ? sachiElement.classList.add("visibility")
        : sachiElement.classList.remove("visibility");
    }
    if (properties.clockcolor) {
      clockElement.style.color = rgbToCSS(properties.clockcolor.value);
    }
    if (properties.textshadowcolor) {
      clockElement.style.textShadow =
        "0 0 35px " + rgbToCSS(properties.textshadowcolor.value);
    }
    if (properties.rgbmode) {
      properties.rgbmode.value
        ? sachiElement.classList.add("rgb_effect")
        : sachiElement.classList.remove("rgb_effect");
    }
  },
};
