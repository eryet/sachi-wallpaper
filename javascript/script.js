// shooting start code
(function () {
  var requestAnimationFrame =
    window.requestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.msRequestAnimationFrame ||
    function (callback) {
      window.setTimeout(callback, 1000 / 60);
    };
  window.requestAnimationFrame = requestAnimationFrame;
})();

var background = document.getElementById("particleCanvas"),
  bgCtx = background.getContext("2d"),
  width = window.screen.width,
  height = window.screen.height;

background.width = width;
background.height = height;

bgCtx.fillStyle = "#05004c";
bgCtx.fillRect(0, 0, width, height);

// stars
function Star(options) {
  this.size = Math.random() * 2;
  this.speed = Math.random() * 0.1;
  this.x = options.x;
  this.y = options.y;
}

Star.prototype.reset = function () {
  this.size = Math.random() * 2;
  this.speed = Math.random() * 0.1;
  this.x = width;
  this.y = Math.random() * height;
};

Star.prototype.update = function () {
  this.x -= this.speed;
  if (this.x < 0) {
    this.reset();
  } else {
    bgCtx.fillRect(this.x, this.y, this.size, this.size);
  }
};

function ShootingStar() {
  this.reset();
}

// shooting star properties
ShootingStar.prototype.reset = function () {
  this.x = Math.random() * width;
  this.y = 0;
  this.len = Math.random() * 80 + 10;
  this.speed = Math.random() * 10 + 6;
  this.size = Math.random() * 1 + 0.1;
  // this is used so the shooting stars arent constant
  this.waitTime = new Date().getTime() + Math.random() * 3000 + 500;
  this.active = false;
};

// shooting star update animation
ShootingStar.prototype.update = function () {
  if (this.active) {
    this.x -= this.speed;
    this.y += this.speed;
    if (this.x < 0 || this.y >= height) {
      this.reset();
    } else {
      bgCtx.lineWidth = this.size;
      bgCtx.beginPath();
      bgCtx.moveTo(this.x, this.y);
      bgCtx.lineTo(this.x + this.len, this.y - this.len);
      bgCtx.stroke();
    }
  } else {
    if (this.waitTime < new Date().getTime()) {
      this.active = true;
    }
  }
};

var entities = [];

function entitiesUpdate() {
  for (let i = 0; i < starnumber; i++) {
    entities.push(
      new Star({ x: Math.random() * width, y: Math.random() * height })
    );
  }

  // Add 5 shooting stars that just cycle.
  for (let i = 0; i < shootingstarnumber; i++) {
    entities.push(new ShootingStar());
  }
}

entitiesUpdate();

// animate background
// loop white dot and white line
function animate() {
  //   var img = new Image();
  //   img.src = "../images/background.jpg";
  //   bgCtx.createPattern(img, "no-repeat");
  // init the stars
  bgCtx.fillStyle = "#ffffff";
  bgCtx.strokeStyle = "#ffffff";
  bgCtx.clearRect(0, 0, width, height);

  var entLen = entities.length;

  while (entLen--) {
    entities[entLen].update();
  }

  requestAnimationFrame(animate);
}
animate();
