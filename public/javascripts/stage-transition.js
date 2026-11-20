/* =========================================================
   StageTransition — 인트로 → 시작 페이지 화면 전환 (WebGL)

   Shopify Editions(Winter '26)의 첫 장면 → Sidekick 전환을 참고한 효과.
   1) 화면 가운데에 빛 덩어리가 맺히고
   2) 노이즈로 일그러진 원형 경계가 반짝이며 바깥으로 번진다
   3) 아직 안 넘어간 이전 화면은 빛나는 윤곽선(엑스레이)으로 바뀌고
   4) 경계 안쪽에 드러난 다음 화면은 윤곽선에서 원래 색으로 자리를 잡는다

   마지막 프레임은 다음 페이지 배경(같은 cover 배치, 같은 밝기)과 똑같이
   끝나므로, 이동하는 순간 이어서 보인다.

   사용:
     StageTransition.preload([url])
     StageTransition.play({ from, fromBrightness, to, toBrightness, duration })
       → 끝나면 resolve, WebGL을 못 쓰거나 이미지를 못 읽으면 reject
     StageTransition.reset()   // 캔버스 제거 (bfcache 복원 등)
   ========================================================= */
(function () {
  "use strict";

  var MAX_TEXTURE_SIDE = 2048;
  var LOAD_TIMEOUT_MS = 2500;

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
    "uniform float uToBright;",
    "uniform float uP;",
    "uniform float uTime;",
    "uniform float uPx;",
    "",
    // CSS background-size: cover; background-position: center 와 같은 배치
    "vec2 coverScale(vec2 img) {",
    "  float s = max(uRes.x / img.x, uRes.y / img.y);",
    "  return img * s;",
    "}",
    "vec2 coverUv(vec2 uv, vec2 img) {",
    "  vec2 disp = coverScale(img);",
    "  return (uv * uRes - (uRes - disp) * 0.5) / disp;",
    "}",
    "",
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
    // 옥타브마다 회전시켜 격자 모양(네모난 경계)이 드러나지 않게 한다
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
    "",
    // 엑스레이 느낌: 어둡게 가라앉힌 원본 위에 소벨 윤곽선을 빛나게 올린다
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
    "  vec3 col = mix(vec3(L), base, 0.4) * 0.11;",
    "  col += vec3(0.92, 0.95, 1.0) * smoothstep(0.08, 0.5, e) * 0.45;",
    "  col += vec3(1.0) * pow(L, 4.0) * 0.09;",
    "  return col;",
    "}",
    "",
    // 십자 모양 반짝임(글린트). 화면을 칸으로 나눠 일부 칸에만 별을 둔다
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
    "",
    "void main() {",
    "  vec2 uv = vUv;",
    "  vec2 fuv = coverUv(uv, uFromSize);",
    "  vec2 tuv = coverUv(uv, uToSize);",
    "  vec2 texF = vec2(1.1 * uPx) / coverScale(uFromSize);",
    "  vec2 texT = vec2(1.1 * uPx) / coverScale(uToSize);",
    "  vec3 fromRaw = texture2D(uFrom, fuv).rgb;",
    "  vec3 toRaw = texture2D(uTo, tuv).rgb;",
    "  vec3 fromCol = fromRaw * uFromBright;",
    "  vec3 toCol = toRaw * uToBright;",
    "  float p = uP;",
    "",
    // 가운데에서 잰 거리 (모서리 = 1), 노이즈로 경계를 일그러뜨린다
    "  vec2 aspect = vec2(uRes.x / uRes.y, 1.0);",
    "  vec2 c = (uv - 0.5) * aspect;",
    "  float d = length(c) / length(aspect * 0.5);",
    "  float n = fbm(c * 2.6 + vec2(0.0, uTime * 0.15));",
    "  float n2 = noise(c * 26.0 + uTime * 0.6);",
    "  float dd = d + (n - 0.5) * 0.32 + (n2 - 0.5) * 0.05;",
    "",
    // 경계 반지름: 일정한 속도로 퍼진다 (가운데서 급하게 쏠리지 않게)
    "  float grow = clamp((p - 0.15) / 0.75, 0.0, 1.0);",
    "  float r = mix(-0.32, 1.35, grow);",
    "  float ahead = dd - r;",
    "  float behind = r - dd;",
    "  float inside = 1.0 - smoothstep(-0.012, 0.012, ahead);",
    "",
    // 이전 화면: 진행할수록, 경계에 가까울수록 엑스레이로
    "  float ax = smoothstep(0.08, 0.4, p) * (0.4 + 0.6 * (1.0 - smoothstep(0.0, 0.6, ahead)));",
    "  vec3 fromStyled = mix(fromCol, xray(uFrom, fuv, texF, fromRaw), ax);",
    "",
    // 다음 화면: 경계 바로 뒤는 엑스레이, 멀어질수록 원래 색
    "  float settle = max(smoothstep(0.04, 0.6, behind), smoothstep(0.86, 1.0, p));",
    "  vec3 toStyled = mix(xray(uTo, tuv, texT, toRaw), toCol, settle);",
    "",
    "  vec3 col = mix(fromStyled, toStyled, inside);",
    "",
    "  float live = smoothstep(0.12, 0.22, p) * (1.0 - smoothstep(0.84, 0.98, p));",
    "  float front = exp(-abs(ahead) * 30.0);",
    "  col += vec3(1.0, 0.97, 0.92) * front * 0.3 * live;",
    "",
    "  float band = exp(-abs(ahead) * 7.0) + exp(-max(behind, 0.0) * 3.0) * 0.35 * inside;",
    "  vec2 cell = floor(gl_FragCoord.xy / (1.5 * uPx));",
    "  float speck = step(0.982, hash(cell + floor(uTime * 24.0) * 0.137));",
    "  col += vec3(1.0) * speck * band * live * 0.51;",
    "  col += vec3(1.0, 0.98, 0.95) * glints(gl_FragCoord.xy) * band * live * 0.42;",
    "",
    // 시작할 때 가운데에 맺히는 빛
    "  float orbOn = smoothstep(0.0, 0.14, p) * (1.0 - smoothstep(0.26, 0.45, p));",
    "  float orbR = mix(0.012, 0.075, smoothstep(0.0, 0.3, p));",
    "  float orb = exp(-d / orbR) * 0.78 + exp(-d / (orbR * 3.5)) * 0.17;",
    "  col += vec3(1.0, 0.98, 0.94) * orb * orbOn;",
    "",
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
          var decoded = img.decode ? img.decode().catch(function () {}) : Promise.resolve();
          decoded.then(function () {
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
      promise.then(
        function (value) {
          clearTimeout(timer);
          resolve(value);
        },
        function (error) {
          clearTimeout(timer);
          reject(error);
        }
      );
    });
  }

  // 너무 큰 이미지는 줄여서 올린다 (GPU 메모리/업로드 시간 절약)
  function textureSource(img, maxSide) {
    var w = img.naturalWidth;
    var h = img.naturalHeight;
    var scale = Math.min(1, maxSide / Math.max(w, h));
    if (scale === 1) return { source: img, width: w, height: h };
    var canvas = document.createElement("canvas");
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    return { source: canvas, width: canvas.width, height: canvas.height };
  }

  function compile(gl, type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      var log = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error("shader compile failed: " + log);
    }
    return shader;
  }

  function createProgram(gl) {
    var program = gl.createProgram();
    gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER));
    gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error("program link failed: " + gl.getProgramInfoLog(program));
    }
    return program;
  }

  function createTexture(gl, unit, tex) {
    var texture = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tex.source);
    return texture;
  }

  function reset() {
    cancelAnimationFrame(activeFrame);
    if (activeCanvas && activeCanvas.parentNode) {
      activeCanvas.parentNode.removeChild(activeCanvas);
    }
    activeCanvas = null;
  }

  function play(options) {
    var duration = options.duration || 1700;
    reset();

    return withTimeout(
      Promise.all([loadImage(options.from), loadImage(options.to)]),
      LOAD_TIMEOUT_MS
    ).then(function (images) {
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      var canvas = document.createElement("canvas");
      canvas.className = "stage_transition_canvas";
      canvas.setAttribute("aria-hidden", "true");
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);

      var attrs = { alpha: false, antialias: false, depth: false, stencil: false };
      var gl = canvas.getContext("webgl2", attrs) || canvas.getContext("webgl", attrs);
      if (!gl) throw new Error("WebGL unavailable");

      var maxSide = Math.min(MAX_TEXTURE_SIDE, gl.getParameter(gl.MAX_TEXTURE_SIZE));
      var fromTex = textureSource(images[0], maxSide);
      var toTex = textureSource(images[1], maxSide);

      var program = createProgram(gl);
      gl.useProgram(program);

      var buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      var aPos = gl.getAttribLocation(program, "aPos");
      gl.enableVertexAttribArray(aPos);
      gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

      createTexture(gl, 0, fromTex);
      createTexture(gl, 1, toTex);

      function loc(name) {
        return gl.getUniformLocation(program, name);
      }
      gl.uniform1i(loc("uFrom"), 0);
      gl.uniform1i(loc("uTo"), 1);
      gl.uniform2f(loc("uRes"), canvas.width, canvas.height);
      gl.uniform2f(loc("uFromSize"), fromTex.width, fromTex.height);
      gl.uniform2f(loc("uToSize"), toTex.width, toTex.height);
      gl.uniform1f(loc("uFromBright"), options.fromBrightness);
      gl.uniform1f(loc("uToBright"), options.toBrightness);
      gl.uniform1f(loc("uPx"), dpr);
      var uP = loc("uP");
      var uTime = loc("uTime");
      gl.viewport(0, 0, canvas.width, canvas.height);

      function draw(progress, seconds) {
        gl.uniform1f(uP, progress);
        gl.uniform1f(uTime, seconds);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
      }

      // 첫 프레임(= 지금 화면과 같은 그림)을 그린 뒤에 붙여서 깜빡임을 막는다
      draw(0, 0);
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

  window.StageTransition = { play: play, preload: preload, reset: reset };
})();
