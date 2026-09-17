/* ==================================================================
   オープニング演出 (intro.js)
   #introOverlay が存在するページでのみ動作する
   ================================================================== */

(function () {
    "use strict";

    var overlay = document.getElementById("introOverlay");
    if (!overlay) return;

    var bubbleLayer = document.getElementById("introBubbles");
    var startBtn = document.getElementById("introStartButton");
    var skipBtn = document.getElementById("introSkipButton");

    var BUBBLE_INTERVAL_MS = 380;
    var bubbleTimer = null;

    /* ------------------------------
       泡を1つ生成して浮かび上がらせる
    ------------------------------ */
    function spawnBubble() {
        if (!bubbleLayer) return;

        var bubble = document.createElement("span");
        bubble.className = "intro-bubble";

        var size = 4 + Math.random() * 9;
        bubble.style.width = size + "px";
        bubble.style.height = size + "px";
        bubble.style.left = Math.random() * 100 + "%";
        bubble.style.animationDuration = (6 + Math.random() * 6) + "s";
        bubble.style.animationDelay = (Math.random() * 1.5) + "s";

        bubbleLayer.appendChild(bubble);

        // アニメーション終了後にDOMから削除（蓄積を防ぐ）
        window.setTimeout(function () {
            if (bubble.parentNode) bubble.parentNode.removeChild(bubble);
        }, 15000);
    }

    function startBubbles() {
        if (bubbleTimer) return;
        for (var i = 0; i < 12; i++) spawnBubble(); // 初期投入
        bubbleTimer = window.setInterval(spawnBubble, BUBBLE_INTERVAL_MS);
    }

    function stopBubbles() {
        if (bubbleTimer) {
            window.clearInterval(bubbleTimer);
            bubbleTimer = null;
        }
    }

    /* ------------------------------
       演出を終えてサイト本体を見せる
    ------------------------------ */
    function dismissIntro() {
        if (overlay.classList.contains("is-leaving")) return;

        overlay.classList.add("is-leaving");
        overlay.setAttribute("aria-hidden", "true");
        stopBubbles();

        window.setTimeout(function () {
            overlay.classList.add("is-hidden");
            document.body.classList.remove("intro-active");
        }, 950); // CSS側の opacity transition (.9s) に合わせる
    }

    if (startBtn) startBtn.addEventListener("click", dismissIntro);
    if (skipBtn) skipBtn.addEventListener("click", dismissIntro);

    // Escキーでもスキップできるように
    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") dismissIntro();
    });

    document.body.classList.add("intro-active");
    startBubbles();

    // 演出を待たずに開始ボタンへフォーカスを移し、キーボードでもすぐ操作できるようにする
    if (startBtn) startBtn.focus();
})();
