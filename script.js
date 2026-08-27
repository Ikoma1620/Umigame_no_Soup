const FIREBASE_PROJECT_ID = "umigame-no-soup-f539b";
const FIRESTORE_BASE_URL = `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/databases/(default)/documents`;
const POLLING_INTERVAL_MS = 10_000;

const state = { data: [], secretKey: "", lastRenderKey: "", lastProcessedUrl: "", isLoading: false };
const $ = (selector) => document.querySelector(selector);

function setOverlay(id, isOpen) {
  const overlay = document.getElementById(id);
  if (overlay) overlay.style.display = isOpen ? "flex" : "none";
}

function openQaOverlay() { setOverlay("qaOverlay", true); }
function closeQaOverlay() { setOverlay("qaOverlay", false); }
function openAutoOverlay() { setOverlay("autoOverlay", true); }
function closeAutoOverlay() { setOverlay("autoOverlay", false); }

function createBadge(value, type) {
  const badge = document.createElement("span");
  const className = type === "correctness"
    ? { はい: "badge-yes", いいえ: "badge-no" }[value] || "badge-neutral"
    : { "いい質問": "badge-good", 関係ない: "badge-bad" }[value] || "badge-neutral";
  badge.className = `badge ${className}`;
  badge.textContent = value || "未設定";
  return badge;
}

function createTableHeader() {
  const thead = document.createElement("thead");
  const row = document.createElement("tr");
  ["質問文", "正誤", "関連度"].forEach((label) => {
    const th = document.createElement("th");
    th.textContent = label;
    row.appendChild(th);
  });
  thead.appendChild(row);
  return thead;
}

function applyFilter() {
  const table = document.getElementById("output");
  const correctnessFilter = $("#filterCorrectness").value;
  const qualityFilter = $("#filterQuality").value;
  const tbody = document.createElement("tbody");

  state.data.slice(1).forEach((row) => {
    const [question, correctness, quality] = [row[2], row[5], row[6]];
    if (!question || (correctnessFilter !== "all" && correctness !== correctnessFilter) || (qualityFilter !== "all" && quality !== qualityFilter)) return;

    const tr = document.createElement("tr");
    const questionCell = document.createElement("td");
    questionCell.textContent = question;
    tr.appendChild(questionCell);

    const correctnessCell = document.createElement("td");
    correctnessCell.className = { はい: "correct", いいえ: "wrong", どちらでもない: "neither" }[correctness] || "";
    correctnessCell.appendChild(createBadge(correctness, "correctness"));
    tr.appendChild(correctnessCell);

    const qualityCell = document.createElement("td");
    qualityCell.className = { "いい質問": "good", 関係ない: "bad" }[quality] || "";
    qualityCell.appendChild(createBadge(quality, "quality"));
    tr.appendChild(qualityCell);
    tbody.appendChild(tr);
  });

  table.replaceChildren(createTableHeader(), tbody);
}

function searchByNickname() {
  const nickname = $("#nicknameInput").value.trim();
  const results = $("#nicknameResults");
  results.replaceChildren();

  if (!nickname) {
    results.textContent = "ニックネームを入力してください。";
    return;
  }

  const rows = state.data.slice(1);
  const isSecretSearch = nickname === state.secretKey;
  const matchedRows = isSecretSearch ? rows.filter((row) => row[7] === "正解") : rows.filter((row) => row[3] === nickname);

  if (matchedRows.length === 0) {
    results.textContent = isSecretSearch ? "正解者はいません。" : "該当する回答が見つかりません。";
    return;
  }

  const list = document.createElement("ul");
  matchedRows.forEach((row) => {
    const item = document.createElement("li");
    item.textContent = isSecretSearch ? row[3] : `質問: ${row[2]} / 解答結果: ${row[7]}`;
    list.appendChild(item);
  });
  results.appendChild(list);
}

function updateMarquee() {
  const correctNicknames = state.data.slice(1).filter((row) => row[7] === "正解").map((row) => row[3]);
  $("#marqueeText").textContent = `正解者: ${correctNicknames.join(" ／ ")}`;
}

function renderTable(payload) {
  state.data = payload.data || [];
  state.secretKey = payload.secret || "";
  $("#mainQuestion").textContent = payload.question || "";

  const renderKey = JSON.stringify({ data: state.data, question: payload.question || "" });
  if (renderKey !== state.lastRenderKey) {
    applyFilter();
    updateMarquee();
    state.lastRenderKey = renderKey;
  }
  updateAutoOverlay(payload.forcedDisplay || "");
}

