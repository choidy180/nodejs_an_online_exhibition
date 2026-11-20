/* =========================================================
   IntroStage — 인트로 배경을 한 장의 WebGL 캔버스로 그린다
   (Shopify Editions Winter '26 의 움직이는 장면 연출을 참고)

   1) 가만히 있을 때: 이미지가 천천히 다가오고 흐르듯 움직이며(줌 · 드리프트),
      마우스를 따라 살짝 기울고, 아주 미세하게 일렁이며, 빛 입자가 떠오른다.
   2) 스크롤할 때: 스크롤 위치에 맞춰 다음 섹션 이미지로 반짝이는 원형 디졸브.
      떠나는 이미지는 앞으로 다가오고, 들어오는 이미지는 멀리서 자리를 잡는다.
   3) 떠날 때(전시회 관람하기): 같은 디졸브로 시작 페이지 배경까지 넘어가며
      움직임을 0으로 줄여, 마지막 프레임이 시작 페이지 배경(cover, 밝기)과 똑같아진다.

   섹션 배경: <div class="background" data-stage-image="..." data-stage-brightness="0.3">
   WebGL을 못 쓰거나 움직임 줄이기 설정이면 아무것도 하지 않고, CSS 배경이 그대로 보인다.

   사용:
     IntroStage.leave(url, brightness, duration) → 끝나면 resolve (못 쓰면 reject)
     IntroStage.scrollToSection(index)           → 다음 섹션으로 천천히 스크롤
     IntroStage.jumpToSection(index)             → 사이 섹션을 거치지 않고 한 번에 (TOP)
     IntroStage.preload([url])
   ========================================================= */
