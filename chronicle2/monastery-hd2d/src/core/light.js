// Lighting rig shared by the game and every test page: dusk, backlit by the setting white moon (warm, low, from the
// north-north-west), with a weak rose-violet fill from the black moon in the south-east so faces turned to the camera
// still read. Call HD.Light.setup(scene, renderer) once; call rig.follow(x, z) every frame with the hero position.
(function () {
  const HD = (window.HD = window.HD || {});
  const L = (HD.Light = {});
  L.KEY_DIR = [-0.40, 0.66, -0.64];      // direction TOWARDS the key light (white moon), before normalising
  L.FILL_DIR = [0.55, 0.50, 0.67];       // direction TOWARDS the fill light (black moon)
  L.KEY_COLOR = '#ffd6a8';
  L.FILL_COLOR = '#b08cc8';
  L.SKY_COLOR = '#6a5c96';
  L.GROUND_COLOR = '#4a3440';
  L.FOG_COLOR = '#3a2f4e';
  L.setup = function (scene, renderer, opt) {
    opt = opt || {};
    const T = THREE;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    const hemi = new T.HemisphereLight(L.SKY_COLOR, L.GROUND_COLOR, 0.62);
    const key = new T.DirectionalLight(L.KEY_COLOR, 1.3);
    const kd = new T.Vector3().fromArray(L.KEY_DIR).normalize();
    key.castShadow = true;
    const S = opt.shadowSize || 2048, R = opt.shadowRange || 46;
    key.shadow.mapSize.set(S, S);
    const c = key.shadow.camera; c.left = -R; c.right = R; c.top = R; c.bottom = -R; c.near = 1; c.far = 260;
    key.shadow.bias = -0.0006; key.shadow.normalBias = 0.05; key.shadow.radius = 2.2;
    const fill = new T.DirectionalLight(L.FILL_COLOR, 0.42);
    fill.position.fromArray(L.FILL_DIR).normalize().multiplyScalar(100);
    scene.add(hemi, key, key.target, fill);
    scene.fog = new T.FogExp2(L.FOG_COLOR, 0.0052);
    const rig = { hemi, key, fill,
      follow(x, z) {            // keep the shadow box centred near the hero, snapped to shadow texels so edges do not swim
        const step = (2 * R) / S * 4; const sx = Math.round(x / step) * step, sz = Math.round((z - 6) / step) * step;
        key.target.position.set(sx, 0, sz); key.position.set(sx + kd.x * 120, kd.y * 120, sz + kd.z * 120); key.target.updateMatrixWorld();
      } };
    rig.follow(0, 0);
    return rig;
  };
})();