function updateAutoOverlay(forcedDisplay) {
  const iframe = $("#targetIframe");
  if (!/^https?:\/\//.test(forcedDisplay)) {
    closeAutoOverlay();
    iframe.src = "";
    state.lastProcessedUrl = "";
    return;
  }
  if (state.lastProcessedUrl === forcedDisplay) return;
  state.lastProcessedUrl = forcedDisplay;
  iframe.src = forcedDisplay;
  openAutoOverlay();
}

function decodeFirestoreFields(fields = {}) {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => {
    if (value.stringValue !== undefined) return [key, value.stringValue];
    if (value.integerValue !== undefined) return [key, Number(value.integerValue)];
    if (value.doubleValue !== undefined) return [key, value.doubleValue];
    if (value.booleanValue !== undefined) return [key, value.booleanValue];
    if (value.timestampValue !== undefined) return [key, value.timestampValue];
    return [key, null];
  }));
}

async function fetchJson(url, fallback) {
  const response = await fetch(url);
  if (!response.ok) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Firestore取得エラー: ${response.status}`);
  }
  return response.json();
}

async function fetchCollection(collectionName) {
  const json = await fetchJson(`${FIRESTORE_BASE_URL}/${collectionName}`);
  return (json.documents || []).map(({ fields }) => decodeFirestoreFields(fields));
}

async function fetchConfigDoc() {
  // 設定が未作成でも404にならないよう、configコレクションとして取得する。
  const json = await fetchJson(`${FIRESTORE_BASE_URL}/config`, { documents: [] });
  const configDoc = (json.documents || []).find((document) => document.name.endsWith("/config/main"));
  return decodeFirestoreFields(configDoc?.fields);
}

async function loadData() {
  if (state.isLoading) return;
  state.isLoading = true;
  try {
    const [config, problemTexts, questions, answers] = await Promise.all([
      fetchConfigDoc(), fetchCollection("問題文"), fetchCollection("質問"), fetchCollection("解答")
    ]);
    const rows = [
      ...questions.map((question) => [question.timestamp || "", "質問する", question["内容"] || question.content || "", "", "", question["正誤"] || question.isCorrect || "", question["関連度"] || question.relevance || "", ""]),
      ...answers.map((answer) => [answer.timestamp || "", "解答する", "", answer["ニックネーム"] || answer.nickname || "", "", "", "", answer["正誤"] || answer.isCorrect || ""])
    ];
    const latestProblem = problemTexts.at(-1) || {};
    renderTable({
      data: [["timestamp", "type", "content", "nickname", "", "isCorrect", "relevance", "isCorrect"], ...rows],
      secret: config.secretKey || "",
      question: latestProblem["問題文"] || latestProblem.content || config.mainQuestion || "",
      forcedDisplay: config.forcedDisplay || ""
    });
  } catch (error) {
    console.error("データの読み込みに失敗しました:", error);
  } finally {
    state.isLoading = false;
  }
}

const stateMap = { はい: "state-correct", どちらでもない: "state-neutral", いいえ: "state-wrong", "いい質問": "state-good", 関係ない: "state-bad" };

function initCustomSelect(containerId) {
  const container = document.getElementById(containerId);
  const trigger = container.querySelector(".custom-select-trigger");
  const options = container.querySelectorAll(".custom-select-options li");
  const hiddenSelect = container.querySelector("select");

  const setValue = (value, label) => {
    trigger.textContent = label;
    trigger.dataset.value = value;
    trigger.className = `custom-select-trigger ${stateMap[value] || ""}`;
    options.forEach((option) => option.classList.toggle("selected", option.dataset.value === value));
    hiddenSelect.value = value;
  };

  trigger.addEventListener("click", (event) => {
    event.stopPropagation();
    document.querySelectorAll(".custom-select.open").forEach((element) => {
      if (element !== container) element.classList.remove("open");
    });
    container.classList.toggle("open");
  });
  options.forEach((option) => option.addEventListener("click", (event) => {
    event.stopPropagation();
    setValue(option.dataset.value, option.textContent);
    container.classList.remove("open");
  }));
  setValue(hiddenSelect.value, trigger.textContent);
}

$("#qaButton").addEventListener("click", openQaOverlay);
$("#closeQaButton").addEventListener("click", closeQaOverlay);
$("#closeAutoButton").addEventListener("click", closeAutoOverlay);
$("#filterButton").addEventListener("click", applyFilter);
$("#nicknameSearchButton").addEventListener("click", searchByNickname);
$("#nicknameInput").addEventListener("keydown", (event) => {
  if (event.key === "Enter") searchByNickname();
});
document.addEventListener("click", () => {
  document.querySelectorAll(".custom-select.open").forEach((element) => element.classList.remove("open"));
});

initCustomSelect("correctnessSelect");
initCustomSelect("qualitySelect");
loadData();
window.setInterval(loadData, POLLING_INTERVAL_MS);