(function () {
  "use strict";

  var MAX_TEXTURE_SIDE = 2048;
  var SCROLL_MS = 1600;

  var VERTEX_SHADER = [
    "attribute vec2 aPos;",
    "varying vec2 vUv;",
    "void main() {",
    "  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);",
    "  gl_Position = vec4(aPos, 0.0, 1.0);",
    "}"
  ].join("\n");

  var FRAGMENT_SHADER = [
    "precision highp float;",
    "varying vec2 vUv;",
    "uniform sampler2D uA;",
    "uniform sampler2D uB;",
    "uniform vec2 uRes;",
    "uniform vec2 uSizeA;",
    "uniform vec2 uSizeB;",
    "uniform float uBrightA;",
    "uniform float uBrightB;",
    "uniform float uSeedA;",
    "uniform float uSeedB;",
    "uniform float uP;",      // 0 = A만, 1 = B만 (그 사이는 디졸브)
    "uniform float uIdle;",   // 살아 있는 움직임의 세기 (떠날 때 0까지 줄어든다)
    "uniform vec2 uMouse;",   // -1..1
    "uniform float uTime;",
    "uniform float uPx;",
    "",
    "vec2 coverScale(vec2 img) {",
    "  float s = max(uRes.x / img.x, uRes.y / img.y);",
    "  return img * s;",
    "}",
    "vec2 coverUv(vec2 uv, vec2 img) {",
    "  vec2 disp = coverScale(img);",
    "  return (uv * uRes - (uRes - disp) * 0.5) / disp;",
    "}",
    // 화면 기준으로 확대(zoom)하고 옮긴(pan) 뒤 cover 배치
    "vec2 motionUv(vec2 uv, float zoom, vec2 pan) {",
    "  return (uv - 0.5 - pan) / zoom + 0.5;",
    "}",
    "float hash(vec2 p) {",
    "  p = fract(p * vec2(123.34, 456.21));",
    "  p += dot(p, p + 45.32);",
    "  return fract(p.x * p.y);",
    "}",
    "float noise(vec2 p) {",
    "  vec2 i = floor(p);",
    "  vec2 f = fract(p);",
    "  f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);",
    "  float a = hash(i);",
    "  float b = hash(i + vec2(1.0, 0.0));",
    "  float c = hash(i + vec2(0.0, 1.0));",
    "  float d = hash(i + vec2(1.0, 1.0));",
    "  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);",
    "}",
    "float fbm(vec2 p) {",
    "  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);",
    "  float v = 0.0;",
    "  float a = 0.5;",
    "  for (int i = 0; i < 5; i++) {",
    "    v += a * noise(p);",
    "    p = rot * p * 2.03 + 17.1;",
    "    a *= 0.5;",
    "  }",
    "  return v;",
    "}",
    "float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }",
    "vec3 xray(sampler2D tex, vec2 uv, vec2 texel, vec3 base) {",
    "  float tl = lum(texture2D(tex, uv + texel * vec2(-1.0, -1.0)).rgb);",
    "  float t  = lum(texture2D(tex, uv + texel * vec2( 0.0, -1.0)).rgb);",
    "  float tr = lum(texture2D(tex, uv + texel * vec2( 1.0, -1.0)).rgb);",
    "  float l  = lum(texture2D(tex, uv + texel * vec2(-1.0,  0.0)).rgb);",
    "  float r  = lum(texture2D(tex, uv + texel * vec2( 1.0,  0.0)).rgb);",
    "  float bl = lum(texture2D(tex, uv + texel * vec2(-1.0,  1.0)).rgb);",
    "  float b  = lum(texture2D(tex, uv + texel * vec2( 0.0,  1.0)).rgb);",
    "  float br = lum(texture2D(tex, uv + texel * vec2( 1.0,  1.0)).rgb);",
    "  float gx = -tl - 2.0 * l - bl + tr + 2.0 * r + br;",
    "  float gy = -tl - 2.0 * t - tr + bl + 2.0 * b + br;",
    "  float e = sqrt(gx * gx + gy * gy);",
    "  float L = lum(base);",
    "  vec3 col = mix(vec3(L), base, 0.4) * 0.066;",
    "  col += vec3(0.92, 0.95, 1.0) * smoothstep(0.08, 0.5, e) * 0.27;",
    "  col += vec3(1.0) * pow(L, 4.0) * 0.054;",
    "  return col;",
    "}",
    // 십자 반짝임 (디졸브 경계)
    "float glints(vec2 frag) {",
    "  float G = 72.0 * uPx;",
    "  vec2 gid = floor(frag / G);",
    "  vec2 gf = frag - gid * G;",
    "  float acc = 0.0;",
    "  for (int y = -1; y <= 1; y++) {",
    "    for (int x = -1; x <= 1; x++) {",
    "      vec2 o = vec2(float(x), float(y));",
    "      vec2 id = gid + o;",
    "      float h = hash(id * 1.31 + 7.7);",
    "      if (h > 0.8) {",
    "        vec2 pos = (o + vec2(hash(id + 1.1), hash(id + 2.3))) * G;",
    "        vec2 q = gf - pos;",
    "        float size = mix(0.6, 1.5, hash(id + 3.7)) * uPx;",
    "        float twinkle = 0.55 + 0.45 * sin(uTime * 7.0 + h * 40.0);",
    "        float d = length(q);",
    "        float core = size * 2.2 / max(d, 0.75 * uPx);",
    "        float rays = max(0.0, 1.0 - abs(q.x * q.y) / (size * size * 18.0));",
    "        rays *= 1.0 - smoothstep(0.0, size * 26.0, d);",
    "        acc += (core * core * 0.5 + rays * 0.9) * twinkle;",
    "      }",
    "    }",
    "  }",
    "  return acc;",
    "}",
    // 천천히 떠오르는 빛 입자 (가만히 있을 때)
    "float motes(vec2 frag) {",
    "  float G = 120.0 * uPx;",
    "  vec2 p = frag - vec2(0.0, uTime * 16.0 * uPx);",
    "  vec2 gid = floor(p / G);",
    "  vec2 gf = p - gid * G;",
    "  float acc = 0.0;",
    "  for (int y = -1; y <= 1; y++) {",
    "    for (int x = -1; x <= 1; x++) {",
    "      vec2 o = vec2(float(x), float(y));",
    "      vec2 id = gid + o;",
    "      float h = hash(id * 1.7 + 3.1);",
    "      if (h > 0.7) {",
    "        vec2 pos = (o + vec2(hash(id + 0.7), hash(id + 5.3))) * G;",
    "        pos.x += sin(uTime * 0.6 + h * 30.0) * 8.0 * uPx;",
    "        float size = mix(0.7, 2.0, hash(id + 9.1)) * uPx;",
    "        float twinkle = 0.45 + 0.55 * sin(uTime * 1.6 + h * 50.0);",
    "        acc += smoothstep(size * 3.2, 0.0, length(gf - pos)) * twinkle * mix(0.35, 1.0, hash(id + 2.2));",
    "      }",
    "    }",
    "  }",
    "  return acc;",
    "}",
    "",
    "void main() {",
    "  vec2 uv = vUv;",
    "  float t = uTime;",
    "  float p = uP;",
    // 살아 있는 듯한 미세한 일렁임
    "  vec2 wob = vec2(noise(uv * 2.5 + vec2(t * 0.05, 0.0)), noise(uv * 2.5 + vec2(5.2, t * 0.04))) - 0.5;",
    "  vec2 uvw = uv + wob * 0.006 * uIdle;",
    // A: 천천히 다가오고 흐르며 마우스를 따라 살짝 움직인다. 떠날수록(p) 앞으로 다가온다
    "  float zA = 1.0 + uIdle * (0.075 + 0.015 * sin(t * 0.11 + uSeedA)) + 0.08 * p;",
    "  vec2 panA = uIdle * (vec2(0.012 * sin(t * 0.07 + uSeedA), 0.010 * cos(t * 0.09 + uSeedA)) + uMouse * 0.015);",
    // B: 멀리서(크게) 들어와 제자리(1.0)로
    "  float zB = 1.0 + uIdle * (0.075 + 0.015 * sin(t * 0.11 + uSeedB)) + 0.08 * (1.0 - p);",
    "  vec2 panB = uIdle * (vec2(0.012 * sin(t * 0.07 + uSeedB), 0.010 * cos(t * 0.09 + uSeedB)) + uMouse * 0.015);",
    "  vec2 auv = coverUv(motionUv(uvw, zA, panA), uSizeA);",
    "  vec3 aRaw = texture2D(uA, auv).rgb;",
    "  vec3 col = aRaw * uBrightA;",
    "",
    "  if (p > 0.0005) {",
    "    vec2 buv = coverUv(motionUv(uvw, zB, panB), uSizeB);",
    "    vec3 bRaw = texture2D(uB, buv).rgb;",
    "    vec3 bCol = bRaw * uBrightB;",
    "    vec2 texA = vec2(1.1 * uPx) / (coverScale(uSizeA) * zA);",
    "    vec2 texB = vec2(1.1 * uPx) / (coverScale(uSizeB) * zB);",
    "    vec2 aspect = vec2(uRes.x / uRes.y, 1.0);",
    "    vec2 c = (uv - 0.5) * aspect;",
    "    float d = length(c) / length(aspect * 0.5);",
    "    float n = fbm(c * 2.6 + vec2(0.0, t * 0.15));",
    "    float n2 = noise(c * 26.0 + t * 0.6);",
    "    float dd = d + (n - 0.5) * 0.32 + (n2 - 0.5) * 0.05;",
    "    float grow = clamp((p - 0.15) / 0.75, 0.0, 1.0);",
    "    float r = mix(-0.32, 1.35, grow);",
    "    float ahead = dd - r;",
    "    float behind = r - dd;",
    "    float inside = 1.0 - smoothstep(-0.012, 0.012, ahead);",
    "    float ax = smoothstep(0.08, 0.4, p) * (0.4 + 0.6 * (1.0 - smoothstep(0.0, 0.6, ahead)));",
    "    vec3 fromStyled = mix(col, xray(uA, auv, texA, aRaw), ax);",
    "    float settle = max(smoothstep(0.04, 0.6, behind), smoothstep(0.86, 1.0, p));",
    "    vec3 toStyled = mix(xray(uB, buv, texB, bRaw), bCol, settle);",
    "    col = mix(fromStyled, toStyled, inside);",
    "    float live = smoothstep(0.12, 0.22, p) * (1.0 - smoothstep(0.84, 0.98, p));",
    "    col += vec3(1.0, 0.97, 0.92) * exp(-abs(ahead) * 30.0) * 0.18 * live;",
    "    float band = exp(-abs(ahead) * 7.0) + exp(-max(behind, 0.0) * 3.0) * 0.35 * inside;",
    "    vec2 cell = floor(gl_FragCoord.xy / (1.5 * uPx));",
    "    float speck = step(0.982, hash(cell + floor(t * 24.0) * 0.137));",
    "    col += vec3(1.0) * speck * band * live * 0.31;",
    "    col += vec3(1.0, 0.98, 0.95) * glints(gl_FragCoord.xy) * band * live * 0.25;",
    "    float orbOn = smoothstep(0.0, 0.14, p) * (1.0 - smoothstep(0.26, 0.45, p));",
    "    float orbR = mix(0.012, 0.075, smoothstep(0.0, 0.3, p));",
    "    col += vec3(1.0, 0.98, 0.94) * (exp(-d / orbR) * 0.47 + exp(-d / (orbR * 3.5)) * 0.1) * orbOn;",
    "  }",
    "",
    // 떠오르는 빛 입자 + 왼쪽(글이 놓이는 쪽)을 살짝 어둡게 — 모두 uIdle 에 비례
    "  col += vec3(1.0, 0.96, 0.88) * motes(gl_FragCoord.xy) * 0.22 * uIdle;",
    "  col *= mix(1.0, 0.82 + 0.18 * smoothstep(0.0, 0.55, uv.x), uIdle);",
    "  gl_FragColor = vec4(min(col, vec3(1.0)), 1.0);",
    "}"
  ].join("\n");

  // ---------------------------------------------------------
  var root = document.documentElement;
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var sections = Array.prototype.slice.call(document.querySelectorAll(".background[data-stage-image]"));

  var canvas = null;
  var gl = null;
  var uni = {};
  var textures = {}; // url → Promise<{ tex, width, height }>
  var loaded = {};   // url → { tex, width, height } (받은 것만)
  var leaving = null;
  var jumping = null; // TOP: 중간 섹션을 거치지 않고 한 번의 디졸브로 넘어가는 중
  var mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  var startTime = performance.now();
  var dpr = 1;

  function compile(type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error("shader compile failed: " + gl.getShaderInfoLog(shader));
    }
    return shader;
  }

  function loadImage(url) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        // decode()는 탭이 그려지지 않는 동안 끝나지 않을 수 있으므로 최대 300ms만 기다린다
        // (다 받은 이미지는 decode 없이도 텍스처로 쓸 수 있다 — page-transition.js 와 같은 처리)
        var decoded = img.decode ? img.decode().catch(function () {}) : Promise.resolve();
        var capped = new Promise(function (done) {
          setTimeout(done, 300);
        });
        Promise.race([decoded, capped]).then(function () {
          resolve(img);
        });
      };
      img.onerror = function () {
        reject(new Error("image load failed: " + url));
      };
      img.src = url;
    });
  }

  // 너무 큰 이미지는 줄여서 올린다
  function textureSource(img) {
    var max = Math.min(MAX_TEXTURE_SIDE, gl.getParameter(gl.MAX_TEXTURE_SIZE));
    var w = img.naturalWidth;
    var h = img.naturalHeight;
    var scale = Math.min(1, max / Math.max(w, h));
    if (scale === 1) return { source: img, width: w, height: h };
    var c = document.createElement("canvas");
    c.width = Math.round(w * scale);
    c.height = Math.round(h * scale);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return { source: c, width: c.width, height: c.height };
  }

  function texture(url) {
    if (!textures[url]) {
      textures[url] = loadImage(url).then(function (img) {
        var src = textureSource(img);
        var tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src.source);
        loaded[url] = { tex: tex, width: src.width, height: src.height };
        return loaded[url];
      });
      textures[url].catch(function () {
        delete textures[url];
      });
    }
    return textures[url];
  }

  function sectionInfo(i) {
    var el = sections[i];
    return {
      url: el.getAttribute("data-stage-image"),
      brightness: parseFloat(el.getAttribute("data-stage-brightness")) || 0.3,
      seed: i * 1.7 + 0.4
    };
  }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 1.25);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
  }

  function easeInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  // 처음엔 움직임 0 → 2.5초에 걸쳐 서서히 살아난다 (CSS 배경과 바꿔 끼울 때 튀지 않게)
  var IDLE_RAMP_MS = 2500;
  function idleNow(now) {
    return easeInOut(Math.min(1, Math.max(0, now - startTime) / IDLE_RAMP_MS));
  }

  // 지금 그릴 장면: { a, b, p, idle }
  function scene(now) {
    if (leaving) {
      var lp = Math.min(1, (now - leaving.start) / leaving.duration);
      if (lp >= 1 && !leaving.done) {
        leaving.done = true;
        setTimeout(leaving.resolve, 0);
      }
      return {
        a: leaving.from,
        b: { info: leaving.to, img: leaving.toImg },
        p: lp,
        idle: leaving.idle0 * (1 - easeInOut(lp)) // 끝에서 0 → 시작 페이지 배경과 똑같은 프레임
      };
    }
    if (jumping) {
      var jp = Math.min(1, (now - jumping.start) / jumping.duration);
      if (jp < 1) {
        return { a: jumping.from, b: jumping.to, p: jp, idle: idleNow(now) };
      }
      // 끝나면 스크롤 위치(이미 목표 섹션)로 그리는 평소 장면과 같은 그림이 이어진다
      jumping = null;
    }
    var s = Math.max(0, window.scrollY / window.innerHeight);
    var i = Math.min(sections.length - 1, Math.floor(s));
    var f = i === sections.length - 1 ? 0 : s - i;
    var a = sectionInfo(i);
    var b = sectionInfo(Math.min(sections.length - 1, i + 1));
    var aImg = loaded[a.url];
    var bImg = loaded[b.url];
    if (!bImg) f = 0; // 다음 이미지를 아직 못 받았으면 전환을 미룬다
    return { a: { info: a, img: aImg }, b: { info: b, img: bImg || aImg }, p: f, idle: idleNow(now) };
  }

  function draw(now) {
    var sc = scene(now);
    if (!sc.a.img) return false;
    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, sc.a.img.tex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, sc.b.img.tex);
    gl.uniform2f(uni.uRes, canvas.width, canvas.height);
    gl.uniform2f(uni.uSizeA, sc.a.img.width, sc.a.img.height);
    gl.uniform2f(uni.uSizeB, sc.b.img.width, sc.b.img.height);
    gl.uniform1f(uni.uBrightA, sc.a.info.brightness);
    gl.uniform1f(uni.uBrightB, sc.b.info.brightness);
    gl.uniform1f(uni.uSeedA, sc.a.info.seed);
    gl.uniform1f(uni.uSeedB, sc.b.info.seed);
    gl.uniform1f(uni.uP, sc.p);
    gl.uniform1f(uni.uIdle, sc.idle);
    gl.uniform2f(uni.uMouse, mouse.x, mouse.y);
    gl.uniform1f(uni.uTime, (now - startTime) / 1000);
    gl.uniform1f(uni.uPx, dpr);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    return true;
  }

  function loop(now) {
    draw(now);
    requestAnimationFrame(loop);
  }

  function init() {
    if (reduceMotion || !sections.length) return Promise.reject(new Error("disabled"));
    canvas = document.createElement("canvas");
    canvas.className = "intro_stage_canvas";
    canvas.setAttribute("aria-hidden", "true");
    var attrs = { alpha: false, antialias: false, depth: false, stencil: false };
    gl = canvas.getContext("webgl2", attrs) || canvas.getContext("webgl", attrs);
    if (!gl) return Promise.reject(new Error("WebGL unavailable"));

    var program = gl.createProgram();
    gl.attachShader(program, compile(gl.VERTEX_SHADER, VERTEX_SHADER));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      return Promise.reject(new Error("program link failed: " + gl.getProgramInfoLog(program)));
    }
    gl.useProgram(program);
    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    ["uA", "uB", "uRes", "uSizeA", "uSizeB", "uBrightA", "uBrightB", "uSeedA", "uSeedB",
      "uP", "uIdle", "uMouse", "uTime", "uPx"].forEach(function (name) {
      uni[name] = gl.getUniformLocation(program, name);
    });
    gl.uniform1i(uni.uA, 0);
    gl.uniform1i(uni.uB, 1);
    resize();

    // 지금 보이는 섹션 이미지부터 받고, 첫 프레임을 그린 뒤에 CSS 배경과 바꿔 끼운다
    var first = Math.min(sections.length - 1, Math.floor(window.scrollY / window.innerHeight));
    return texture(sectionInfo(first).url).then(function () {
      draw(performance.now());
      document.body.appendChild(canvas);
      root.classList.add("has-stage");
      requestAnimationFrame(loop);
      sections.forEach(function (_, i) {
        texture(sectionInfo(i).url).catch(function () {});
      });
    });
  }

  var ready = init();
  ready.catch(function () {}); // 실패하면 CSS 배경이 그대로 쓰인다

  window.addEventListener("resize", function () {
    if (gl) resize();
  });
  window.addEventListener("mousemove", function (e) {
    mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.ty = (e.clientY / window.innerHeight) * 2 - 1;
  });

  function scrollToSection(index) {
    var target = sections[index] ? sections[index].offsetTop : 0;
    if (!gl) {
      window.scrollTo({ top: target, behavior: reduceMotion ? "auto" : "smooth" });
      return;
    }
    var from = window.scrollY;
    var start = performance.now();
    function step(now) {
      var t = Math.min(1, (now - start) / SCROLL_MS);
      window.scrollTo({ top: from + (target - from) * easeInOut(t), behavior: "instant" });
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // 멀리 떨어진 섹션(예: 마지막 → 맨 위)으로 갈 때: 사이 섹션을 스크롤로 거치지 않고
  // 글을 잠깐 흐리게 한 뒤 스크롤을 바로 옮기고, 배경은 지금 이미지 → 목표 이미지로 한 번만 디졸브한다
  var JUMP_MS = 1400;
  var JUMP_FADE_MS = 260;
  function jumpToSection(index) {
    var target = sections[index];
    if (!target) return;
    if (!gl || jumping || leaving) {
      if (!gl) window.scrollTo({ top: target.offsetTop, behavior: reduceMotion ? "auto" : "smooth" });
      return;
    }
    var i = Math.min(sections.length - 1, Math.round(window.scrollY / window.innerHeight));
    var from = sectionInfo(i);
    var to = sectionInfo(index);
    Promise.all([texture(from.url), texture(to.url)]).then(function (imgs) {
      jumping = {
        from: { info: from, img: imgs[0] },
        to: { info: to, img: imgs[1] },
        start: performance.now(),
        duration: JUMP_MS
      };
      document.body.classList.add("is-jumping");
      setTimeout(function () {
        window.scrollTo({ top: target.offsetTop, behavior: "instant" });
        requestAnimationFrame(function () {
          document.body.classList.remove("is-jumping");
        });
      }, JUMP_FADE_MS);
    });
  }

  function leave(url, brightness, duration) {
    return ready.then(function () {
      var i = Math.min(sections.length - 1, Math.round(window.scrollY / window.innerHeight));
      var a = sectionInfo(i);
      return Promise.all([texture(a.url), texture(url)]).then(function (imgs) {
        return new Promise(function (resolve) {
          var now = performance.now();
          jumping = null;
          leaving = {
            idle0: idleNow(now),
            from: { info: a, img: imgs[0] },
            to: { url: url, brightness: brightness, seed: 0 },
            toImg: imgs[1],
            start: now,
            duration: duration || 1700,
            resolve: resolve,
            done: false
          };
        });
      });
    });
  }

  // 뒤로가기로 bfcache에서 돌아오면 다시 인트로 장면으로
  window.addEventListener("pageshow", function (event) {
    if (event.persisted) leaving = null;
  });

  window.IntroStage = {
    ready: ready,
    leave: leave,
    scrollToSection: scrollToSection,
    jumpToSection: jumpToSection,
    preload: function (urls) {
      ready.then(function () {
        urls.forEach(function (url) {
          texture(url).catch(function () {});
        });
      }).catch(function () {});
    }
  };
})();
