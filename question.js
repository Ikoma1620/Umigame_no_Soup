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
  if (!raw) {
    el.textContent = "";
    return;
  }
  
  // 1. 独自記法 ${...} の展開
  const processed = raw.replace(/\${([\s\S]*?)}/g, "$1");

  // 2. サニタイズ (XSS対策)
  if (window.DOMPurify) {
    // DOMPurifyが読み込まれている場合: 安全なHTMLとして挿入
    el.innerHTML = DOMPurify.sanitize(processed);
  } else {
    // フォールバック: ライブラリがない場合はテキストとして挿入
    // (HTMLタグは表示されてしまうが、スクリプト実行は防げる)
    el.textContent = processed;
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
  content.setAttribute("aria-busy", "false");

  // groupedDataが空、またはCSV取得に失敗していた場合のフォールバック表示
  if (!groupedData || Object.keys(groupedData).length === 0) {
    const msg = document.createElement("p");
    msg.className = "error-state";
    msg.textContent = "データを読み込めませんでした。";
    content.appendChild(msg);
    return;
  }

  for (const type in groupedData) {
    const section = document.createElement("section");
    section.dataset.category = type;

    const h2 = document.createElement("h2");
    const sectionId = toSafeId(`section-${type}`);
    h2.id = sectionId;
    section.setAttribute("aria-labelledby", sectionId);
    h2.textContent = type;
    section.appendChild(h2);

    const list = document.createElement("div");
    list.className = "qa-list";

    groupedData[type].forEach((item, idx) => {
      const qId = toSafeId(`ans-${type}-${idx}`);
      const qButtonId = toSafeId(`question-${type}-${idx}`);

      const qDiv = document.createElement("button");
      qDiv.className = "question";
      qDiv.type = "button";
      qDiv.id = qButtonId;
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
      wrap.setAttribute("role", "region");
      wrap.setAttribute("aria-labelledby", qButtonId);
      wrap.setAttribute("aria-hidden", "true");

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
        wrap.setAttribute("aria-hidden", isOpen ? "false" : "true");
        updateQaStatus();
      };

      qDiv.addEventListener("click", toggle);

      list.appendChild(qDiv);
      list.appendChild(wrap);
    });

    section.appendChild(list);
    content.appendChild(section);
  }

  buildCategoryNav();
  updateQaStatus();
}

function buildCategoryNav() {
  const nav = document.getElementById("qaCategoryNav");
  if (!nav) return;
  nav.replaceChildren();

  document.querySelectorAll("#content section").forEach((section) => {
    const heading = section.querySelector("h2");
    if (!heading) return;
    const link = document.createElement("a");
    link.href = `#${heading.id}`;
    link.textContent = heading.textContent;
    nav.appendChild(link);
  });
}

function applyQaSearch(rawValue) {
  const term = rawValue.trim().toLocaleLowerCase();

  document.querySelectorAll("#content section").forEach((section) => {
    let visibleCount = 0;
    section.querySelectorAll(".question").forEach((question) => {
      const answer = document.getElementById(question.getAttribute("aria-controls"));
      const haystack = `${question.textContent} ${answer?.textContent || ""}`.toLocaleLowerCase();
      const matched = !term || haystack.includes(term);
      question.classList.toggle("qa-hidden", !matched);
      if (matched) {
        visibleCount += 1;
      } else {
        question.setAttribute("aria-expanded", "false");
        answer?.classList.remove("open");
        answer?.setAttribute("aria-hidden", "true");
      }
    });
    section.classList.toggle("qa-hidden", visibleCount === 0);
  });

  updateQaStatus();
}

function setAllQuestions(open) {
  document.querySelectorAll(".question").forEach((question) => {
    if (question.classList.contains("qa-hidden")) return;
    const answer = document.getElementById(question.getAttribute("aria-controls"));
    if (!answer) return;
    question.setAttribute("aria-expanded", open ? "true" : "false");
    answer.classList.toggle("open", open);
    answer.setAttribute("aria-hidden", open ? "false" : "true");
  });
  updateQaStatus();
}

function updateQaStatus() {
  const status = document.getElementById("qaStatus");
  if (!status) return;
  const questions = [...document.querySelectorAll(".question")];
  const visibleQuestions = questions.filter((question) => !question.classList.contains("qa-hidden"));
  const opened = visibleQuestions.filter((question) => question.getAttribute("aria-expanded") === "true").length;
  status.textContent = visibleQuestions.length === questions.length
    ? `${questions.length}件のQ&A｜開いている項目 ${opened}件`
    : `${visibleQuestions.length}件表示（全${questions.length}件）｜開いている項目 ${opened}件`;
}

document.getElementById("expandAllButton")?.addEventListener("click", () => setAllQuestions(true));
document.getElementById("collapseAllButton")?.addEventListener("click", () => setAllQuestions(false));
document.getElementById("qaSearch")?.addEventListener("input", (event) => applyQaSearch(event.target.value));
document.getElementById("clearQaSearch")?.addEventListener("click", () => {
  const search = document.getElementById("qaSearch");
  if (!search) return;
  search.value = "";
  applyQaSearch("");
  search.focus();
});
