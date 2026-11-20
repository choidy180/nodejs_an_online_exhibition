# 페이지 전환 연출(반짝이는 원형 디졸브) — 다른 프로젝트용 프롬프트

이 프로젝트의 **인트로 → 시작 화면**, **시작 화면 → 메인 / 로그인** 전환을 다른 프로젝트에 그대로 옮길 때 쓰는 프롬프트입니다.

**쓰는 법**
1. 아래 `---` 줄부터 끝까지 복사합니다.
2. **0. 채워 넣을 값**의 `[대괄호]` 부분을 그 프로젝트에 맞게 채웁니다.
3. 그 프로젝트에서 연 Claude Code에 붙여 넣습니다.

같은 PC에서 작업한다면 참고 구현 경로도 함께 알려 주면 더 정확합니다.
- `D:\dev\2026-remake-nodejs_an_online_exhibition\public\javascripts\page-transition.js` — 효과 본체
- `views\start.ejs` — 출발 화면: 버튼 처리
- `views\main.ejs`, `views\user\login.ejs` — 도착 화면: 입장 처리
- `public\stylesheets\intro.css` — "페이지 전환 ②, ③" 구역
- `public\stylesheets\style.css` — "시작 화면 → 메인 입장" 구역

---

이 프로젝트에 **페이지 전환 연출**을 넣어 줘. 아래 명세를 빠짐없이 지키고, 다 만든 뒤에는 **6. 검증 방법**대로 브라우저에서 직접 확인한 결과까지 알려 줘.

## 0. 채워 넣을 값

| 항목 | 값 |
| --- | --- |
| 출발 화면 (URL / 파일) | `[예: /start — views/start.ejs]` |
| 전환을 거는 링크·버튼 | `[예: "로그인" 버튼 a[href="/login"]]` (여러 개면 전부) |
| 출발 화면 배경 | 이미지 `[경로]`, 배치 `[cover / center]`, 밝기 `[예: filter: brightness(20%) → 0.2]` |
| 도착 화면 (URL / 파일) | `[예: /login — views/login.ejs]` |
| 도착 화면 **첫 장면**의 모양 | `[A: 화면 전체를 덮는 배경 이미지 한 장 + 밝기]` 또는 `[B: 여러 층 합성 — 아래에 CSS 값 전부 나열]` |
| (B일 때) 첫 장면을 이루는 CSS | `[예: 히어로 박스 높이 max(70vh,600px), top:-70px, background cover, ::after 그라데이션 스톱…, 내비게이션 띠 높이 70px rgba(0,0,0,.8), 페이지 배경 #141414, scrollbar-gutter: stable]` |
| 도착 화면에서 차례로 나타날 요소 | `[예: .panel > * / 내비게이션 → 히어로 글 → 카드]` |
| 전환 시간 | `[기본 1700ms]` |
| 프레임워크 | `[예: Express+EJS(페이지 이동) / Next.js(SPA 라우팅)]` |

## 1. 만들 효과

출발 화면의 글과 버튼이 먼저 걷힌 뒤, 배경 이미지 위로 **반짝이는 원형 디졸브**가 화면 가운데에서 바깥으로 번집니다. 원 안쪽에는 다음 화면이 보이고, 원이 화면을 다 덮는 순간 **다음 화면의 첫 장면과 픽셀 단위로 똑같아진** 상태에서 실제로 이동합니다. 도착한 화면은 배경을 움직이지 않고, 글과 버튼만 위에서부터 차례로 드러냅니다. 그래서 두 페이지가 하나의 장면처럼 이어집니다.

진행도 `p`(0 → 1) 기준 타임라인은 다음과 같습니다.

| 구간 | 일어나는 일 |
| --- | --- |
| 0 ~ 0.45 | 화면 가운데에 작은 빛 구슬(orb)이 생겼다가 커지면서 사라짐 |
| 0.08 ~ 0.4 | 출발 이미지가 점점 "엑스레이" 느낌으로 바뀜: 어두워지고, 윤곽선(Sobel)만 희게 남음. 경계선에 가까울수록 더 강하게 |
| 0.15 ~ 0.90 | 노이즈로 일렁이는 원형 경계가 가운데에서 화면 끝까지 커짐 |
| 0.12 ~ 0.98 | 경계선을 따라 얇은 따뜻한 빛 선, 지글거리는 점(speck), 십자 모양으로 반짝이는 별(glint)이 나타남 |
| 원 안쪽 | 도착 이미지가 처음에는 엑스레이로 보이다가, 경계에서 멀어질수록 원래 색으로 자리 잡음 |
| 0.86 ~ 1.0 | 모든 효과가 걷히고 도착 화면 첫 장면 그대로가 됨. p = 1이 곧 도착 화면 첫 프레임 |

