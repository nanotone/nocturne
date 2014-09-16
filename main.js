// threejs machinery
var scene = new THREE.Scene();
var renderer = new THREE.WebGLRenderer();
var cam;
var sprite;

// view state
var catalog = [];
var lookAt = new THREE.Vector3(0, 0, -1);
var slerp = null;
var lastRender = 0;
var focalLen;

// pre-allocate some structs for calculations
var proj = new THREE.Projector();
var quat = new THREE.Quaternion();

init();

function init() {
    cam = new THREE.PerspectiveCamera(27, window.innerWidth / window.innerHeight, 0.1, 1000);
    setFocalLen(35);
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);

    var canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgb(255,255,255)';
    ctx.beginPath();
    ctx.arc(16, 16, 15, 0, Math.PI * 2);
    ctx.fill();

    //sprite = THREE.ImageUtils.loadTexture('disc.png');
    sprite = THREE.ImageUtils.loadTexture(canvas.toDataURL('image/png'));

    $('#clickTarget').on('click', handleClick);
    loadCatalog();
    stepFrame();
}

function clamp(val, min, max) {
    if (val <= min) { return min; }
    if (val >= max) { return max; }
    return val;
}

function setFocalLen(val) {
    focalLen = val;
    cam.setLens(val);
}

function loadCatalog() {
    $.getJSON('cat.json', function(data) {
        catalog = data.catalog;
        var geos = [];
        for (var i = 0; i < 6; i++) {
            geos.push(new THREE.Geometry());
        }
        for (var i = 0; i < catalog.length; i++) {
            var star = catalog[i];
            var rasc = star[2] /  12 * Math.PI;
            var decl = star[3] / 180 * Math.PI;
            var x = Math.cos(decl) * -Math.sin(rasc);
            var y = Math.sin(decl);
            var z = Math.cos(decl) * -Math.cos(rasc);
            star.push(x, y, z);
 
            var size = clamp(Math.round(star[1] * 2 - 2), 0, 5);
            geos[size].vertices.push(new THREE.Vector3(x, y, z));
        }
        for (var i = 0; i < 6; i++) {
            var mat = new THREE.PointCloudMaterial({size: 8 - i, sizeAttenuation: false, map: sprite, transparent: true});
            var cloud = new THREE.PointCloud(geos[i], mat);
            cloud.sortParticles = false;
            scene.add(cloud);
        }
    });
}

function stepFrame() {
    requestAnimationFrame(stepFrame);
    if (slerp) {
        var elapsed = ((new Date()).getTime() - slerp.startTime) / 2000.0;
        if (elapsed >= 1) {
            elapsed = 1;
        }
        var progress = (1 - Math.cos(elapsed * Math.PI)) * 0.5;
        setFocalLen(slerp.oldFocalLen * Math.exp(progress * slerp.logFocalLenRatio));
        quat.setFromAxisAngle(slerp.axis, progress * slerp.theta);
        cam.up = slerp.oldUp.clone().applyQuaternion(quat);
        lookAt = slerp.lookAt.clone().applyQuaternion(quat);
        cam.lookAt(lookAt);
        if (elapsed === 1) {
            slerp = null;
        }
        lastRender = 0;  // we are mid-animation; force a re-render
    }
    var now = (new Date()).getTime();
    if (now - lastRender > 1000) {
        renderer.render(scene, cam);
        lastRender = now;
    }
}

function handleClick(event) {
    var clickAt = new THREE.Vector3(event.clientX / window.innerWidth * 2 - 1,
                                    event.clientY / window.innerHeight * -2 + 1,
                                    0.5);
    proj.unprojectVector(clickAt, cam);
    clickAt.normalize();
    var target = {dist: 3, star: null}; 
    for (var i = 0; i < catalog.length; i++) {
        var star = catalog[i];
        var dist = Math.abs(star[5] - clickAt.x) + Math.abs(star[6] - clickAt.y) + Math.abs(star[7] - clickAt.z);
        if (dist < target.dist) {
            target = {dist: dist, star: star};
        }
    }
    if (!target.star || target.dist > 0.02) {
        return;
    }
    $('#announce').text(target.star[0]);

    var axis = (new THREE.Vector3()).crossVectors(lookAt, clickAt);
    var theta = Math.asin(axis.length() / clickAt.length());
    axis.normalize();
    var newFocalLen = clamp(35 * Math.pow(1.2, target.star[1] - 1), 35, 70);
    slerp = {
        axis: axis,
        startTime: (new Date()).getTime(),
        theta: theta,
        lookAt: lookAt,
        oldUp: cam.up.clone(),
        oldFocalLen: focalLen,
        logFocalLenRatio: Math.log(newFocalLen / focalLen) };
}
