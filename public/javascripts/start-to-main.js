/* =========================================================
   StartToMain — 시작 화면 → 메인 화면 전환 (WebGL)

   인트로 → 시작 화면과 같은 반짝이는 원형 디졸브로, 시작 화면 배경에서
   메인 화면의 첫 장면까지 넘어간 뒤 이동한다.
   마지막 프레임은 메인 화면 첫 화면과 똑같이 그린다:
     - 위 70px 내비게이션 띠 (검정 80%)
     - 최상단 이미지(wall2.png): 화면 폭(스크롤바 제외) × max(70vh, 600px), 위로 70px,
       cover 배치 + 검정 50% + 왼쪽 막 + 아래로 #141414 까지 짙어지는 그라데이션 (style.css 와 같은 값)
     - 그 아래는 #141414
   그래서 이동하는 순간 끊기지 않고, 메인 화면은 배경 위로 글과 카드만 차례로 드러낸다.

   사용:
     StartToMain.play({ from, fromBrightness, to, duration }) → 끝나면 resolve (못 쓰면 reject)
     StartToMain.preload([url]) / StartToMain.reset()
   ========================================================= */
(function () {
  "use strict";

  var MAX_TEXTURE_SIDE = 2048;
  var LOAD_TIMEOUT_MS = 2500;
  // style.css 의 메인 최상단 값과 같아야 한다
  var NAV_H = 70;
  var HERO_TOP = -70;
  var HERO_VH = 0.7;
  var HERO_MIN_H = 600;

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
    "uniform sampler2D uFrom;",
    "uniform sampler2D uTo;",
    "uniform vec2 uRes;",
    "uniform vec2 uFromSize;",
    "uniform vec2 uToSize;",
    "uniform float uFromBright;",
    "uniform float uP;",
    "uniform float uTime;",
    "uniform float uPx;",
    "uniform float uContentW;", // 메인 화면 내용 폭 (스크롤바 제외, px)
    "uniform float uHeroH;",
    "uniform float uHeroTop;",
    "uniform float uNavH;",
    "",
    "const vec3 BG = vec3(20.0 / 255.0);", // #141414
    "",
    "vec2 coverUv(vec2 uv, vec2 img) {",
    "  float s = max(uRes.x / img.x, uRes.y / img.y);",
    "  vec2 disp = img * s;",
    "  return (uv * uRes - (uRes - disp) * 0.5) / disp;",
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
    // style.css .top_main_area::after 의 그라데이션 스톱과 같은 값
    "float fadeAt(float t) {",
    "  if (t <= 0.25) return 0.0;",
    "  if (t <= 0.35) return mix(0.0, 0.08, (t - 0.25) / 0.10);",
    "  if (t <= 0.45) return mix(0.08, 0.22, (t - 0.35) / 0.10);",
    "  if (t <= 0.55) return mix(0.22, 0.42, (t - 0.45) / 0.10);",
    "  if (t <= 0.65) return mix(0.42, 0.65, (t - 0.55) / 0.10);",
    "  if (t <= 0.74) return mix(0.65, 0.85, (t - 0.65) / 0.09);",
    "  if (t <= 0.81) return mix(0.85, 0.96, (t - 0.74) / 0.07);",
    "  if (t <= 0.86) return mix(0.96, 1.0, (t - 0.81) / 0.05);",
    "  return 1.0;",
    "}",
    "float veilAt(float x) {",
    "  if (x <= 0.35) return mix(0.55, 0.25, x / 0.35);",
    "  if (x <= 0.60) return mix(0.25, 0.0, (x - 0.35) / 0.25);",
    "  return 0.0;",
    "}",
    // 메인 화면 첫 장면 (ft: 왼쪽 위 기준 픽셀 좌표)
    "vec3 mainFrame(vec2 ft, out vec2 tuv, out vec2 texel, out float inHero) {",
    "  tuv = vec2(0.0);",
    "  texel = vec2(0.0);",
    "  inHero = 0.0;",
    "  vec3 col = BG;",
    "  if (ft.x > uContentW) return col;", // 오른쪽 스크롤바 자리
    "  float yIn = ft.y - uHeroTop;",
    "  if (yIn >= 0.0 && yIn < uHeroH) {",
    "    vec2 box = vec2(uContentW, uHeroH);",
    "    vec2 local = vec2(ft.x, yIn);",
    "    float s = max(box.x / uToSize.x, box.y / uToSize.y);",
    "    vec2 disp = uToSize * s;",
    "    tuv = (local - (box - disp) * 0.5) / disp;",
    "    texel = vec2(1.1 * uPx) / disp;",
    "    vec3 img = texture2D(uTo, tuv).rgb * 0.5;",
    "    img *= 1.0 - veilAt(local.x / box.x);",
    "    col = mix(img, BG, fadeAt(local.y / box.y));",
    "    inHero = 1.0;",
    "  }",
    "  if (ft.y < uNavH) col *= 0.2;", // 내비게이션 띠 (검정 80%)
    "  return col;",
    "}",
    "",
    "void main() {",
    "  vec2 uv = vUv;",
    "  vec2 ft = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);",
    "  vec2 fuv = coverUv(uv, uFromSize);",
    "  vec3 fromRaw = texture2D(uFrom, fuv).rgb;",
    "  vec3 fromCol = fromRaw * uFromBright;",
    "  float p = uP;",
    "  if (p <= 0.0005) {",
    "    gl_FragColor = vec4(fromCol, 1.0);",
    "    return;",
    "  }",
    "  vec2 tuv;",
    "  vec2 texT;",
    "  float inHero;",
    "  vec3 toCol = mainFrame(ft, tuv, texT, inHero);",
    "  vec3 toRaw = texture2D(uTo, tuv).rgb;",
    "  vec3 toXray = inHero > 0.5 ? xray(uTo, tuv, texT, toRaw) : toCol * 0.6;",
    "  vec2 texF = vec2(1.1 * uPx) / (uFromSize * max(uRes.x / uFromSize.x, uRes.y / uFromSize.y));",
    "",
    "  vec2 aspect = vec2(uRes.x / uRes.y, 1.0);",
    "  vec2 c = (uv - 0.5) * aspect;",
    "  float d = length(c) / length(aspect * 0.5);",
    "  float n = fbm(c * 2.6 + vec2(0.0, uTime * 0.15));",
    "  float n2 = noise(c * 26.0 + uTime * 0.6);",
    "  float dd = d + (n - 0.5) * 0.32 + (n2 - 0.5) * 0.05;",
    "  float grow = clamp((p - 0.15) / 0.75, 0.0, 1.0);",
    "  float r = mix(-0.32, 1.35, grow);",
    "  float ahead = dd - r;",
    "  float behind = r - dd;",
    "  float inside = 1.0 - smoothstep(-0.012, 0.012, ahead);",
    "  float ax = smoothstep(0.08, 0.4, p) * (0.4 + 0.6 * (1.0 - smoothstep(0.0, 0.6, ahead)));",
    "  vec3 fromStyled = mix(fromCol, xray(uFrom, fuv, texF, fromRaw), ax);",
    "  float settle = max(smoothstep(0.04, 0.6, behind), smoothstep(0.86, 1.0, p));",
    "  vec3 toStyled = mix(toXray, toCol, settle);",
    "  vec3 col = mix(fromStyled, toStyled, inside);",
    "  float live = smoothstep(0.12, 0.22, p) * (1.0 - smoothstep(0.84, 0.98, p));",
    "  col += vec3(1.0, 0.97, 0.92) * exp(-abs(ahead) * 30.0) * 0.18 * live;",
    "  float band = exp(-abs(ahead) * 7.0) + exp(-max(behind, 0.0) * 3.0) * 0.35 * inside;",
    "  vec2 cell = floor(gl_FragCoord.xy / (1.5 * uPx));",
    "  float speck = step(0.982, hash(cell + floor(uTime * 24.0) * 0.137));",
    "  col += vec3(1.0) * speck * band * live * 0.31;",
    "  col += vec3(1.0, 0.98, 0.95) * glints(gl_FragCoord.xy) * band * live * 0.25;",
    "  float orbOn = smoothstep(0.0, 0.14, p) * (1.0 - smoothstep(0.26, 0.45, p));",
    "  float orbR = mix(0.012, 0.075, smoothstep(0.0, 0.3, p));",
    "  col += vec3(1.0, 0.98, 0.94) * (exp(-d / orbR) * 0.47 + exp(-d / (orbR * 3.5)) * 0.1) * orbOn;",
    "  gl_FragColor = vec4(min(col, vec3(1.0)), 1.0);",
    "}"
  ].join("\n");

  var imageCache = {};
  var activeCanvas = null;
  var activeFrame = 0;

  function loadImage(url) {
    if (!imageCache[url]) {
      imageCache[url] = new Promise(function (resolve, reject) {
        var img = new Image();
        img.onload = function () {
          (img.decode ? img.decode().catch(function () {}) : Promise.resolve()).then(function () {
            resolve(img);
          });
        };
        img.onerror = function () {
          delete imageCache[url];
          reject(new Error("image load failed: " + url));
        };
        img.src = url;
      });
    }
    return imageCache[url];
  }

  function withTimeout(promise, ms) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        reject(new Error("timeout"));
      }, ms);
      promise.then(function (v) {
        clearTimeout(timer);
        resolve(v);
      }, function (e) {
        clearTimeout(timer);
        reject(e);
      });
    });
  }

  function textureSource(img, maxSide) {
    var w = img.naturalWidth;
    var h = img.naturalHeight;
    var scale = Math.min(1, maxSide / Math.max(w, h));
    if (scale === 1) return { source: img, width: w, height: h };
    var c = document.createElement("canvas");
    c.width = Math.round(w * scale);
    c.height = Math.round(h * scale);
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    return { source: c, width: c.width, height: c.height };
  }

  // 메인 화면은 세로 스크롤바 자리를 비워 두므로(scrollbar-gutter) 그 폭을 잰다
  function scrollbarWidth() {
    var probe = document.createElement("div");
    probe.style.cssText = "position:absolute;top:-9999px;width:100px;height:100px;overflow:scroll;";
    document.body.appendChild(probe);
    var w = probe.offsetWidth - probe.clientWidth;
    probe.parentNode.removeChild(probe);
    return w;
  }

  function compile(gl, type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      throw new Error("shader compile failed: " + gl.getShaderInfoLog(shader));
    }
    return shader;
  }

  function texture(gl, unit, src) {
    var tex = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src.source);
  }

  function reset() {
    cancelAnimationFrame(activeFrame);
    if (activeCanvas && activeCanvas.parentNode) activeCanvas.parentNode.removeChild(activeCanvas);
    activeCanvas = null;
  }

  function play(options) {
    var duration = options.duration || 1700;
    reset();
    return withTimeout(Promise.all([loadImage(options.from), loadImage(options.to)]), LOAD_TIMEOUT_MS)
      .then(function (images) {
        var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
        var canvas = document.createElement("canvas");
        canvas.className = "page_transition_canvas";
        canvas.setAttribute("aria-hidden", "true");
        canvas.width = Math.round(window.innerWidth * dpr);
        canvas.height = Math.round(window.innerHeight * dpr);
        var attrs = { alpha: false, antialias: false, depth: false, stencil: false };
        var gl = canvas.getContext("webgl2", attrs) || canvas.getContext("webgl", attrs);
        if (!gl) throw new Error("WebGL unavailable");

        var maxSide = Math.min(MAX_TEXTURE_SIDE, gl.getParameter(gl.MAX_TEXTURE_SIZE));
        var fromTex = textureSource(images[0], maxSide);
        var toTex = textureSource(images[1], maxSide);
        var program = gl.createProgram();
        gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
        gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
          throw new Error("program link failed: " + gl.getProgramInfoLog(program));
        }
        gl.useProgram(program);
        var buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
        var aPos = gl.getAttribLocation(program, "aPos");
        gl.enableVertexAttribArray(aPos);
        gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
        texture(gl, 0, fromTex);
        texture(gl, 1, toTex);

        function loc(name) {
          return gl.getUniformLocation(program, name);
        }
        var contentW = window.innerWidth - scrollbarWidth();
        var heroH = Math.max(window.innerHeight * HERO_VH, HERO_MIN_H);
        gl.uniform1i(loc("uFrom"), 0);
        gl.uniform1i(loc("uTo"), 1);
        gl.uniform2f(loc("uRes"), canvas.width, canvas.height);
        gl.uniform2f(loc("uFromSize"), fromTex.width, fromTex.height);
        gl.uniform2f(loc("uToSize"), toTex.width, toTex.height);
        gl.uniform1f(loc("uFromBright"), options.fromBrightness);
        gl.uniform1f(loc("uPx"), dpr);
        gl.uniform1f(loc("uContentW"), contentW * dpr);
        gl.uniform1f(loc("uHeroH"), heroH * dpr);
        gl.uniform1f(loc("uHeroTop"), HERO_TOP * dpr);
        gl.uniform1f(loc("uNavH"), NAV_H * dpr);
        var uP = loc("uP");
        var uTime = loc("uTime");
        gl.viewport(0, 0, canvas.width, canvas.height);

        function draw(progress, seconds) {
          gl.uniform1f(uP, progress);
          gl.uniform1f(uTime, seconds);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
        }
        draw(0, 0); // 첫 프레임(= 지금 시작 화면 배경)을 그린 뒤 붙여서 깜빡이지 않게
        document.body.appendChild(canvas);
        activeCanvas = canvas;

        return new Promise(function (resolve) {
          var start = performance.now();
          function frame(now) {
            if (activeCanvas !== canvas) return;
            var elapsed = now - start;
            var progress = Math.min(1, elapsed / duration);
            draw(progress, elapsed / 1000);
            if (progress < 1) {
              activeFrame = requestAnimationFrame(frame);
            } else {
              resolve();
            }
          }
          activeFrame = requestAnimationFrame(frame);
        });
      });
  }

  function preload(urls) {
    urls.forEach(function (url) {
      loadImage(url).catch(function () {});
    });
  }

  window.StartToMain = { play: play, preload: preload, reset: reset };
})();