출발 화면의 글과 버튼은 클릭 직후 280ms 동안 아래에서 위로 잘려 나가듯 사라집니다(clip-path, 요소마다 40ms씩 늦게 시작). 그 뒤 패널이 0.22초부터 0.35초 동안 흐려집니다.

## 2. 반드시 지킬 원칙

1. **마지막 프레임 = 도착 화면의 첫 화면.**
   - 셰이더가 그리는 p = 1 장면은 도착 화면의 CSS 배경을 그대로 재현해야 합니다.
   - 맞출 값: cover 배치 계산, `filter: brightness()`, 반투명 막, 그라데이션 스톱, 내비게이션 띠, 스크롤바 폭, 음수 top, min-height.
   - CSS 값을 셰이더나 JS에 옮겨 적은 곳마다 `// style.css 의 ○○ 와 같아야 한다` 같은 주석을 남깁니다.
2. **도착 화면은 첫 페인트 전에 입장 상태가 되어야 합니다.**
   - `<head>` 안의 인라인 스크립트가 sessionStorage 플래그를 읽고, `<html>`에 클래스를 붙인 뒤 플래그를 바로 지웁니다.
   - 첫 페인트 뒤에 붙이면 글이 먼저 보였다가 사라지는 깜빡임이 생깁니다.
3. **실패해도 이동은 반드시 됩니다.** 다음 경우에는 효과 없이 평소처럼 이동해야 합니다.
   - WebGL을 쓸 수 없을 때
   - 이미지 로드가 실패하거나 시간 초과일 때
   - `prefers-reduced-motion`을 켰을 때
   - Ctrl·⌘·Shift·가운데 버튼으로 클릭했을 때(새 탭 열기)
4. **도착 화면에 바로 들어온 경우**(주소창 입력, 새로고침, 다른 링크)에는 입장 효과가 걸리지 않고 기존과 똑같이 동작해야 합니다.

## 3. 구현 구조

### 3-1. `page-transition.js` (효과 본체, 의존성 없음)

`window.PageTransition = { play, preload, reset }`

**`play(options)` → Promise**: 끝나면 resolve하고, 못 쓰면 reject합니다.

options는 다음과 같습니다.
- `from`, `fromBrightness`: 출발 배경 이미지와 밝기
- `to`, `toBrightness`, `toLayout`: 도착 첫 장면. `toLayout`은 `"cover"` 또는 합성 이름
- `duration`: 기본 1700

처리 순서는 다음과 같습니다.
1. `reset()`을 먼저 호출해 남아 있는 캔버스를 정리합니다.
2. 두 이미지를 불러옵니다.
   - URL별 Promise 캐시를 둡니다(`preload`와 공유).
   - `onload` 뒤에 `img.decode()`를 기다리되, **최대 300ms까지만** 기다립니다(`Promise.race`). 탭이 그려지지 않는 동안에는 `decode()`가 끝나지 않을 수 있는데, 다 받은 이미지는 decode 없이도 텍스처로 쓸 수 있습니다.
   - 전체 로드는 **2500ms** 안에 끝나지 않으면 reject합니다.
3. 캔버스를 만듭니다.
   - `className = "page_transition_canvas"`, `aria-hidden="true"`
   - 크기는 `innerWidth × innerHeight × dpr`, dpr은 `min(devicePixelRatio, 1.5)`로 제한합니다(성능).
   - 컨텍스트는 `getContext("webgl2", attrs) || getContext("webgl", attrs)`, attrs는 `{ alpha:false, antialias:false, depth:false, stencil:false }`입니다. 둘 다 없으면 throw → reject.
4. 텍스처를 올립니다.
   - 긴 변이 `min(2048, MAX_TEXTURE_SIZE)`보다 크면 2D 캔버스로 줄인 뒤 올립니다.
   - 설정은 `CLAMP_TO_EDGE` + `LINEAR`, 밉맵은 쓰지 않습니다(WebGL1의 NPOT 제약 회피).
   - `UNPACK_FLIP_Y_WEBGL`은 false입니다. 셰이더에서 y를 직접 뒤집습니다.
