async function getQAData() {
  try {
    const response = await fetch('./data.csv');
    if (!response.ok) throw new Error('CSVの取得に失敗しました');
    const csvText = await response.text();

    const parsed = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true
    });

    const grouped = {};
    parsed.data.forEach(row => {
      const type = row['タイプ'];
      const question = row['質問文'];  // 修正: 質問 → 質問文
      const answer = row['回答文'];    // 修正: 回答 → 回答文

      if (!type || !question) return;

      if (!grouped[type]) grouped[type] = [];
      grouped[type].push({ question, answer });
    });

    return grouped;

  } catch (error) {
    console.error('エラー:', error);
    return {};
  }
}

// 実行: CSV取得 → グループ化 → 表示
getQAData().then(displayQAs);

function setRichContent(el, raw) {
  if (raw.includes("${")) {
    el.innerHTML = raw.replace(/\$\{([\s\S]*?)\}/g, "$1");
  } else {
    el.textContent = raw;
  }
}

// type/idx から安全なDOM ID用文字列を作る
// 空白だけでなく、CSS/HTML的に安全でない文字全般をアンダースコアに置換
function toSafeId(str) {
  return String(str).replace(/[^a-zA-Z0-9_-]/g, "_");
}

function displayQAs(groupedData) {
  const content = document.getElementById("content");
  content.innerHTML = "";
  content.style.textAlign = ""; // 前回描画時のインラインスタイルをリセット

  // groupedDataが空、またはCSV取得に失敗していた場合のフォールバック表示
  if (!groupedData || Object.keys(groupedData).length === 0) {
    const msg = document.createElement("p");
    msg.textContent = "データを読み込めませんでした。";
    content.appendChild(msg);
    return;
  }

  for (const type in groupedData) {
    const section = document.createElement("section");

    const h2 = document.createElement("h2");
    h2.textContent = type;
    section.appendChild(h2);

    const list = document.createElement("div");
    list.className = "qa-list";

    groupedData[type].forEach((item, idx) => {
      const qId = toSafeId(`ans-${type}-${idx}`);

      const qDiv = document.createElement("div");
      qDiv.className = "question";
      qDiv.setAttribute("role", "button");
      qDiv.setAttribute("tabindex", "0");
      qDiv.setAttribute("aria-expanded", "false");
      qDiv.setAttribute("aria-controls", qId);

      const qText = document.createElement("span");
      qText.className = "qtext";
      setRichContent(qText, item.question);

      const chevron = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      chevron.setAttribute("class", "chevron");
      chevron.setAttribute("viewBox", "0 0 24 24");
      chevron.setAttribute("fill", "none");
      chevron.innerHTML = '<path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>';

      qDiv.appendChild(qText);
      qDiv.appendChild(chevron);

      const wrap = document.createElement("div");
      wrap.className = "answer-wrap";
      wrap.id = qId;

      const inner = document.createElement("div");
      inner.className = "answer-inner";

      const aDiv = document.createElement("div");
      aDiv.className = "answer";
      setRichContent(aDiv, item.answer);

      inner.appendChild(aDiv);
      wrap.appendChild(inner);

      const toggle = () => {
        const isOpen = wrap.classList.toggle("open");
        qDiv.setAttribute("aria-expanded", isOpen ? "true" : "false");
      };

      qDiv.addEventListener("click", toggle);
      qDiv.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggle();
        }
      });

      list.appendChild(qDiv);
      list.appendChild(wrap);
    });

    section.appendChild(list);
    content.appendChild(section);
  }
}