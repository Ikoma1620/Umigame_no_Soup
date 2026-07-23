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
        else if (correctness === "いいえ") tdC.classList.add("wrong");　//neither
        else if (correctness === "どちらでもない") tdC.classList.add("neither")
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



// ----------------------------------------------------
// ✅ Firestore設定
// ----------------------------------------------------
const FIREBASE_PROJECT_ID = "umigame-no-soup-f539b";
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;

// Firestoreの型付きフィールド({stringValue:"..."}等)をプレーンな値に変換
function decodeFirestoreFields(fields) {
  const obj = {};
  if (!fields) return obj;
  Object.keys(fields).forEach(key => {
    const v = fields[key];
    if (v.stringValue !== undefined) obj[key] = v.stringValue;
    else if (v.integerValue !== undefined) obj[key] = Number(v.integerValue);
    else if (v.doubleValue !== undefined) obj[key] = v.doubleValue;
    else if (v.booleanValue !== undefined) obj[key] = v.booleanValue;
    else if (v.timestampValue !== undefined) obj[key] = v.timestampValue;
    else if (v.nullValue !== undefined) obj[key] = null;
    else obj[key] = null;
  });
  return obj;
}

// コレクション内の全ドキュメントを取得してデコード済み配列で返す
async function fetchCollection(collectionName) {
  const res = await fetch(`${FIRESTORE_BASE_URL}/${collectionName}`);
  if (!res.ok) {
    throw new Error(`Firestore取得エラー(${collectionName}): ${res.status}`);
  }
  const json = await res.json();
  if (!json.documents) return [];
  return json.documents.map(doc => decodeFirestoreFields(doc.fields));
}

// 単一ドキュメント(config/main)を取得
async function fetchConfigDoc() {
  const res = await fetch(`${FIRESTORE_BASE_URL}/config/main`);
  if (!res.ok) {
    // configがまだ無い場合は空扱いにする
    console.warn(`config/main の取得に失敗しました: ${res.status}`);
    return {};
  }
  const json = await res.json();
  return decodeFirestoreFields(json.fields);
}

async function loadData() {
  console.log(1);
  try {
    // 1. fetchCollection("texts") を追加して一緒に取得する
    const [configData, questions, answers, texts] = await Promise.all([
      fetchConfigDoc(),
      fetchCollection("questions"),
      fetchCollection("answers"),
      fetchCollection("texts") // 追加
    ]);

    // 元のスプレッドシート行配列形式に合わせて組み立てる
    const rows = [];

    questions.forEach(q => {
      rows.push([
        q.timestamp || "",   // 0
        "質問する",           // 1
        q.content || "",     // 2
        "",                  // 3
        "",                  // 4
        q.isCorrect || "",   // 5
        q.relevance || "",   // 6
        ""                   // 7
      ]);
    });

    answers.forEach(a => {
      rows.push([
        a.timestamp || "",   // 0
        "解答する",           // 1
        "",                  // 2
        a.nickname || "",    // 3
        "",                  // 4
        "",                  // 5
        "",                  // 6
        a.isCorrect || ""    // 7
      ]);
    });

    const allDataWithHeader = [
      ["timestamp", "type", "content", "nickname", "", "isCorrect", "relevance", "isCorrect"],
      ...rows
    ];

    // 2. textsの中から表示したい文字（content）を取り出すロジック
    let textQuestion = configData.mainQuestion || ""; 
    
    if (texts && texts.length > 0) {
      // 例として、texts配列の「最後のレコード（最新）」の content を取得する場合
      const latestText = texts[texts.length - 1];
      if (latestText && latestText.content) {
        textQuestion = latestText.content;
      }
    }

    const result = {
      data: allDataWithHeader,
      secret: configData.secretKey || "",
      question: textQuestion, // 3. 抽出した textQuestion をセット
      forcedDisplay: configData.forcedDisplay || ""
    };

    renderTable(result);

  } catch (error) {
    console.error("データの読み込みに失敗しました:", error);
  }
}
loadData();
setInterval(loadData, 10000);

const stateMap = {
  'はい':'state-correct',
  'どちらでもない':'state-neutral',
  'いいえ':'state-wrong',
  'いい質問':'state-good',
  '関係ない':'state-bad'
};

function initCustomSelect(containerId, onChange){
  const container = document.getElementById(containerId);
  const trigger = container.querySelector('.custom-select-trigger');
  const options = container.querySelectorAll('.custom-select-options li');
  const hiddenSelect = container.querySelector('select');

  function setValue(value, label){
    // トリガーのテキストを更新
    trigger.textContent = label;
    trigger.dataset.value = value;

    // 既存のstate-*クラスを削除して即座に切り替え
    trigger.classList.forEach(c=>{
      if(c.startsWith('state-')) trigger.classList.remove(c);
    });
    const stateClass = stateMap[value];
    if(stateClass) trigger.classList.add(stateClass);

    // 選択中マークの更新
    options.forEach(li=> li.classList.toggle('selected', li.dataset.value === value));

    // 隠しselectにも反映(既存ロジックとの互換用)
    hiddenSelect.value = value;

    if(onChange) onChange(value);
  }

  // トリガークリックで開閉
  trigger.addEventListener('click', (e)=>{
    e.stopPropagation();
    // 他の開いてるドロップダウンを閉じる
    document.querySelectorAll('.custom-select.open').forEach(el=>{
      if(el !== container) el.classList.remove('open');
    });
    container.classList.toggle('open');
  });

  // 項目クリックで選択
  options.forEach(li=>{
    li.addEventListener('click', (e)=>{
      e.stopPropagation();
      setValue(li.dataset.value, li.textContent);
      container.classList.remove('open');
    });
  });

  // 初期状態を反映
  setValue(hiddenSelect.value, trigger.textContent);
}

// 外側クリックで全部閉じる
document.addEventListener('click', ()=>{
  document.querySelectorAll('.custom-select.open').forEach(el=> el.classList.remove('open'));
});

// 初期化(必要に応じてフィルタ処理をonChangeに渡す)
initCustomSelect('correctnessSelect', (value)=>{
  // 例: ここでフィルタ処理を呼ぶ
  // applyFilters();
});
initCustomSelect('qualitySelect', (value)=>{
  // applyFilters();
});