5. 화면 전체를 덮는 **삼각형 1개**를 그립니다. 정점은 `[-1,-1, 3,-1, -1,3]`입니다.
6. **`draw(0)`을 먼저 한 뒤 캔버스를 body에 붙입니다.** 그래야 처음 보이는 프레임이 지금 배경과 똑같아 깜빡이지 않습니다.
7. 이름 붙인 함수 `function frame(now)`로 `requestAnimationFrame` 루프를 돕니다.
   - `progress = min(1, elapsed / duration)`, `uTime = elapsed / 1000`
   - progress가 1이면 resolve합니다.
   - **캔버스는 지우지 않습니다.** 페이지가 바뀔 때까지 마지막 장면을 덮고 있어야 흰 화면이 끼지 않습니다.
   - 함수 이름을 `frame`으로 두는 이유는 검증 때 이 콜백만 골라 잡기 위해서입니다.

**`reset()`**: rAF를 취소하고 캔버스를 제거합니다. 뒤로 가기로 bfcache에서 복원될 때 씁니다.

**`preload(urls)`**: 같은 캐시로 이미지를 미리 받아 둡니다.

**셰이더 유니폼**: `uFrom`, `uTo`, `uRes`(캔버스 px), `uFromSize`, `uToSize`, `uFromBright`, `uToBright`, `uP`, `uTime`, `uPx`(= dpr). 합성 장면을 쓰면 장면의 치수(px × dpr)를 유니폼으로 더 넘깁니다.

### 3-2. 버텍스·프래그먼트 셰이더 (그대로 쓰고, `destFrame`만 프로젝트에 맞게)

```glsl
// vertex
attribute vec2 aPos;
varying vec2 vUv;
void main() {
  vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5); // 왼쪽 위가 (0,0)
  gl_Position = vec4(aPos, 0.0, 1.0);
}
```

