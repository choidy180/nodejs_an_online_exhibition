/* =========================================================
   인트로 제목 타이핑 효과

   - 한글을 실제 입력기처럼 자모 단위로 조합하며 친다.
       평 → ㅍ, 펴, 평   /   과 → ㄱ, 고, 과   /   닭 → ㄷ, 다, 달, 닭
   - 다음 글자의 첫 자음이 앞 글자 받침으로 먼저 붙었다가 넘어가는
     입력기 특유의 움직임(도깨비불)도 흉내 낸다.
       보고 → … 보, 복, 보고
   - 섹션이 화면에 들어오면 치기 시작하고, 화면에서 벗어나면 지워 두었다가
     다시 들어올 때 처음부터 다시 친다.
   - 최종 글자 크기만큼 자리를 미리 잡아 두므로(보이지 않는 복제본),
     치는 동안 가운데 정렬된 줄이 좌우로 흔들리지 않는다.
   ========================================================= */
(function () {
  "use strict";

  var HANGUL_BASE = 0xac00;
  var HANGUL_COUNT = 11172;
  var CHO = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";

  // 초성 → 같은 자음의 종성 번호 (ㄸ, ㅃ, ㅉ은 받침이 될 수 없다)
  var CHO_TO_JONG = {
    0: 1, 1: 2, 2: 4, 3: 7, 5: 8, 6: 16, 7: 17, 9: 19, 10: 20,
    11: 21, 12: 22, 14: 23, 15: 24, 16: 25, 17: 26, 18: 27
  };
  // 겹모음 → 먼저 치는 모음 (ㅘ = ㅗ + ㅏ …)
  var JUNG_FIRST = { 9: 8, 10: 8, 11: 8, 14: 13, 15: 13, 16: 13, 19: 18 };
  // 겹받침 → 먼저 치는 받침 (ㄺ = ㄹ + ㄱ …)
  var JONG_FIRST = { 3: 1, 5: 4, 6: 4, 9: 8, 10: 8, 11: 8, 12: 8, 13: 8, 14: 8, 15: 8, 18: 17 };
  // "받침,다음 초성" → 겹받침
  var JONG_COMBINE = {
    "1,9": 3, "4,12": 5, "4,18": 6, "8,0": 9, "8,6": 10, "8,7": 11,
    "8,9": 12, "8,16": 13, "8,17": 14, "8,18": 15, "17,9": 18
  };

  var START_DELAY_MS = 200;
  var VISIBLE_RATIO = 0.6; // 이만큼 보이면 치기 시작
  var GONE_RATIO = 0.05;   // 이보다 덜 보이면 지워 둔다
  // 섹션이 화면 밖으로 나가도 가장자리가 뷰포트에 닿아 있으면 isIntersecting이 true인 채
  // 비율만 0이 된다. 그래서 0이 아니라 GONE_RATIO 경계를 따로 두어 콜백이 꼭 오게 한다.

  function decompose(ch) {
    var code = ch ? ch.charCodeAt(0) - HANGUL_BASE : -1;
    if (code < 0 || code >= HANGUL_COUNT) return null;
    return { cho: Math.floor(code / 588), jung: Math.floor((code % 588) / 28), jong: code % 28 };
  }

  function compose(cho, jung, jong) {
    return String.fromCharCode(HANGUL_BASE + cho * 588 + jung * 28 + jong);
  }

  // 화면에 보일 문자열을 한 타씩 순서대로 만든다
  function buildFrames(text) {
    var frames = [];
    var done = "";
    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      var s = decompose(ch);
      if (!s) {
        done += ch;
        frames.push(done);
        continue;
      }

      // 1) 첫 자음: 앞 글자가 한글이면 받침으로 먼저 붙는다
      var prev = decompose(done.charAt(done.length - 1));
      var base = done.slice(0, -1);
      var combined = prev && prev.jong ? JONG_COMBINE[prev.jong + "," + s.cho] : undefined;
      if (prev && !prev.jong && CHO_TO_JONG[s.cho] !== undefined) {
        frames.push(base + compose(prev.cho, prev.jung, CHO_TO_JONG[s.cho]));
      } else if (combined !== undefined) {
        frames.push(base + compose(prev.cho, prev.jung, combined));
      } else {
        frames.push(done + CHO.charAt(s.cho));
      }

      // 2) 모음 (겹모음은 앞 모음부터)
      if (JUNG_FIRST[s.jung] !== undefined) {
        frames.push(done + compose(s.cho, JUNG_FIRST[s.jung], 0));
      }
      frames.push(done + compose(s.cho, s.jung, 0));

      // 3) 받침 (겹받침은 앞 받침부터)
      if (s.jong) {
        if (JONG_FIRST[s.jong] !== undefined) {
          frames.push(done + compose(s.cho, s.jung, JONG_FIRST[s.jong]));
        }
        frames.push(done + compose(s.cho, s.jung, s.jong));
      }
      done += ch;
    }
    return frames;
  }

  // 사람이 치는 것처럼 간격을 흔든다. 띄어쓰기 뒤에는 조금 더 쉰다
  function delayAfter(frame) {
    if (frame.charAt(frame.length - 1) === " ") return 60 + Math.random() * 35;
    if (Math.random() < 0.05) return 90 + Math.random() * 40;
    return 19 + Math.random() * 22;
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  // <p><span class="intro_label">문구</span></p> 를 타이핑용 구조로 바꾼다
  //   type_box   (inline-grid: 복제본과 실제 글자를 같은 칸에 겹친다)
  //     type_ghost  보이지 않는 최종 문구 — 자리만 잡는다
  //     type_live   실제로 쳐지는 문구 + 커서
  //   sr_only    스크린리더용 전체 문구
  function setup(p, container) {
    var label = p.querySelector(".intro_label");
    if (!label) return null;
    var text = label.textContent;

    var box = el("span", "type_box");
    var ghost = el("span", "type_ghost");
    var ghostLabel = el("span", "intro_label", text);
    ghostLabel.appendChild(el("span", "type_caret"));
    ghost.appendChild(ghostLabel);
    ghost.setAttribute("aria-hidden", "true");

    var live = el("span", "type_live");
    var liveLabel = el("span", "intro_label");
    var textNode = el("span", "type_text");
    liveLabel.appendChild(textNode);
    liveLabel.appendChild(el("span", "type_caret"));
    live.appendChild(liveLabel);
    live.setAttribute("aria-hidden", "true");

    box.appendChild(ghost);
    box.appendChild(live);
    p.textContent = "";
    p.appendChild(box);
    p.appendChild(el("span", "sr_only", text));

    return {
      container: container, // .intro_content_box — 다 치면 is-typed를 붙여 부제를 페이드인한다
      box: box,
      textNode: textNode,
      text: text,
      frames: buildFrames(text),
      timer: 0,
      state: "idle"
    };
  }

  function type(t) {
    clearTimeout(t.timer);
    t.state = "typing";
    t.textNode.textContent = "";
    t.box.classList.add("is-typing");
    t.container.classList.remove("is-typed");
    var i = 0;
    function step() {
      var frame = t.frames[i++];
      t.textNode.textContent = frame;
      if (i >= t.frames.length) {
        t.state = "done";
        t.box.classList.remove("is-typing");
        t.container.classList.add("is-typed");
        return;
      }
      t.timer = setTimeout(step, delayAfter(frame));
    }
    t.timer = setTimeout(step, START_DELAY_MS);
  }

  function reset(t) {
    clearTimeout(t.timer);
    t.state = "idle";
    t.textNode.textContent = "";
    t.box.classList.remove("is-typing");
    t.container.classList.remove("is-typed");
  }

  function showAll(t) {
    clearTimeout(t.timer);
    t.state = "done";
    t.textNode.textContent = t.text;
    t.box.classList.remove("is-typing");
    t.container.classList.add("is-typed");
  }

  function init() {
    var root = document.documentElement;
    try {
      var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      var bySection = new Map();

      document.querySelectorAll(".intro_content_box").forEach(function (contentBox) {
        var p = contentBox.querySelector(".intro_content_title");
        var section = contentBox.previousElementSibling;
        var t = p && setup(p, contentBox);
        if (!t) return;
        if (reduceMotion || !("IntersectionObserver" in window) || !section) {
          showAll(t);
          return;
        }
        bySection.set(section, t);
      });
      // 타이핑이 준비된 경우에만 부제를 숨겼다가 다 치면 페이드인한다 (스크립트가 실패하면 부제는 그냥 보인다)
      root.classList.add("typing-on");

      if (!bySection.size) return;

      var observer = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            var t = bySection.get(entry.target);
            if (!t) return;
            if (entry.intersectionRatio >= VISIBLE_RATIO) {
              if (t.state === "idle") type(t);
            } else if (!entry.isIntersecting || entry.intersectionRatio < GONE_RATIO) {
              reset(t); // 화면에서 벗어나면 지워 두고, 돌아오면 다시 친다
            }
          });
        },
        { threshold: [0, GONE_RATIO, VISIBLE_RATIO] }
      );
      bySection.forEach(function (t, section) {
        observer.observe(section);
      });
    } finally {
      // 준비가 끝나면(실패해도) 숨겨 둔 제목을 보이게 한다
      root.classList.remove("typing-pending");
    }
  }

  init();
})();
