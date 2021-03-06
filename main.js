// threejs machinery
var renderer = new THREE.WebGLRenderer();
var scene = new THREE.Scene();
var cam;
var sprite;

// view state
var catalog = {};
var lookAt;
var slerp = null;
var lastRender = 0;
var focalLen;
var paths = [];

// pre-allocate some structs for calculations
var proj = new THREE.Projector();
var quat = new THREE.Quaternion();

init();

function init() {
    renderer.setSize(window.innerWidth, window.innerHeight);

    cam = new THREE.PerspectiveCamera(27, window.innerWidth / window.innerHeight, 0.1, 1000);
    setFocalLen(35);
    document.body.appendChild(renderer.domElement);

    var randQuat = randQuaternion();
    cam.up.applyQuaternion(randQuat);
    lookAt = (new THREE.Vector3(0, 0, -1)).applyQuaternion(randQuat);
    cam.lookAt(lookAt);

    // draw the star disk
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
    for (var planeKey in planes) {
        var plane = planes[planeKey];
        plane.cloud.material.size = sizeFromMag(plane.mag);
    }
}
function sizeAttenuation() {
    //return 110 / (focalLen + 35);
    return 4.1 - Math.log(focalLen) / 1.5;
}
function sizeFromMag(mag) {
    return 10 - sizeAttenuation() * mag;
}
function magFromSize(size) {
    return (10 - size) / sizeAttenuation();
}


// star colors are palettized by an array created by interpolating representative stars
function idxFromBv(bv) {
    return clamp(Math.round(bv * 10 + 3), 0, 18);
}
var colors = [];
function interpColors(bv1, c1, bv2, c2) {
    var idx1 = idxFromBv(bv1), idx2 = idxFromBv(bv2);
    var range = idx2 - idx1;
    for (var i = 0; i <= range; i++) {
        colors[idx1 + i] = new THREE.Color(c1.r + i/range * (c2.r - c1.r),
                                           c1.g + i/range * (c2.g - c1.g),
                                           c1.b + i/range * (c2.b - c1.b) );
    }
}
interpColors(-0.3, new THREE.Color(0.6, 0.8, 1.0), // Spica-ish
             -0.1, new THREE.Color(0.8, 1.0, 1.0)); // Achernar-ish
interpColors(-0.1, new THREE.Color(0.8, 1.0, 1.0),
             +0.2, new THREE.Color(1.0, 1.0, 1.0)); // Canopus-ish
interpColors(+0.2, new THREE.Color(1.0, 1.0, 1.0),
             +0.5, new THREE.Color(1.0, 1.0, 0.8));
interpColors(+0.5, new THREE.Color(1.0, 1.0, 0.8),
             +1.5, new THREE.Color(1.0, 0.8, 0.6)); // Betelgeuse-ish


var planes = {};
function loadCatalog() {
    $.getJSON('cat5.json', function(data) {
        catalog = data;
        for (var planeKey in catalog) {
            if (!catalog.hasOwnProperty(planeKey)) { continue; }
            var cat = catalog[planeKey];
            var geo = new THREE.Geometry();
            for (var j = 0; j < cat.length; j++) {
                var star = cat[j];
                var bv = star[6];
                var color = star.pop();
                geo.vertices.push(new THREE.Vector3(star[2], star[3], star[4]));
                geo.colors.push(colors[idxFromBv(bv)]);
            }
            var mag = Number(planeKey.substr(3));
            var mat = new THREE.PointCloudMaterial({size: 10 - 2*mag, sizeAttenuation: false, map: sprite, transparent: true, vertexColors: THREE.VertexColors});
            var cloud = new THREE.PointCloud(geo, mat);
            cloud.matrixAutoUpdate = false;
            cloud.sortParticles = false;
            scene.add(cloud);
            planes[planeKey] = {cloud: cloud, mag: mag, visible: true};
        }
    });
}

function randQuaternion() {
    // see http://planning.cs.uiuc.edu/node198.html
    var u1 = Math.random(), u2 = Math.random(), u3 = Math.random();
    var a = Math.sqrt(1 - u1), b = Math.sqrt(u1);
    var c = 2 * Math.PI * u2,  d = 2 * Math.PI * u3;
    return new THREE.Quaternion(a * Math.cos(c), b * Math.sin(d), b * Math.cos(d), a * Math.sin(c));
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

        var magThresh = magFromSize(1);
        for (var planeKey in planes) {
            var plane = planes[planeKey];
            if (plane.mag < magThresh && !plane.visible) {
                plane.visible = true;
                scene.add(plane.cloud);
            }
            else if (plane.mag > magThresh && plane.visible) {
                plane.visible = false;
                scene.remove(plane.cloud);
            }
        }

        slerp.path.geometry.vertices[1] = lookAt;
        slerp.path.geometry.verticesNeedUpdate = true;
        if (elapsed === 1) {
            paths.push(slerp.path);
            slerp = null;
            if (paths.length > 60) {
                scene.remove(paths.shift());
            }
            for (var i = paths.length - 1; i > 0; i--) {
                paths[i].material.color = paths[i - 1].material.color;
            }
            paths[0].material.color = new THREE.Color((0x41 - paths.length) * 0x010101);
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

    for (var planeKey in catalog) {
        var cat = catalog[planeKey];
        for (var j = 0; j < cat.length; j++) {
            var star = cat[j];
            var dist = Math.abs(star[2] - clickAt.x) + Math.abs(star[3] - clickAt.y) + Math.abs(star[4] - clickAt.z);
            if (dist < target.dist) {
                target = {dist: dist, star: star};
            }
        }
    }
    if (!target.star || target.dist > 0.02) {
        return;
    }
    clickAt = new THREE.Vector3(target.star[2], target.star[3], target.star[4]);
    $('#announce').text(target.star[0]);

    var axis = (new THREE.Vector3()).crossVectors(lookAt, clickAt);
    var theta = Math.asin(axis.length() / clickAt.length());
    axis.normalize();

    var newFocalLen = clamp(24 * Math.pow(1.3, target.star[1] - 1), 24, 105);

    var lineGeo = new THREE.Geometry();
    lineGeo.vertices.push(lookAt.clone(), lookAt.clone());
    var path = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({color: 0x404040}));
    path.frustumCulled = false;
    path.matrixAutoUpdate = false;
    scene.add(path);
    slerp = {
        axis: axis,
        startTime: (new Date()).getTime(),
        theta: theta,
        lookAt: lookAt,
        oldUp: cam.up.clone(),
        oldFocalLen: focalLen,
        logFocalLenRatio: Math.log(newFocalLen / focalLen),
        path: path };
}