```glsl
// fragment (GLSL ES 1.0 — WebGL1/2 모두 동작)
precision highp float;
varying vec2 vUv;
uniform sampler2D uFrom;
uniform sampler2D uTo;
uniform vec2 uRes;
uniform vec2 uFromSize;
uniform vec2 uToSize;
uniform float uFromBright;
uniform float uToBright;
uniform float uP;
uniform float uTime;
uniform float uPx;

// CSS background-size: cover; background-position: center 과 같은 계산
vec2 coverUv(vec2 uv, vec2 img) {
  float s = max(uRes.x / img.x, uRes.y / img.y);
  vec2 disp = img * s;
  return (uv * uRes - (uRes - disp) * 0.5) / disp;
}
vec2 coverTexel(vec2 img) {
  return vec2(1.1 * uPx) / (img * max(uRes.x / img.x, uRes.y / img.y));
}
float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float fbm(vec2 p) {
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8); // 옥타브마다 돌려서 격자 무늬가 안 보이게
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * noise(p);
    p = rot * p * 2.03 + 17.1;
    a *= 0.5;
  }
  return v;
}
float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
// 엑스레이: 어둡게 + Sobel 윤곽선 + 밝은 부분만 살짝
vec3 xray(sampler2D tex, vec2 uv, vec2 texel, vec3 base) {
  float tl = lum(texture2D(tex, uv + texel * vec2(-1.0, -1.0)).rgb);
  float t  = lum(texture2D(tex, uv + texel * vec2( 0.0, -1.0)).rgb);
  float tr = lum(texture2D(tex, uv + texel * vec2( 1.0, -1.0)).rgb);
  float l  = lum(texture2D(tex, uv + texel * vec2(-1.0,  0.0)).rgb);
  float r  = lum(texture2D(tex, uv + texel * vec2( 1.0,  0.0)).rgb);
  float bl = lum(texture2D(tex, uv + texel * vec2(-1.0,  1.0)).rgb);
  float b  = lum(texture2D(tex, uv + texel * vec2( 0.0,  1.0)).rgb);
  float br = lum(texture2D(tex, uv + texel * vec2( 1.0,  1.0)).rgb);
  float gx = -tl - 2.0 * l - bl + tr + 2.0 * r + br;
  float gy = -tl - 2.0 * t - tr + bl + 2.0 * b + br;
  float e = sqrt(gx * gx + gy * gy);
  float L = lum(base);
  vec3 col = mix(vec3(L), base, 0.4) * 0.066;
  col += vec3(0.92, 0.95, 1.0) * smoothstep(0.08, 0.5, e) * 0.27;
  col += vec3(1.0) * pow(L, 4.0) * 0.054;
  return col;
}
// 72px 격자 칸의 20%에 십자 빛 별, 반짝임
float glints(vec2 frag) {
  float G = 72.0 * uPx;
  vec2 gid = floor(frag / G);
  vec2 gf = frag - gid * G;
  float acc = 0.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 o = vec2(float(x), float(y));
      vec2 id = gid + o;
      float h = hash(id * 1.31 + 7.7);
      if (h > 0.8) {
        vec2 pos = (o + vec2(hash(id + 1.1), hash(id + 2.3))) * G;
        vec2 q = gf - pos;
        float size = mix(0.6, 1.5, hash(id + 3.7)) * uPx;
        float twinkle = 0.55 + 0.45 * sin(uTime * 7.0 + h * 40.0);
        float d = length(q);
        float core = size * 2.2 / max(d, 0.75 * uPx);
        float rays = max(0.0, 1.0 - abs(q.x * q.y) / (size * size * 18.0));
        rays *= 1.0 - smoothstep(0.0, size * 26.0, d);
        acc += (core * core * 0.5 + rays * 0.9) * twinkle;
      }
    }
  }
  return acc;
}

// ★ 도착 화면 첫 장면. 이 함수만 프로젝트에 맞게 바꾼다.
//   uv: 0~1(왼쪽 위 기준), ft: 왼쪽 위 기준 픽셀 좌표(× dpr)
//   tuv/texel: 엑스레이용 도착 텍스처 좌표·한 칸 크기, inImg: 이 픽셀이 이미지 위인지(1) 단색 영역인지(0)
vec3 destFrame(vec2 uv, vec2 ft, out vec2 tuv, out vec2 texel, out float inImg) {
  // (A) 화면 전체 cover 배경 × 밝기 — CSS: background: url() center/cover; filter: brightness(N%)
  tuv = coverUv(uv, uToSize);
  texel = coverTexel(uToSize);
  inImg = 1.0;
  return texture2D(uTo, tuv).rgb * uToBright;
}

void main() {
  vec2 uv = vUv;
  vec2 ft = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 fuv = coverUv(uv, uFromSize);
  vec3 fromRaw = texture2D(uFrom, fuv).rgb;
  vec3 fromCol = fromRaw * uFromBright;
  float p = uP;
  if (p <= 0.0005) { gl_FragColor = vec4(fromCol, 1.0); return; } // p=0 은 지금 배경 그대로

  vec2 tuv; vec2 texT; float inImg;
  vec3 toCol = destFrame(uv, ft, tuv, texT, inImg);
  vec3 toRaw = texture2D(uTo, tuv).rgb;
  vec3 toXray = inImg > 0.5 ? xray(uTo, tuv, texT, toRaw) : toCol * 0.6;
  vec2 texF = coverTexel(uFromSize);

  // 화면 비율을 보정한 중심 거리 (0 = 가운데, 1 = 모서리)
  vec2 aspect = vec2(uRes.x / uRes.y, 1.0);
  vec2 c = (uv - 0.5) * aspect;
  float d = length(c) / length(aspect * 0.5);
  // 경계를 일렁이게: 큰 fbm(±0.16) + 잔물결(±0.025)
  float n = fbm(c * 2.6 + vec2(0.0, uTime * 0.15));
  float n2 = noise(c * 26.0 + uTime * 0.6);
  float dd = d + (n - 0.5) * 0.32 + (n2 - 0.5) * 0.05;
  float grow = clamp((p - 0.15) / 0.75, 0.0, 1.0);
  float r = mix(-0.32, 1.35, grow); // 1.35: 노이즈까지 포함해 모서리를 확실히 넘도록
  float ahead = dd - r;   // > 0 이면 아직 경계 바깥(출발 화면)
  float behind = r - dd;  // > 0 이면 경계 안쪽(도착 화면)
  float inside = 1.0 - smoothstep(-0.012, 0.012, ahead);

  float ax = smoothstep(0.08, 0.4, p) * (0.4 + 0.6 * (1.0 - smoothstep(0.0, 0.6, ahead)));
  vec3 fromStyled = mix(fromCol, xray(uFrom, fuv, texF, fromRaw), ax);
  float settle = max(smoothstep(0.04, 0.6, behind), smoothstep(0.86, 1.0, p));
  vec3 toStyled = mix(toXray, toCol, settle);
  vec3 col = mix(fromStyled, toStyled, inside);

  float live = smoothstep(0.12, 0.22, p) * (1.0 - smoothstep(0.84, 0.98, p));
  col += vec3(1.0, 0.97, 0.92) * exp(-abs(ahead) * 30.0) * 0.18 * live;                 // 경계 빛 선
  float band = exp(-abs(ahead) * 7.0) + exp(-max(behind, 0.0) * 3.0) * 0.35 * inside;
  vec2 cell = floor(gl_FragCoord.xy / (1.5 * uPx));
  float speck = step(0.982, hash(cell + floor(uTime * 24.0) * 0.137));                     // 지글거리는 점 (24fps)
  col += vec3(1.0) * speck * band * live * 0.31;
  col += vec3(1.0, 0.98, 0.95) * glints(gl_FragCoord.xy) * band * live * 0.25;           // 별 반짝임
  float orbOn = smoothstep(0.0, 0.14, p) * (1.0 - smoothstep(0.26, 0.45, p));
  float orbR = mix(0.012, 0.075, smoothstep(0.0, 0.3, p));
  col += vec3(1.0, 0.98, 0.94) * (exp(-d / orbR) * 0.47 + exp(-d / (orbR * 3.5)) * 0.1) * orbOn; // 가운데 빛 구슬
  gl_FragColor = vec4(min(col, vec3(1.0)), 1.0);
}
```

