// ユーザー操作オーバーレイの開閉
function openQaOverlay() {
  document.getElementById("qaOverlay").style.display = "flex";
}
function closeQaOverlay() {
  document.getElementById("qaOverlay").style.display = "none";
}

// 自動制御オーバーレイの開閉
function openAutoOverlay() {
  document.getElementById("autoOverlay").style.display = "flex";
}
function closeAutoOverlay() {
  document.getElementById("autoOverlay").style.display = "none";
}

// ----------------------------------------------------
// ✅ グローバル変数の整理
// ----------------------------------------------------

let allData = [];
let secretKey = "";
let mainQuestion = "";
let lastProcessedUrl = ""; // 前回処理したURLを保持

    function renderTable(payload) {
// 共通の変数設定
  allData = payload.data;
  secretKey = payload.secret;
  mainQuestion = payload.question;
  const forcedDisplay = payload.forcedDisplay;
  
  // (省略されていた部分)
  document.getElementById("mainQuestion").textContent = mainQuestion;
      applyFilter();
      updateMarquee();

      const iframe = document.getElementById('targetIframe');

  // --- スプシ制御URLのロジック ---
  
  if (forcedDisplay && (forcedDisplay.startsWith('http://') || forcedDisplay.startsWith('https://'))) {
    // 1. URLが前回と同じかチェック (重複スキップロジック)
    if (lastProcessedUrl === forcedDisplay) {
      console.log("URLが重複しています。スキップします。");
      return; 
    }

    // 2. 新しいURLが見つかった場合の処理
    
    // 前回のURLを更新
    lastProcessedUrl = forcedDisplay; 
    
    // iframeのsrcを設定
    iframe.src = forcedDisplay;
    
    // 常時稼働オーバーレイ（qaOverlay）がもし開いていたら閉じる
    // (要件によるが、同時に表示しないなら閉じる)
    // closeQaOverlay(); 

    // 自動制御オーバーレイを開く
    openAutoOverlay();

  } else {
    // URLが空または無効な場合、自動制御オーバーレイを閉じる
    closeAutoOverlay();
    
    // 処理URLをリセット（フォームが消えたことを記憶）
    lastProcessedUrl = "";
    
    // オプション: iframeのsrcをクリア
    iframe.src = "";
  }
    }

    function applyFilter() {
      const table = document.getElementById("output");
      table.innerHTML = "";

      const filterCorrectness = document.getElementById("filterCorrectness").value;
      const filterQuality = document.getElementById("filterQuality").value;

table.innerHTML=`

<thead>

<tr>

<th style="width:65%">
質問文
</th>

<th style="width:17%">
正誤
</th>

<th style="width:18%">
関連度
</th>

</tr>

</thead>

<tbody></tbody>

`;

const tbody=table.querySelector("tbody");

      allData.forEach((row, i) => {
        if (i === 0) return;
        const question = row[2];
        const correctness = row[5];
        const quality = row[6];

        if (!question) return;
        if (filterCorrectness !== "all" && correctness !== filterCorrectness) return;
        if (filterQuality !== "all" && quality !== filterQuality) return;

        const tr = document.createElement("tr");
        const tdQ = document.createElement("td");
        tdQ.textContent = question;
        tr.appendChild(tdQ);

        const tdC = document.createElement("td");
        tdC.innerHTML=
`<span class="badge ${
correctness==="はい"
?"badge-yes"
:correctness==="いいえ"
?"badge-no"
:"badge-neutral"
}">
${correctness}
</span>`;
        if (correctness === "はい") tdC.classList.add("correct");
        else if (correctness === "いいえ") tdC.classList.add("wrong");
        tr.appendChild(tdC);

        const tdF = document.createElement("td");
        tdF.innerHTML=
`<span class="badge ${
quality==="いい質問"
?"badge-good"
:quality==="関係ない"
?"badge-bad"
:"badge-neutral"
}">
${quality}
</span>`;
        if (quality === "いい質問") tdF.classList.add("good");
        else if (quality === "関係ない") tdF.classList.add("bad");
        tr.appendChild(tdF);

        tbody.appendChild(tr);
      });
    }

    function searchByNickname() {
      const nickname = document.getElementById("nicknameInput").value.trim();
      const resultsDiv = document.getElementById("nicknameResults");
      resultsDiv.innerHTML = "";

      if (!nickname) {
        resultsDiv.textContent = "ニックネームを入力してください。";
        return;
      }

      if (nickname === secretKey) {
        const correctNicknames = allData
          .filter((row, i) => i > 0 && row[7] === "正解")
          .map(row => row[3]);
        if (correctNicknames.length === 0) {
          resultsDiv.textContent = "正解者はいません。";
        } else {
          const ul = document.createElement("ul");
          correctNicknames.forEach(n => {
            const li = document.createElement("li");
            li.textContent = n;
            ul.appendChild(li);
          });
          resultsDiv.appendChild(ul);
        }
        return;
      }

      const matches = allData.filter((row, i) => i > 0 && row[3] === nickname);
      if (matches.length === 0) {
        resultsDiv.textContent = "該当する回答が見つかりません。";
        return;
      }

      const ul = document.createElement("ul");
      matches.forEach(row => {
        const li = document.createElement("li");
        li.textContent = `質問: ${row[2]} / 解答結果: ${row[7]}`;
        ul.appendChild(li);
      });
      resultsDiv.appendChild(ul);
    }

    function updateMarquee() {
      const correctNicknames = allData
        .filter((row, i) => i > 0 && row[7] === "正解")
        .map(row => row[3]);
      document.getElementById("marqueeText").textContent =
        "正解者: " + correctNicknames.join(" ／ ");
    }

// 1. 先ほどデプロイしたウェブアプリのURLとAPIキーを定義
const GAS_URL = "https://script.google.com/macros/s/AKfycbzr-x6-9sGpMb6Hi3PHh2BZTH7MQg2m-7FAgQPWBtkwx1Z4mvk5xBs-RVi-QnSiqa3EdQ/exec"; // ★あなたのURLに書き換え
const API_KEY = "my_super_secret_token_123";

async function loadData() {
  try {
    const response = await fetch(`${GAS_URL}?key=${API_KEY}`);
    
    if (!response.ok) {
      throw new Error(`HTTPエラー status: ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.error) {
      console.error("GAS側エラー:", result.error);
      return;
    }

    // 成功したらテーブルを描画する関数を実行
    renderTable(result);

  } catch (error) {
    console.error("データの読み込みに失敗しました:", error);
  }
}

    

    loadData();
    setInterval(loadData, 10000);
