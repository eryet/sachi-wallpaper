/* Stars use CSS viewport coordinates; backing pixels and density adapt to the screen. */
var background = document.getElementById('particleCanvas');
var bgCtx = background.getContext('2d');
var width = 1, height = 1, entities = [], particleMetrics;
var particleFrame = 0, particleLast = null, particleFPS = 60;
var particleReasons = new Set();
var particleReduced = matchMedia('(prefers-reduced-motion: reduce)');

function randomInRange(min, max) { return Math.random() * (max - min) + min; }
function Star(options) {
  this.size = randomInRange(1, starsize);
  this.speed = randomInRange(.05, .1);
  this.x = options.x;
  this.y = options.y;
}
Star.prototype.reset = function () {
  this.size = randomInRange(1, starsize);
  this.speed = randomInRange(.05, .1);
  this.x = width;
  this.y = randomInRange(0, height);
};
Star.prototype.update = function (step) {
  this.x -= this.speed * step;
  if (this.x < 0) this.reset();
  bgCtx.fillRect(this.x, this.y, this.size, this.size);
};
function ShootingStar() { this.reset(); }
ShootingStar.prototype.reset = function () {
  this.x = randomInRange(0, width * 1.5);
  this.y = 0;
  this.len = randomInRange(10, shootingstarlength);
  this.speed = randomInRange(6, 16);
  this.size = randomInRange(.5, shootingstarsize);
  this.waitTime = Date.now() + randomInRange(500, 3500);
  this.active = false;
};
ShootingStar.prototype.update = function (step) {
  if (this.active) {
    this.x -= this.speed * step;
    this.y += this.speed * step;
    if (this.x < 0 || this.y >= height) this.reset();
    else {
      bgCtx.lineWidth = this.size;
      bgCtx.beginPath();
      bgCtx.moveTo(this.x, this.y);
      bgCtx.lineTo(this.x + this.len, this.y - this.len);
      bgCtx.stroke();
    }
  } else if (step && this.waitTime < Date.now()) this.active = true;
};
function entitiesUpdate() {
  entities = [];
  particleMetrics = SachiLayout.particleMetrics(width, height, window.devicePixelRatio, starnumber, shootingstarnumber);
  for (var i = 0; i < particleMetrics.stars; i++) entities.push(new Star({x: Math.random() * width, y: Math.random() * height}));
  for (var i = 0; i < particleMetrics.shooting; i++) entities.push(new ShootingStar());
  paintParticles(0);
}
function paintParticles(step) {
  bgCtx.clearRect(0, 0, width, height);
  bgCtx.fillStyle = '#ffffff';
  bgCtx.strokeStyle = '#ffffff';
  for (var i = 0; i < entities.length; i++) entities[i].update(step);
}
function resizeParticles() {
  var root = document.getElementById('wallpaper');
  width = root.clientWidth;
  height = root.clientHeight;
  var metrics = SachiLayout.particleMetrics(width, height, window.devicePixelRatio, starnumber, shootingstarnumber);
  background.width = metrics.pixelWidth;
  background.height = metrics.pixelHeight;
  bgCtx.setTransform(metrics.pixelWidth / width, 0, 0, metrics.pixelHeight / height, 0, 0);
  entitiesUpdate();
  particleLast = null;
}
function animateParticles(now) {
  particleFrame = 0;
  if (particleReasons.size) return;
  if (particleLast === null || now - particleLast >= 1000 / particleFPS - .5) {
    var step = particleLast === null ? 0 : Math.min(3, (now - particleLast) / (1000 / 60));
    paintParticles(step);
    particleLast = now;
  }
  particleFrame = requestAnimationFrame(animateParticles);
}
window.suspendSachiParticles = function (reason, paused) {
  if (paused) particleReasons.add(reason); else particleReasons.delete(reason);
  cancelAnimationFrame(particleFrame);
  particleFrame = 0;
  particleLast = null;
  if (!particleReasons.size) particleFrame = requestAnimationFrame(animateParticles);
};
window.setSachiParticleFPS = function (fps) {
  if (Number.isFinite(fps)) particleFPS = Math.min(60, Math.max(1, fps));
};
window.sachiParticles = {
  get metrics() { return particleMetrics; },
  get paused() { return particleReasons.size > 0; },
  get fps() { return particleFPS; }
};
document.getElementById('wallpaper').addEventListener('wallpaperresize', resizeParticles);
document.addEventListener('visibilitychange', function () { suspendSachiParticles('document', document.hidden); });
particleReduced.addEventListener('change', function () { suspendSachiParticles('reduced-motion', particleReduced.matches); });
resizeParticles();
suspendSachiParticles('document', document.hidden);
suspendSachiParticles('reduced-motion', particleReduced.matches);
window.addEventListener('pagehide', function () { suspendSachiParticles('page', true); });
window.addEventListener('pageshow', function () { suspendSachiParticles('page', false); });