### 3-3. 도착 첫 장면이 여러 층(B)일 때 `destFrame` 작성법

CSS 층을 **아래에서 위로** 하나씩 그대로 계산합니다. 메인 화면 예시는 다음과 같습니다.

1. **스크롤바 자리**
   - 도착 화면에 세로 스크롤바(또는 `scrollbar-gutter: stable`)가 있으면, 내용 폭은 `innerWidth - 스크롤바 폭`입니다.
   - 스크롤바 폭은 `overflow:scroll` 프로브 div의 `offsetWidth - clientWidth`로 잽니다.
   - 오른쪽 스크롤바 자리는 페이지 배경색으로 칠합니다.
2. **히어로 박스**: `top`(음수 가능), 높이 `max(70vh, 600px)` 같은 값을 JS에서 px로 계산해 유니폼으로 넘기고, 박스 안에서만 cover를 계산합니다. 박스 밖은 페이지 배경색입니다.
   ```glsl
   vec2 box = vec2(uContentW, uHeroH);
   vec2 local = vec2(ft.x, ft.y - uHeroTop);
   float s = max(box.x / uToSize.x, box.y / uToSize.y);
   vec2 disp = uToSize * s;
   tuv = (local - (box - disp) * 0.5) / disp;
   texel = vec2(1.1 * uPx) / disp;
   ```
3. **반투명 검정 막** `rgba(0,0,0,a)`: `col *= (1.0 - a)`
4. **색으로 짙어지는 그라데이션** `linear-gradient(rgba(R,G,B,0) …, rgba(R,G,B,1) …)`
   - `col = mix(col, RGB, alphaAt(y))`
   - `alphaAt`는 CSS 스톱을 **같은 위치·같은 값**으로 `if (t <= 0.35) return mix(…)` 식으로 구간마다 선형 보간합니다.
   - 가로 그라데이션(왼쪽 막 등)도 같은 방식입니다.
5. **`filter: brightness(N%)`**: 마지막에 `col *= N/100`
6. **내비게이션 띠**: `if (ft.y < uNavH) col *= (1.0 - 띠알파)`. 배경이 검정 반투명일 때입니다.
7. 단색 영역에서는 `inImg = 0`으로 두면 엑스레이 대신 `toCol * 0.6`을 씁니다.

CSS 층 순서와 곱하는 순서가 같아야 합니다. 예를 들어 `::after` 막이 이미지 위에 있으면, 이미지 × 막 → 그라데이션 순서입니다.

### 3-4. 출발 화면

**CSS**
```css
.page_transition_canvas {
  position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
  z-index: [배경보다 위, 글·버튼 패널보다 아래];
  pointer-events: none;
}
/* 글과 버튼이 아래에서 위로 잘려 나가듯 사라짐 */
body.is-leaving .panel > * { animation: block_out 280ms cubic-bezier(0.32, 0, 0.67, 0) forwards; }
body.is-leaving .panel > :nth-child(2) { animation-delay: 40ms; }
/* … 자식 수만큼 40ms씩 (마지막 몇 개는 30ms 간격) */
body.is-leaving .panel { pointer-events: none; animation: panel_out 0.35s ease 0.22s forwards; }
@keyframes block_out {
  from { clip-path: inset(-12px -12px -12px -12px); }
  to   { clip-path: inset(-12px -12px calc(100% + 12px) -12px); } /* 100%에서 멈추면 1px 잔상이 남는다 */
}
@keyframes panel_out { to { opacity: 0; } }
```

**클릭 처리** (링크에 `data-page-transition="키"`를 달고, 목적지 설정은 한 곳에 모읍니다)
```js
var FROM = { image: "[출발 배경]", brightness: [0.2] };
var DESTINATIONS = {
  login: { to: "[도착 배경]", toLayout: "cover", toBrightness: [0.2], flag: "[login_transition]" }
  // main: { to: "...", toLayout: "main", flag: "main_transition" }
};
var reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
var leaving = false, fallbackTimer = null;
document.querySelectorAll("[data-page-transition]").forEach(function (link) {
  var dest = DESTINATIONS[link.dataset.pageTransition];
  if (!dest) return;
  link.addEventListener("click", function (e) {
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return; // 새 탭은 그대로
    if (reduceMotion || !window.PageTransition) return;                              // 평소처럼 이동
    e.preventDefault();
    if (leaving) return;                                                              // 연타 방지
    leaving = true;
    try { sessionStorage.setItem(dest.flag, "1"); } catch (_) {}
    document.body.classList.add("is-leaving");
    var go = function () { location.href = link.getAttribute("href"); };
    PageTransition.play({ from: FROM.image, fromBrightness: FROM.brightness, to: dest.to,
                          toLayout: dest.toLayout, toBrightness: dest.toBrightness, duration: 1700 })
      .then(go, function () { fallbackTimer = setTimeout(go, 420); });              // 실패하면 패널이 걷힌 뒤 이동
  });
});
addEventListener("load", function () {                                               // 미리 받아 두기
  if (window.PageTransition) PageTransition.preload([FROM.image].concat(Object.keys(DESTINATIONS).map(function (k) { return DESTINATIONS[k].to; })));
});
addEventListener("pageshow", function (e) {                                          // 뒤로 가기(bfcache) 복원
  if (!e.persisted) return;
  clearTimeout(fallbackTimer); leaving = false;
  if (window.PageTransition) PageTransition.reset();
  document.body.classList.remove("is-leaving");
});
```

### 3-5. 도착 화면

**`<head>` 안, CSS 링크 근처에 동기 인라인 스크립트로 둡니다.** defer, async, 모듈은 안 됩니다.
```html
<link rel="preload" href="[도착 배경]" as="image">
<script>
  (function () {
    try {
      if (sessionStorage.getItem("[flag]") !== "1") return;
      sessionStorage.removeItem("[flag]");               // 읽자마자 지운다 (새로고침하면 효과 없음)
      if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      document.documentElement.classList.add("[page-enter]");
    } catch (e) {}
  })();
</script>
```

**CSS**
```css
html.page-enter { background: [도착 화면 배경색]; }   /* 이미지가 그려지기 전 한 프레임이 흰색으로 튀지 않게 */
.page-enter .nav { animation: enter_fade 0.6s ease 0.1s both; }
.page-enter .panel > * { animation: enter_rise 0.6s cubic-bezier(0.16, 1, 0.3, 1) both; }
.page-enter .panel > :nth-child(1) { animation-delay: 0.15s; }
/* … 자식 수만큼 0.06~0.07s씩. 빠진 자식이 있으면 그 요소만 먼저 튀어나온다 */
@keyframes enter_fade { from { opacity: 0; } }
@keyframes enter_rise { from { opacity: 0; transform: translateY(14px); } }
/* 패널형이면 clip-path 로 위에서부터 드러내는 방식도 좋다:
   from { clip-path: inset(-12px -12px calc(100% + 12px) -12px); transform: translateY(-12px); } */
@media (prefers-reduced-motion: reduce) { .page-enter * { animation: none !important; } }
```

**`</body>` 직전, 효과가 끝나면 클래스를 뗍니다.** `animation-fill-mode: both`가 남아 있으면 hover의 transform·opacity가 먹지 않기 때문입니다.
```html
<script>
  if (document.documentElement.classList.contains("[page-enter]")) {
    setTimeout(function () {
      document.documentElement.classList.add("[page-entered]");   // ↓ 주의 참고
      document.documentElement.classList.remove("[page-enter]");
    }, [가장 늦은 delay + duration + 여유 ≈ 1600]);
  }
</script>
```
**주의**: 도착 화면의 레이아웃에 `body { animation: fadein 1s }` 같은 전역 등장 애니메이션이 있다고 합시다.
- 입장 중에는 `html.page-enter body { animation: none !important; }`로 꺼야 합니다. 켜 두면 배경까지 흐려져 이음매가 깨집니다.
- 클래스를 떼는 순간 그 애니메이션이 **다시 시작돼 화면 전체가 한 번 더 깜빡입니다.**
- 그래서 `html.page-entered body { animation: none !important; }`로 계속 막아 둡니다.

## 4. 조절 값

| 값 | 기본 | 의미 |
| --- | --- | --- |
| `duration` | 1700ms | 전체 길이. 빠르게 하려면 줄인다 |
| xray `0.066 / 0.27 / 0.054` | | 엑스레이 바탕 / 윤곽선 / 밝은 부분 세기 |
| 경계 빛 선 `0.18` | | 원 둘레의 얇은 빛 |
| speck `0.31`, 문턱 `0.982`, 칸 `1.5px` | | 지글거리는 점의 세기·밀도·크기 |
| glint `0.25`, 격자 `72px`, 비율 `h > 0.8` | | 별 반짝임 세기·간격·개수 |
| orb `0.47 / 0.1` | | 가운데 빛 구슬 중심·번짐 세기 |
| `MAX_TEXTURE_SIDE` 2048, dpr 상한 1.5 | | 성능 |
| 로드 제한 2500ms, decode 대기 300ms | | 실패 판정 |

**전체를 더 어둡게 또는 밝게** 하려면 xray·빛 선·speck·glint·orb의 세기 값을 같은 비율로 곱합니다. 위 값은 처음 값에서 40%를 낮춘 것입니다. 도착·출발 이미지의 밝기(`*Brightness`)는 실제 화면과 같아야 하므로 건드리지 않습니다.

## 5. 자주 생기는 문제와 해결

| 증상 | 원인 → 해결 |
| --- | --- |
| 이동하는 순간 화면이 툭 바뀜 | p = 1 장면과 도착 화면이 다름 → 6-1의 두 스크린샷을 비교해 다른 층을 찾는다. 흔한 원인은 스크롤바 폭, `100vw`와 내용 폭의 차이, min-height, 음수 top, 그라데이션 스톱 오타, brightness 누락 |
| 두 페이지 사이에 흰 화면 한 프레임 | 도착 화면 `html.page-enter { background }` 누락, 또는 출발 화면이 끝에서 캔버스를 지움 → 캔버스는 이동할 때까지 둔다 |
| 도착 화면에서 글이 보였다가 사라졌다 다시 나옴 | 클래스를 첫 페인트 뒤에 붙임 → `<head>` 인라인 동기 스크립트로 |
| 입장이 끝난 뒤 화면 전체가 한 번 더 흐려짐 | 전역 body 등장 애니메이션이 클래스를 떼는 순간 다시 걸림 → `page-entered` 표시로 계속 끈다 |
| 사라지는 요소 아래에 1px 선이 남음 | clip-path 끝값을 `calc(100% + 12px)`로 |
| 일부 요소만 먼저 튀어나옴 | nth-child 지연이 자식 수보다 적음 → 전부 적는다 |
| 효과 없이 바로 이동함 (가끔) | 이미지 로드·decode 시간 초과 → `preload`가 `load`에서 도는지, 이미지가 너무 크지 않은지(수 MB) 확인. 탭이 백그라운드면 `decode()`가 끝나지 않으므로 300ms 상한 필수 |
| 새로고침하면 입장 효과가 또 나옴 | 플래그를 읽고 바로 안 지움 |
| 뒤로 가기 하면 출발 화면이 빈 채로 멈춤 | bfcache 복원 시 `pageshow`에서 `reset()` + `is-leaving` 제거 |
| 고해상도 화면에서 버벅임 | dpr 상한 1.5, 텍스처 2048 제한 |

## 6. 검증 방법 (다 만든 뒤 반드시 직접 실행)

브라우저 창 크기는 두 화면에서 같아야 합니다. 백그라운드 탭에서는 rAF·decode가 멈출 수 있으니 탭을 앞에 둡니다.

**6-1. 이음매 비교** (가장 중요)

출발 화면에서 패널을 숨기고 p = 1 장면을 멈춰 찍습니다.
```js
await new Promise(r => setTimeout(r, 800));
window.requestAnimationFrame = (orig => cb => (cb && cb.name === "frame") ? (window.__cb = cb, 1) : orig.call(window, cb))(window.requestAnimationFrame);
document.querySelector("[패널 선택자]").style.visibility = "hidden";
const realNow = performance.now.bind(performance); performance.now = () => 0;
PageTransition.play({ /* 실제 버튼과 같은 옵션 */ }).catch(e => window.__err = String(e));
for (let i = 0; i < 30 && !window.__cb && !window.__err; i++) await new Promise(r => setTimeout(r, 100));
performance.now = realNow; if (window.__cb) window.__cb(1700 /* = duration */);
({ err: window.__err || null, captured: !!window.__cb })   // → 여기서 스크린샷 A
```

도착 화면은 플래그를 심고 열어, 입장 애니메이션을 0초에서 멈춰 찍습니다.
```js
sessionStorage.setItem("[flag]", "1"); location.href = "[도착 URL]";
// 이동 뒤:
await new Promise(r => setTimeout(r, 300));
document.getAnimations().forEach(a => { a.pause(); a.currentTime = 0; });  // → 스크린샷 B
```

A와 B의 배경(이미지 위치·크기·밝기, 그라데이션, 띠, 오른쪽 스크롤바 자리)이 같아야 합니다. 브라우저가 그리는 스크롤바 자체만 예외입니다.

**6-2. 실제 클릭**
- 버튼을 실제로 눌러 중간 장면(원형 경계·반짝임)을 한 번 찍습니다.
- 도착 뒤 확인할 것:
  - 입장 클래스가 붙었다가 정해진 시간 뒤 떨어지는지
  - 플래그가 지워졌는지
  - 콘솔 오류가 없는지
  - 클래스가 떨어진 뒤 `body`의 opacity가 1이고 다시 흐려지지 않는지(200ms 간격 샘플링)

**6-3. 예외 경로**
- 도착 화면 직접 접속·새로고침: 효과 없이 기존 그대로여야 합니다(전역 fadein 등 원래 동작 유지).
- Ctrl+클릭: 새 탭이 열리고, 원래 탭은 그대로여야 합니다.
- `prefers-reduced-motion`: 효과 없이 바로 이동해야 합니다.
- 뒤로 가기: 출발 화면이 원래 상태로 돌아와야 합니다.

## 7. SPA(React·Next·Vue 라우팅)라면

페이지가 새로 로드되지 않으므로 sessionStorage 플래그 대신 상태로 처리합니다.
1. 캔버스를 레이아웃 최상위(라우트 밖)에 둡니다.
2. p = 1이 되면 `router.push()`를 호출합니다.
3. 도착 라우트의 **첫 커밋 후 두 번째 rAF**(`requestAnimationFrame(() => requestAnimationFrame(...))`)에서 캔버스를 제거하고, 입장 클래스를 붙입니다.

"마지막 프레임 = 도착 첫 장면" 원칙은 똑같이 지킵니다. 라우트 전환 애니메이션 라이브러리(framer-motion 등)의 기본 페이드는 꺼야 이음매가 안 보입니다.

## 8. 완료 조건

- [ ] 지정한 모든 버튼에서 전환이 재생되고 도착 화면으로 이동한다
- [ ] 6-1의 A/B 스크린샷이 같다 (차이가 있으면 원인과 함께 보고)
- [ ] 도착 화면은 배경이 그대로인 채 글·버튼만 차례로 드러나고, 끝난 뒤 다시 깜빡이지 않는다
- [ ] 직접 접속·새로고침·Ctrl+클릭·reduced motion·뒤로 가기가 모두 정상이다
- [ ] 콘솔 오류 0개
- [ ] 바꾼 파일 목록과, CSS 값을 셰이더·JS에 옮겨 적은 곳(동기화가 필요한 곳) 목록을 정리해 알려 준다
