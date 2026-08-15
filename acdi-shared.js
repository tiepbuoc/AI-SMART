// acdi-shared.js
// Lõi dùng chung cho hệ thống ACDI Check: ngân hàng câu hỏi mặc định (dự phòng),
// soạn đề bằng AI (có cache theo Firestore để tối ưu chi phí), công thức tính điểm ACDI cố định,
// mô hình 4 mức độ, và các hàm đọc/ghi Firestore.
//
// ACDI Check ĐỘC LẬP với AI SMART Chatbot / Learning Passport / tiện ích Chrome: không dùng
// chung lịch sử hội thoại — nhưng DÙNG CHUNG cấu hình API (endpoint/apiKey/model) với chatbot,
// thông qua getApiConfig() trong auth-web.js.
//
// KIẾN TRÚC CHẤM ĐIỂM (đã sửa lại — xem lịch sử: nhóm "idea" từng luôn ra điểm rất cao do AI
// đôi khi soạn câu hỏi lệch chiều "reverse" mà không tự phát hiện được lỗi đó):
//   (a) soạn đề (25 câu Likert + 5 tình huống tự luận) — AI soạn 1 LẦN, có cache theo tiêu chí
//       (cấp học/khối lớp/môn học) để không phải gọi AI lại mỗi lần có người trùng tiêu chí.
//       AI PHẢI tự soạn kèm "đáp án" (rubric: keyPoints + riskKeywords) cho từng câu tự luận
//       NGAY LÚC SOẠN ĐỀ — đây là "chìa khoá chấm điểm" được lưu cùng đề trong cache.
//   (b) CHẤM ĐIỂM (cả bảng hỏi lẫn tình huống) hoàn toàn bằng CÔNG THỨC CỐ ĐỊNH trong JavaScript
//       (mục 2 và mục 3 bên dưới), dựa trên rubric AI đã soạn sẵn ở bước (a) — KHÔNG gọi AI lúc
//       học sinh nộp bài để chấm điểm, nên điểm số hoàn toàn nhất quán, có thể kiểm tra lại được.
//   (c) SAU KHI đã có điểm số cố định (dimensionScores, acdiScore, level), gọi AI ĐÚNG 1 LẦN
//       kèm theo đề + rubric đáp án + câu trả lời của học sinh + điểm hệ thống đã chấm, để AI
//       viết NHẬN XÉT / LỜI KHUYÊN cá nhân hoá (không được thay đổi điểm số) — xem generateFeedbackWithAI().
//       Nếu bước này lỗi, hệ thống dùng buildRecommendation() (thuần công thức) làm phương án dự phòng.

import { db } from "./firebase-config.js";
import {
  collection, addDoc, getDocs, getDoc, doc, setDoc, query, orderBy, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getApiConfig } from "./auth-web.js";
import { callAiApi } from "./smart-shared.js";

// ============ 0. THANG LIKERT DÙNG CHUNG ============
export const LIKERT_OPTIONS = [
  { value: 1, label: "Hoàn toàn không đúng" },
  { value: 2, label: "Phần lớn không đúng" },
  { value: 3, label: "Đúng một phần" },
  { value: 4, label: "Phần lớn đúng" },
  { value: 5, label: "Hoàn toàn đúng" },
];

// 5 khoá nhóm chỉ báo CỐ ĐỊNH — AI soạn đề PHẢI dùng đúng 5 khoá này, theo đúng ý nghĩa mô tả,
// để công thức chấm điểm (dựa theo "key") luôn áp dụng được, bất kể nội dung câu hỏi cụ thể
// do AI soạn ra khác nhau giữa các bộ đề.
export const GROUP_DEFS = [
  { key: "start", title: "Phụ thuộc khi bắt đầu nhiệm vụ", desc: "Mức độ cần AI để xác định cách làm hoặc khởi động một nhiệm vụ.", reverse: false },
  { key: "idea", title: "Phụ thuộc về ý tưởng", desc: "Khả năng tự hình thành ý tưởng, dàn ý hoặc phương án giải quyết.", reverse: false },
  { key: "process", title: "Phụ thuộc trong xử lí nhiệm vụ", desc: "Mức độ giao cho AI thực hiện phân tích, lập luận hoặc hoàn thành sản phẩm.", reverse: false },
  { key: "trust", title: "Phụ thuộc vào kết quả của AI", desc: "Mức độ tin tưởng và chấp nhận câu trả lời AI mà không kiểm tra.", reverse: false },
  { key: "independence", title: "Khả năng hoạt động khi không có AI", desc: "Khả năng ghi nhớ, giải thích, vận dụng và tự hoàn thành nhiệm vụ khi AI không còn hỗ trợ.", reverse: true },
];

// ============ 1. BỘ ĐỀ MẶC ĐỊNH (dự phòng khi AI lỗi / chưa cấu hình được API) ============
export const DEFAULT_ACDI_GROUPS = [
  {
    key: "start", title: GROUP_DEFS[0].title, desc: GROUP_DEFS[0].desc,
    questions: [
      { id: "g1q1", text: "Tôi thường hỏi AI ngay khi nhận được một bài tập khó.", reverse: false },
      { id: "g1q2", text: "Tôi khó bắt đầu làm bài nếu không có AI gợi ý.", reverse: false },
      { id: "g1q3", text: "Tôi thường chờ AI đưa ra hướng giải quyết trước khi tự nghĩ.", reverse: false },
      { id: "g1q4", text: "Tôi cảm thấy lo lắng nếu phải bắt đầu một nhiệm vụ mà không có AI hỗ trợ.", reverse: false },
      { id: "g1q5", text: "Tôi ít khi tự đọc kỹ đề bài trước khi mở công cụ AI.", reverse: false },
    ],
  },
  {
    key: "idea", title: GROUP_DEFS[1].title, desc: GROUP_DEFS[1].desc,
    questions: [
      { id: "g2q1", text: "Tôi thường nhờ AI nghĩ ý tưởng thay mình.", reverse: false },
      { id: "g2q2", text: "Tôi khó tự lập dàn ý nếu không có AI.", reverse: false },
      { id: "g2q3", text: "Tôi thường chọn ý tưởng của AI mà không phát triển ý tưởng riêng.", reverse: false },
      { id: "g2q4", text: "Tôi hiếm khi đưa ra ý tưởng của riêng mình trước khi hỏi AI.", reverse: false },
      { id: "g2q5", text: "Tôi thấy khó nghĩ ra hướng giải quyết mới nếu không tham khảo AI trước.", reverse: false },
    ],
  },
  {
    key: "process", title: GROUP_DEFS[2].title, desc: GROUP_DEFS[2].desc,
    questions: [
      { id: "g3q1", text: "Tôi thường nhờ AI làm phần khó nhất của bài tập.", reverse: false },
      { id: "g3q2", text: "Tôi sử dụng câu trả lời của AI ngay cả khi chưa hiểu rõ.", reverse: false },
      { id: "g3q3", text: "Tôi ít tự tìm cách giải khác sau khi AI đã đưa ra đáp án.", reverse: false },
      { id: "g3q4", text: "Tôi thường để AI hoàn thành phần lớn bài làm rồi chỉ chỉnh sửa lại.", reverse: false },
      { id: "g3q5", text: "Tôi hiếm khi tự phân tích vấn đề trước khi để AI xử lí.", reverse: false },
    ],
  },
  {
    key: "trust", title: GROUP_DEFS[3].title, desc: GROUP_DEFS[3].desc,
    questions: [
      { id: "g4q1", text: "Tôi thường cho rằng câu trả lời của AI là đúng.", reverse: false },
      { id: "g4q2", text: "Tôi ít kiểm tra thông tin AI bằng sách hoặc nguồn khác.", reverse: false },
      { id: "g4q3", text: "Tôi khó phát hiện điểm chưa hợp lí trong câu trả lời của AI.", reverse: false },
      { id: "g4q4", text: "Tôi thường nộp bài ngay sau khi nhận được câu trả lời từ AI mà không xem lại.", reverse: false },
      { id: "g4q5", text: "Tôi tin tưởng AI hơn là tự kiểm tra lại bằng kiến thức của mình.", reverse: false },
    ],
  },
  {
    key: "independence", title: GROUP_DEFS[4].title, desc: GROUP_DEFS[4].desc,
    questions: [
      { id: "g5q1", text: "Tôi có thể giải thích lại nội dung do AI hỗ trợ bằng lời của mình.", reverse: true },
      { id: "g5q2", text: "Tôi có thể làm một bài tương tự mà không cần AI.", reverse: true },
      { id: "g5q3", text: "Sau khi dùng AI, tôi vẫn nhớ được cách giải quyết vấn đề.", reverse: true },
      { id: "g5q4", text: "Tôi vẫn hoàn thành được nhiệm vụ nếu không có AI, dù mất nhiều thời gian hơn.", reverse: true },
      { id: "g5q5", text: "Tôi có thể tự kiểm tra lại kết quả của mình mà không cần AI xác nhận.", reverse: true },
    ],
  },
];

export const DEFAULT_SCENARIOS = [
  {
    id: "s1", title: "Tình huống 1 · Phát hiện lỗi trong câu trả lời AI",
    prompt: "AI trả lời câu hỏi \"Tính diện tích hình chữ nhật có chiều dài 8cm và chiều rộng 3cm\" như sau:",
    aiAnswer: "\"Diện tích hình chữ nhật là 8 + 3 = 11 cm².\"",
    question: "Câu trả lời trên có lỗi gì? Hãy chỉ ra lỗi và sửa lại cho đúng bằng lời của bạn.",
    type: "text",
    keyPoints: [
      { label: "Chỉ ra phép tính sai (phải nhân, không phải cộng)", keywords: ["nhân", "phép nhân", "8 x 3", "8x3", "không phải cộng"] },
      { label: "Đưa ra đáp số đúng 24 cm²", keywords: ["24"] },
    ],
    riskKeywords: ["không biết", "em không rõ", "chắc là đúng", "ai nói vậy", "đúng rồi", "không có lỗi"],
  },
  {
    id: "s2", title: "Tình huống 2 · Kiểm chứng nguồn thông tin",
    prompt: "Bạn vừa nhận được một câu trả lời từ AI và muốn kiểm chứng lại.",
    question: "Bạn sẽ kiểm chứng bằng cách nào? Giải thích ngắn gọn vì sao bạn chọn cách đó.",
    type: "text",
    keyPoints: [
      { label: "Nêu được nguồn đáng tin cậy để đối chiếu", keywords: ["sách giáo khoa", "giáo viên", "thầy cô", "tài liệu", "sách"] },
      { label: "Giải thích lý do chọn nguồn đó (đáng tin, chính thống...)", keywords: ["đáng tin", "chính xác", "chính thống", "kiểm chứng"] },
    ],
    riskKeywords: ["không kiểm tra", "tin luôn", "không cần kiểm chứng", "hỏi lại ai", "hỏi lại ai đó"],
  },
  {
    id: "s3", title: "Tình huống 3 · Giải thích bằng lời của bản thân",
    prompt: "AI giải thích khái niệm sau:",
    aiAnswer: "\"Quang hợp là quá trình cây xanh sử dụng ánh sáng mặt trời, nước và khí carbon dioxide để tạo ra glucose và khí oxy, nhờ chất diệp lục trong lá cây.\"",
    question: "Hãy viết lại cách hiểu của bạn về khái niệm trên bằng lời của chính mình (ít nhất một câu, không chép lại nguyên văn).",
    type: "text",
    keyPoints: [
      { label: "Nêu được nguyên liệu/điều kiện (ánh sáng, nước, CO2)", keywords: ["ánh sáng", "nước", "carbon", "co2", "khí carbonic"] },
      { label: "Nêu được sản phẩm tạo ra (glucose/chất hữu cơ và oxy)", keywords: ["glucose", "chất hữu cơ", "oxy", "oxi"] },
    ],
    riskKeywords: ["không biết", "em không rõ", "ai nói vậy", "copy"],
  },
  {
    id: "s4", title: "Tình huống 4 · Trình bày cách làm của riêng bạn",
    prompt: "Khi gặp một bài tập khó, giả sử bạn KHÔNG dùng AI để tra cứu ngay.",
    question: "Hãy trình bày các bước bạn sẽ làm để tự giải quyết bài tập đó (không chỉ nêu đáp số).",
    type: "text",
    keyPoints: [
      { label: "Nêu được bước đọc/hiểu đề trước", keywords: ["đọc đề", "hiểu đề", "phân tích đề", "xác định yêu cầu"] },
      { label: "Nêu được bước tự thử/tự giải trước khi tra cứu thêm", keywords: ["tự làm", "tự giải", "thử làm", "suy nghĩ"] },
    ],
    riskKeywords: ["hỏi ai luôn", "chép đáp án", "không biết làm sao", "chịu"],
  },
  {
    id: "s5", title: "Tình huống 5 · Tự giải quyết khi không có AI",
    prompt: "Hãy tự giải bài toán ngắn sau (không dùng AI, máy tính hay tra cứu):",
    question: "Một quyển sách có 240 trang. Nếu đọc đều 24 trang mỗi ngày thì cần bao nhiêu ngày để đọc hết? Trình bày cách tính và đáp số bằng lời của bạn.",
    type: "text",
    keyPoints: [
      { label: "Trình bày phép chia 240:24", keywords: ["240", "24", "chia"] },
      { label: "Đưa ra đáp số đúng 10 ngày", keywords: ["10 ngày", "= 10", "10"] },
    ],
    riskKeywords: ["không biết", "em không rõ", "chắc là", "không tính được"],
  },
];

// Giữ 2 tên cũ để không phá code đang import ACDI_GROUPS / SCENARIOS ở nơi khác (nếu có).
export const ACDI_GROUPS = DEFAULT_ACDI_GROUPS;
export const SCENARIOS = DEFAULT_SCENARIOS;

export function allQuestionIds(groups = DEFAULT_ACDI_GROUPS) {
  return groups.flatMap((g) => g.questions.map((q) => q.id));
}

// Điểm 1 câu quy về thang 0-100, đã đảo điểm nếu cần (reverse:true)
function scoreQuestion(q, rawValue) {
  const v = q.reverse ? 6 - rawValue : rawValue;
  return ((v - 1) / 4) * 100;
}

// Điểm từng nhóm chỉ báo (0-100). Nhận "groups" của bộ đề đang dùng (mặc định hoặc do AI soạn).
export function computeDimensionScores(answers, groups = DEFAULT_ACDI_GROUPS) {
  const dimensionScores = {};
  groups.forEach((g) => {
    const scores = g.questions.map((q) => scoreQuestion(q, Number(answers[q.id]) || 3));
    dimensionScores[g.key] = Math.round((scores.reduce((s, x) => s + x, 0) / scores.length) * 10) / 10;
  });
  return dimensionScores;
}

// Điểm bảng hỏi tổng = trung bình 5 nhóm chỉ báo
export function computeQuestionnaireScore(dimensionScores) {
  const vals = Object.values(dimensionScores);
  return vals.reduce((s, x) => s + x, 0) / vals.length;
}

// ============ 2. CHẤM ĐIỂM TÌNH HUỐNG (tự luận) — HOÀN TOÀN BẰNG CÔNG THỨC CỐ ĐỊNH ============
// KHÔNG gọi AI lúc học sinh nộp bài. Mỗi tình huống đã được AI soạn kèm "đáp án"/rubric
// (keyPoints + riskKeywords) NGAY LÚC TẠO ĐỀ (xem GENERATION_INSTRUCTION_TEMPLATE mục 5) — rubric
// đó được lưu cùng đề trong cache Firestore (acdiTests/{testKey}), nên việc chấm điểm về sau chỉ là
// logic JS thuần: luôn ra cùng một kết quả cho cùng một câu trả lời, kiểm tra lại được, không phụ
// thuộc việc gọi AI lúc chấm có ổn định hay không.

function normalizeText(s) {
  return String(s || "").toLowerCase().normalize("NFC")
    .replace(/[.,!?;:"'()\u201c\u201d]/g, " ").replace(/\s+/g, " ").trim();
}

// Độ trùng lặp từ ngữ giữa câu trả lời học sinh và đoạn gốc AI (0-1, càng cao càng giống/sao chép).
function copyOverlapRatio(referenceText, studentText) {
  const studentWords = normalizeText(studentText).split(" ").filter(Boolean);
  if (studentWords.length === 0) return 0;
  const refWords = new Set(normalizeText(referenceText).split(" ").filter(Boolean));
  if (refWords.size === 0) return 0;
  const overlapCount = studentWords.filter((w) => refWords.has(w)).length;
  return overlapCount / studentWords.length;
}

// Chấm 1 câu tự luận theo rubric cố định (keyPoints + riskKeywords) đã có sẵn trong "scenario".
// Trả về điểm NGUY CƠ LỆ THUỘC AI (0-100, càng cao càng đáng lo). Thuần công thức, không dùng AI.
//
//  - Câu trả lời quá ngắn (dưới 6 từ) coi như chưa thể hiện được hiểu biết → nguy cơ cao ngay (90).
//  - Điểm bắt đầu từ 100, GIẢM dần theo % ý chính (keyPoints) mà học sinh có nhắc tới (khớp nếu câu
//    trả lời chứa ít nhất một từ khoá/đồng nghĩa trong "keywords" của ý đó).
//  - CỘNG THÊM điểm nếu câu trả lời chứa cụm từ trong "riskKeywords" (dấu hiệu không tự hiểu).
//  - CỘNG THÊM điểm nếu câu trả lời trùng lặp từ ngữ nhiều với "aiAnswer" (sao chép thay vì tự diễn
//    đạt) — chỉ áp dụng khi tình huống có trường này.
export function scoreEssayByRubric(scenario, studentText) {
  const text = normalizeText(studentText);
  const wordCount = text ? text.split(" ").filter(Boolean).length : 0;
  if (wordCount < 6) return 90;

  const keyPoints = Array.isArray(scenario.keyPoints) ? scenario.keyPoints : [];
  let matchedCount = 0;
  keyPoints.forEach((kp) => {
    const kws = Array.isArray(kp.keywords) ? kp.keywords : [];
    if (kws.some((kw) => text.includes(normalizeText(kw)))) matchedCount++;
  });
  const coverageRatio = keyPoints.length ? matchedCount / keyPoints.length : 0.5;

  let score = 100 - coverageRatio * 75; // đủ ý chính -> điểm nguy cơ giảm mạnh (còn khoảng 25 nền)

  const riskKeywords = Array.isArray(scenario.riskKeywords) ? scenario.riskKeywords : [];
  const riskHits = riskKeywords.filter((kw) => text.includes(normalizeText(kw))).length;
  score += Math.min(riskHits, 3) * 12; // mỗi cụm từ rủi ro cộng thêm, tối đa cộng 36

  if (scenario.aiAnswer) {
    const overlap = copyOverlapRatio(scenario.aiAnswer, studentText);
    if (overlap > 0.5) score += (overlap - 0.5) * 60; // chép gần nguyên văn -> cộng thêm nhiều
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

// Chấm toàn bộ tình huống của MỘT bộ đề (nhận "scenarios" của bộ đề đang dùng).
// Không còn là hàm async (không gọi AI) — giữ tên/đầu ra giống cũ để nơi gọi (results.html) không
// phải sửa cách dùng ("await computeScenarioScores(...)" vẫn hợp lệ với giá trị không phải Promise).
// Trả về { perScenario, overall }.
export function computeScenarioScores(scenarioAnswers, scenarios = DEFAULT_SCENARIOS) {
  const perScenario = {};
  scenarios.forEach((sc) => {
    perScenario[sc.id] = scoreEssayByRubric(sc, scenarioAnswers[sc.id]);
  });
  const vals = Object.values(perScenario);
  const overall = vals.length ? vals.reduce((s, x) => s + x, 0) / vals.length : 0;
  return { perScenario, overall };
}

// ============ 3. CÔNG THỨC ACDI (CỐ ĐỊNH — AI không tham gia bước này) ============
// ACDI = 0,7 × Điểm lệ thuộc tự đánh giá (bảng hỏi) + 0,3 × Điểm nguy cơ từ tình huống
export const QUESTIONNAIRE_WEIGHT = 0.7;
export const SCENARIO_WEIGHT = 0.3;

export function computeAcdiScore(questionnaireScore, scenarioScore) {
  const raw = QUESTIONNAIRE_WEIGHT * questionnaireScore + SCENARIO_WEIGHT * scenarioScore;
  return Math.round(raw * 10) / 10;
}

// ============ 4. MÔ HÌNH BỐN MỨC ĐỘ ============
export const LEVEL_INFO = {
  1: { title: "Sử dụng AI có kiểm soát", range: "0–24", color: "#1f9d6c",
    desc: "Bạn chủ động suy nghĩ, có khả năng kiểm chứng và vẫn hoàn thành nhiệm vụ khi không có AI. AI chưa thay thế đáng kể các hoạt động nhận thức của bạn." },
  2: { title: "Có dấu hiệu dựa vào AI", range: "25–49", color: "#f39c12",
    desc: "Bạn sử dụng AI thường xuyên để tìm ý tưởng hoặc định hướng, nhưng vẫn còn khả năng tự xử lí và điều chỉnh kết quả." },
  3: { title: "Lệ thuộc AI", range: "50–74", color: "#e67e22",
    desc: "Bạn thường để AI thực hiện các phần quan trọng của nhiệm vụ, ít kiểm chứng và có thể gặp khó khăn khi phải tự giải thích hoặc làm lại." },
  4: { title: "Nguy cơ lệ thuộc AI cao", range: "75–100", color: "#e74c3c",
    desc: "AI đang có xu hướng thay thế phần lớn hoạt động tư duy của bạn. Bạn có thể thấy khó bắt đầu, giải quyết và hoàn thành nhiệm vụ nếu không có sự hỗ trợ của AI." },
};

export function classifyLevel(acdi) {
  if (acdi < 25) return 1;
  if (acdi < 50) return 2;
  if (acdi < 75) return 3;
  return 4;
}

// ============ 5. KHUYẾN NGHỊ CÁ NHÂN ============
const GROUP_TIPS = {
  start: "Hãy thử dành 2–3 phút tự đọc kỹ đề bài và phác thảo hướng làm trước khi mở công cụ AI.",
  idea: "Hãy dành khoảng 5–10 phút tự viết ra các ý tưởng ban đầu của riêng mình trước khi tham khảo AI.",
  process: "Hãy thử tự làm phần khó trước, chỉ xin AI gợi ý đúng chỗ mình thực sự vướng.",
  trust: "Hãy tập thói quen đối chiếu câu trả lời của AI với ít nhất một nguồn khác trước khi dùng.",
  independence: "Hãy thử làm lại một bài tương tự mà không dùng AI, để kiểm tra mức độ mình đã thực sự nắm được cách làm.",
};

export function groupTitle(key, groups = DEFAULT_ACDI_GROUPS) {
  return groups.find((g) => g.key === key)?.title || GROUP_DEFS.find((g) => g.key === key)?.title || key;
}

export function buildRecommendation(dimensionScores, groups = DEFAULT_ACDI_GROUPS) {
  const entries = Object.entries(dimensionScores);
  const highest = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
  const lowest = entries.reduce((a, b) => (b[1] < a[1] ? b : a));
  return {
    highestRiskGroupKey: highest[0],
    highestRiskGroup: groupTitle(highest[0], groups),
    bestMaintainedGroupKey: lowest[0],
    bestMaintainedGroup: groupTitle(lowest[0], groups),
    tip: GROUP_TIPS[highest[0]] || "",
  };
}

// ============ 5b. NHẬN XÉT / LỜI KHUYÊN CÁ NHÂN HOÁ — GỌI AI ĐÚNG 1 LẦN, SAU KHI ĐÃ CÓ ĐIỂM ============
// QUAN TRỌNG: hàm này KHÔNG được dùng để tính hay sửa điểm số — điểm (dimensionScores/acdiScore/level)
// VÀ việc xác định nhóm cao/thấp nhất (rec = buildRecommendation(...)) đã được chốt bằng công thức cố
// định TRƯỚC khi gọi hàm này. AI KHÔNG được tự chọn nhóm khác để bàn luận — phải viết đúng về 2 nhóm
// đã được xác định sẵn (rec.highestRiskGroup / rec.bestMaintainedGroup), nếu không sẽ bị lệch với tiêu
// đề hiển thị (vốn lấy trực tiếp từ rec, không lấy từ AI). Nếu gọi AI lỗi, dùng buildRecommendation()
// (thuần công thức, không cần mạng) làm phương án dự phòng — xem cách dùng ở acdi-results.html.
export async function generateFeedbackWithAI({ info, groups, scenarios, answers, scenarioAnswers, perScenario, dimensionScores, acdiScore, level, rec }) {
  const li = LEVEL_INFO[level];
  // KHÔNG đưa nhãn kỹ thuật kiểu "(key:xxx)" vào đây — nếu có, AI hay chép nguyên xi kiểu nhãn đó vào
  // câu trả lời cho người dùng, trông rất kỹ thuật/khó hiểu với học sinh. Chỉ đưa tên tiếng Việt + điểm.
  const groupSummary = groups.map((g) => `- ${g.title}: điểm ${dimensionScores[g.key]}/100`).join("\n");
  const scenarioSummary = scenarios.map((sc) => {
    const ans = scenarioAnswers?.[sc.id];
    return `- ${sc.title}\n  Câu hỏi: ${sc.question}\n  Câu trả lời học sinh: "${String(ans || "(không trả lời)").slice(0, 400)}"\n  Điểm nguy cơ hệ thống đã chấm: ${perScenario?.[sc.id] ?? "-"}/100`;
  }).join("\n");

  const prompt = `Bạn là chuyên gia giáo dục, viết NHẬN XÉT và LỜI KHUYÊN cá nhân hoá cho một học sinh vừa
làm xong bài khảo sát ACDI Check (đo mức độ lệ thuộc nhận thức vào AI trong học tập).

QUAN TRỌNG: điểm số dưới đây ĐÃ ĐƯỢC HỆ THỐNG CHẤM CỐ ĐỊNH XONG, bạn KHÔNG được thay đổi hay bàn luận
lại về tính đúng/sai của điểm số — nhiệm vụ của bạn CHỈ là viết nhận xét và lời khuyên dựa trên các
điểm số và câu trả lời thực tế này.

Thông tin học sinh: cấp học ${info?.schoolLevel === "thpt" ? "THPT" : "THCS"}, khối lớp ${info?.grade}.
Điểm ACDI tổng: ${acdiScore}/100 — Mức ${level} (${li.title}).

Điểm 5 nhóm chỉ báo:
${groupSummary}

HỆ THỐNG ĐÃ XÁC ĐỊNH SẴN (bằng công thức, không phải bạn quyết định):
- Nhóm CÓ NGUY CƠ CAO NHẤT là: "${rec.highestRiskGroup}"
- Nhóm DUY TRÌ TỐT NHẤT là: "${rec.bestMaintainedGroup}"
Bạn BẮT BUỘC phải viết "highestRiskComment" về ĐÚNG nhóm "${rec.highestRiskGroup}" và "strengthComment" về
ĐÚNG nhóm "${rec.bestMaintainedGroup}" nêu trên — KHÔNG được tự chọn nhóm khác để bàn luận, kể cả khi bạn
thấy một nhóm khác có vẻ đáng chú ý hơn.

Chi tiết 5 tình huống tự luận và điểm nguy cơ hệ thống đã chấm cho từng câu:
${scenarioSummary}

Hãy trả lời CHỈ bằng JSON đúng schema sau, viết bằng tiếng Việt, giọng văn gần gũi, mang tính xây dựng,
không phán xét, dựa sát vào câu trả lời thực tế của học sinh (không nói chung chung):
{
  "highestRiskComment": "1-2 câu nhận xét cụ thể về nhóm \"${rec.highestRiskGroup}\", dựa trên các câu trả lời liên quan",
  "strengthComment": "1-2 câu nhận xét về nhóm \"${rec.bestMaintainedGroup}\"",
  "advice": "2-4 câu lời khuyên cụ thể, khả thi, phù hợp lứa tuổi/khối lớp, giúp học sinh cải thiện nhóm \"${rec.highestRiskGroup}\""
}
YÊU CẦU VỀ VĂN PHONG — RẤT QUAN TRỌNG:
- Viết văn tự nhiên, dễ hiểu với học sinh, gọi tên nhóm CHỈ bằng tên tiếng Việt ở trên (ví dụ: "${rec.highestRiskGroup}").
- TUYỆT ĐỐI KHÔNG được đưa vào câu trả lời bất kỳ nhãn kỹ thuật/mã nội bộ nào, ví dụ: "key:...", "g1q2",
  "s3", tên biến, hay số liệu đặt trong ngoặc kiểu "(key:idea=20)". Nếu cần nêu điểm số, chỉ viết dạng
  văn xuôi bình thường (ví dụ: "điểm 20/100"), không dùng ký hiệu kỹ thuật.
CHỈ trả về JSON, không kèm giải thích, không markdown, không dấu backtick.`;

  try {
    const cfg = await getApiConfig();
    const raw = await callAiApi({
      endpoint: cfg.endpoint, apiKey: cfg.apiKey, model: cfg.model,
      messages: [{ role: "user", content: prompt }], maxTokens: 1200,
    });
    const cleaned = String(raw).replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (!parsed || typeof parsed.highestRiskComment !== "string" || typeof parsed.strengthComment !== "string" || typeof parsed.advice !== "string") {
      throw new Error("JSON nhận xét từ AI không đúng cấu trúc.");
    }
    return { ...parsed, source: "ai" };
  } catch (err) {
    console.warn("Tạo nhận xét cá nhân hoá bằng AI thất bại, dùng khuyến nghị mặc định:", err);
    return {
      highestRiskComment: `Nhóm "${rec.highestRiskGroup}" đang là nhóm bạn cần chú ý nhất.`,
      strengthComment: `Nhóm "${rec.bestMaintainedGroup}" là nhóm bạn duy trì tốt nhất.`,
      advice: rec.tip,
      source: "fallback",
    };
  }
}

// ============ 6. MÃ NGƯỜI THAM GIA (ẨN DANH) ============
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function generateParticipantCode(len = 8) {
  let out = "";
  for (let i = 0; i < len; i++) out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return out;
}

// ============ 7. SOẠN ĐỀ BẰNG AI — CÓ CACHE THEO TIÊU CHÍ ============
// Mục tiêu: tối ưu chi phí gọi AI — nếu 2 người có cùng tiêu chí (cấp học + khối lớp + môn học
// thường dùng AI), họ dùng CHUNG một bộ đề đã soạn sẵn trong Firestore (acdiTests/{testKey}),
// thay vì mỗi người lại tốn 1 lượt gọi AI để soạn đề mới. AI CHỈ được gọi để soạn đề khi
// tiêu chí đó CHƯA từng có đề nào được lưu.
//
// Việc chấm điểm PHẦN TỰ LUẬN (mục 2b) vẫn luôn gọi AI cho từng học sinh (không cache), vì đó
// là chấm câu trả lời CỦA RIÊNG học sinh đó, không thể dùng lại giữa các học sinh khác nhau.

export function buildTestCriteriaKey({ schoolLevel, grade, subjects }) {
  const subjPart = Array.from(new Set(subjects || [])).sort().join("-") || "none";
  return `${schoolLevel || "na"}_g${grade || "na"}_${subjPart}`.toLowerCase();
}

const GENERATION_INSTRUCTION_TEMPLATE = (criteria) => `Bạn là chuyên gia thiết kế công cụ đo lường tâm lý giáo dục, được giao soạn MỘT bộ đề ACDI Check
(đo Chỉ số lệ thuộc nhận thức vào AI của học sinh) phù hợp với nhóm đối tượng sau:
- Cấp học: ${criteria.schoolLevel === "thpt" ? "Trung học phổ thông (THPT)" : "Trung học cơ sở (THCS)"}
- Khối lớp: ${criteria.grade}
- Môn học thường dùng AI: ${(criteria.subjects || []).join(", ") || "không rõ"}

YÊU CẦU BẮT BUỘC — áp dụng GIỐNG NHAU cho MỌI lần soạn đề, không tự thay đổi cấu trúc hay cách hiểu:

1. Soạn đúng 5 NHÓM CHỈ BÁO theo đúng 5 khoá "key" và Ý NGHĨA ĐO LƯỜNG cố định sau (giữ nguyên
   key, được tự viết lại title/desc/câu hỏi cho phù hợp lứa tuổi và môn học nêu trên):
   - "start" (Phụ thuộc khi bắt đầu nhiệm vụ): mức độ cần AI để xác định cách làm/khởi động nhiệm vụ.
   - "idea" (Phụ thuộc về ý tưởng): khả năng tự hình thành ý tưởng, dàn ý, phương án giải quyết.
   - "process" (Phụ thuộc trong xử lí nhiệm vụ): mức độ giao cho AI phân tích, lập luận, hoàn thành sản phẩm.
   - "trust" (Phụ thuộc vào kết quả của AI): mức độ tin tưởng, chấp nhận câu trả lời AI mà không kiểm tra.
   - "independence" (Khả năng hoạt động khi không có AI): khả năng ghi nhớ, giải thích, tự hoàn thành khi không có AI.
   BẮT BUỘC soạn ĐỦ 25 câu (5 nhóm × 5 câu), TOÀN BỘ do bạn tự viết — không được bỏ trống hay rút gọn.
   PHÂN BỐ NỘI DUNG ĐỀU trong từng nhóm: 5 câu của MỘT nhóm phải đo 5 KHÍA CẠNH KHÁC NHAU của cùng
   một chỉ báo (không được viết 5 câu gần như lặp lại cùng một ý), để điểm trung bình của nhóm phản
   ánh đúng nhiều mặt của hành vi, không bị lệch vì phần lớn câu hỏi trùng ý nhau.
2. Mỗi nhóm có đúng 5 câu hỏi kiểu Likert 5 mức (từ "Hoàn toàn không đúng" đến "Hoàn toàn đúng"),
   mỗi câu có "id" duy nhất dạng "g{số nhóm 1-5}q{số câu 1-5}" (ví dụ g1q1..g1q5, g2q1..g2q5,...).
3. Trường "reverse" — ĐÂY LÀ CHỖ DỄ SAI NHẤT, PHẢI TỰ KIỂM TRA LẠI TỪNG CÂU TRƯỚC KHI TRẢ VỀ:
   - Mặc định "reverse: false" cho 4 nhóm đầu ("start","idea","process","trust") — NGHĨA LÀ mọi câu
     hỏi trong 4 nhóm này BẮT BUỘC phải viết theo hướng "câu đồng ý (chọn mức cao) = lệ thuộc AI
     NHIỀU HƠN". TUYỆT ĐỐI KHÔNG được viết một câu theo hướng ngược lại (ví dụ ca ngợi sự độc lập,
     "tôi tự nghĩ ra ý tưởng trước khi hỏi AI") rồi vẫn để reverse:false — làm vậy học sinh trả lời
     tốt (độc lập) sẽ bị chấm nhầm thành lệ thuộc cao, khiến điểm nhóm đó luôn bị đẩy lên rất cao
     một cách SAI LỆCH. Nếu bạn thấy một câu tự nhiên phải viết theo hướng độc lập, hãy VIẾT LẠI câu
     đó theo hướng lệ thuộc (ví dụ đổi thành "tôi khó tự nghĩ ra ý tưởng nếu chưa hỏi AI") thay vì đặt
     reverse:true cho nhóm này.
   - "reverse: true" CHỈ dùng cho TẤT CẢ 5 câu của nhóm "independence" (vì nhóm này đo năng lực độc
     lập, Likert càng cao thì càng ÍT lệ thuộc).
   - Trước khi trả JSON, tự rà soát: với mỗi câu reverse:false, "chọn mức 5 (Hoàn toàn đúng)" có
     đúng nghĩa là "lệ thuộc AI nhiều nhất" không? Nếu không đúng, phải sửa lại cách diễn đạt câu đó.
4. Có thể lồng ví dụ, ngữ cảnh gắn với môn học/khối lớp nêu trên để học sinh dễ liên hệ, nhưng Ý NGHĨA
   ĐO LƯỜNG của mỗi nhóm phải giữ đúng như mô tả ở trên — không được tạo câu hỏi đo sai nhóm.
5. Soạn đúng 5 TÌNH HUỐNG TỰ LUẬN, id lần lượt "s1".."s5", TẤT CẢ đều type "text" (không dùng
   type "choice" hay "number" nữa) — mỗi tình huống yêu cầu học sinh TỰ VIẾT câu trả lời bằng lời
   của mình (không phải chọn đáp án có sẵn), để đánh giá đúng khả năng tư duy độc lập thay vì đoán:
   - s1: một câu trả lời của AI có chứa LỖI (nội dung liên quan môn học nêu trên nếu hợp lý, trong
     trường "aiAnswer"); yêu cầu học sinh chỉ ra lỗi đó là gì và sửa lại cho đúng bằng lời của mình.
   - s2: tình huống cần kiểm chứng một thông tin AI đưa ra; yêu cầu học sinh nêu cách/nguồn mình sẽ
     dùng để kiểm chứng và giải thích ngắn gọn vì sao.
   - s3: có "aiAnswer" là một đoạn AI giải thích một khái niệm liên quan môn học nêu trên (3-4 câu);
     yêu cầu học sinh viết lại cách hiểu bằng lời riêng của mình (không được chép lại nguyên văn).
   - s4: một tình huống/bài tập nhỏ liên quan môn học, yêu cầu học sinh tự trình bày CÁCH LÀM (các
     bước suy luận) của mình, không chỉ đưa ra đáp số.
   - s5: một bài toán/câu hỏi áp dụng ngắn, KHÔNG dùng AI/máy tính/tra cứu, yêu cầu học sinh tự giải
     và trình bày lại cách giải bằng lời.
   ĐỘ KHÓ của nội dung s1-s5 phải tăng dần theo khối lớp đã cho ở trên (nội dung dành cho lớp 12 phải
   khó/nâng cao hơn một chút so với nội dung cùng dạng dành cho lớp 10, và khó hơn khối THCS); vẫn phải
   phù hợp môn học nêu trên và vừa sức để học sinh khối lớp đó có thể tự làm được nếu không dùng AI.

   MỖI tình huống BẮT BUỘC phải có kèm "đáp án"/rubric để HỆ THỐNG (không phải AI) tự động chấm điểm
   NGUY CƠ LỆ THUỘC AI (0-100, càng cao càng đáng lo) khi học sinh nộp bài sau này, gồm 2 trường:
   - "keyPoints": mảng 2-4 ý CHÍNH mà một câu trả lời TỐT (hiểu đúng, tự lập luận được) cần thể hiện.
     Mỗi phần tử có dạng { "label": "mô tả ngắn ý đó", "keywords": [ 3-6 từ/cụm từ tiếng Việt, không
     dấu câu, là các từ khoá/đồng nghĩa mà một câu trả lời đúng thường sẽ chứa MỘT TRONG SỐ ĐÓ ] }.
   - "riskKeywords": mảng 3-6 cụm từ/từ khoá (chuỗi ngắn) cho thấy dấu hiệu RỦI RO cao khi xuất hiện
     trong câu trả lời của học sinh — ví dụ thể hiện học sinh không tự hiểu, chỉ đoán, dựa hẳn vào AI,
     hoặc trả lời cho có (ví dụ: "không biết", "AI nói vậy", "chắc là đúng", "em không rõ", "copy").
6. CHỈ trả về JSON hợp lệ đúng schema bên dưới. TUYỆT ĐỐI không kèm giải thích, không markdown,
   không dấu backtick, không có chữ nào ngoài JSON.

SCHEMA JSON:
{
  "groups": [
    { "key": "start", "title": "...", "desc": "...", "questions": [ { "id": "g1q1", "text": "...", "reverse": false }, ... đúng 5 câu ... ] },
    ... đúng 5 nhóm theo thứ tự start, idea, process, trust, independence ...
  ],
  "scenarios": [
    { "id": "s1", "title": "...", "prompt": "...", "aiAnswer": "...", "question": "...", "type": "text",
      "keyPoints": [ { "label": "...", "keywords": ["...", "..."] }, ... 2-4 ý ... ],
      "riskKeywords": ["...", "...", "..."] },
    ... đúng 5 tình huống s1..s5, TẤT CẢ type "text", đều có "keyPoints" và "riskKeywords" như trên
    ("aiAnswer" chỉ bắt buộc với s1 và s3, các tình huống khác có thể bỏ trường này nếu không cần) ...
  ]
}`;

function validateGeneratedTest(data) {
  if (!data || !Array.isArray(data.groups) || !Array.isArray(data.scenarios)) return false;
  if (data.groups.length !== 5 || data.scenarios.length !== 5) return false;
  const expectedKeys = ["start", "idea", "process", "trust", "independence"];
  for (let i = 0; i < 5; i++) {
    const g = data.groups[i];
    if (!g || g.key !== expectedKeys[i] || !Array.isArray(g.questions) || g.questions.length !== 5) return false;
    if (g.questions.some((q) => !q.id || typeof q.text !== "string")) return false;
  }
  const expectedIds = ["s1", "s2", "s3", "s4", "s5"];
  for (let i = 0; i < 5; i++) {
    const sc = data.scenarios[i];
    if (!sc || sc.id !== expectedIds[i] || sc.type !== "text") return false;
    if (typeof sc.question !== "string" || !sc.question.trim()) return false;
    if (!Array.isArray(sc.keyPoints) || sc.keyPoints.length < 2) return false;
    if (sc.keyPoints.some((k) => !k || typeof k.label !== "string" || !Array.isArray(k.keywords) || k.keywords.length < 1)) return false;
    if (!Array.isArray(sc.riskKeywords) || sc.riskKeywords.length < 2) return false;
  }
  return true;
}

// Gọi AI để soạn 1 bộ đề mới theo tiêu chí. Ném lỗi nếu gọi AI thất bại hoặc JSON không hợp lệ
// (nơi gọi hàm này nên tự bắt lỗi và dùng DEFAULT_ACDI_GROUPS/DEFAULT_SCENARIOS làm phương án dự phòng).
//
// LƯU Ý VỀ maxTokens: bộ đề đầy đủ (25 câu Likert + 5 tình huống tự luận, MỖI tình huống còn kèm
// rubric "đáp án" keyPoints/riskKeywords) tạo ra JSON khá dài — nếu maxTokens quá thấp, phản hồi của
// AI sẽ bị CẮT NGANG giữa chừng, khiến JSON.parse() lỗi (hoặc validateGeneratedTest() không qua vì
// thiếu trường), và hệ thống sẽ ÂM THẦM rơi về DEFAULT_ACDI_GROUPS/DEFAULT_SCENARIOS (bộ đề mặc định
// cứng trong code) — đây chính là nguyên nhân hay gặp khi thấy đề luôn giống nhau/đơn giản bất thường.
export async function generateTestWithAI(criteria) {
  const cfg = await getApiConfig();
  const raw = await callAiApi({
    endpoint: cfg.endpoint, apiKey: cfg.apiKey, model: cfg.model,
    messages: [{ role: "user", content: GENERATION_INSTRUCTION_TEMPLATE(criteria) }],
    maxTokens: 8000,
  });
  const cleaned = String(raw).replace(/```json|```/g, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    // In log đủ để chẩn đoán: độ dài phản hồi + đoạn cuối (nếu bị cắt ngang do hết token, đoạn cuối
    // thường dở dang, không đóng ngoặc) — xem console để biết chắc có phải do bị cắt hay không.
    console.error(`Không parse được JSON đề thi từ AI (độ dài phản hồi: ${cleaned.length} ký tự). 300 ký tự cuối:`, cleaned.slice(-300));
    throw new Error("Không parse được JSON đề thi từ AI: " + cleaned.slice(0, 300));
  }
  if (!validateGeneratedTest(parsed)) {
    console.error("Đề thi AI trả về không đúng cấu trúc yêu cầu. Dữ liệu nhận được:", parsed);
    throw new Error("Đề thi AI trả về không đúng cấu trúc yêu cầu.");
  }
  return { groups: parsed.groups, scenarios: parsed.scenarios };
}

// Lấy bộ đề: ưu tiên đọc cache trong Firestore (acdiTests/{testKey}) theo tiêu chí; nếu chưa có,
// gọi AI soạn đề mới rồi lưu lại cache cho các lần sau dùng chung. Nếu AI lỗi, dùng bộ đề mặc định
// (không lưu bộ mặc định vào cache, để lần sau vẫn thử soạn lại bằng AI).
export async function getOrGenerateAcdiTest(criteria) {
  const testKey = buildTestCriteriaKey(criteria);
  try {
    const cachedSnap = await getDoc(doc(db, "acdiTests", testKey));
    if (cachedSnap.exists()) {
      const data = cachedSnap.data();
      if (validateGeneratedTest(data)) {
        return { testKey, groups: data.groups, scenarios: data.scenarios, source: "cache" };
      }
    }
  } catch (err) {
    console.warn("Không đọc được cache đề ACDI, sẽ thử soạn đề mới:", err);
  }

  try {
    const generated = await generateTestWithAI(criteria);
    try {
      await setDoc(doc(db, "acdiTests", testKey), {
        ...generated,
        criteria,
        createdAt: serverTimestamp(),
      });
    } catch (err) {
      console.warn("Soạn đề AI thành công nhưng lưu cache thất bại (vẫn dùng được đề vừa soạn):", err);
    }
    return { testKey, groups: generated.groups, scenarios: generated.scenarios, source: "ai" };
  } catch (err) {
    console.warn("Soạn đề bằng AI thất bại, dùng bộ đề mặc định:", err);
    return { testKey, groups: DEFAULT_ACDI_GROUPS, scenarios: DEFAULT_SCENARIOS, source: "default" };
  }
}

// ============ 8. FIRESTORE — LƯU / ĐỌC KẾT QUẢ ============
export async function saveAssessment(data) {
  const ref = await addDoc(collection(db, "assessments"), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

// Trang quản trị nghiên cứu (đã xác thực isResearchAdmin): lấy toàn bộ kết quả, đầy đủ trường.
export async function listAssessments() {
  const snap = await getDocs(query(collection(db, "assessments"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function isResearchAdmin(uid) {
  const snap = await getDoc(doc(db, "admins", uid));
  return snap.exists();
}

// ============ 9. THỐNG KÊ TỔNG HỢP CHO GIÁO VIÊN (KHÔNG lộ thông tin cá nhân) ============
// Chỉ giữ lại các trường phục vụ thống kê/biểu đồ — loại bỏ hoàn toàn các trường định danh
// (studentUid, studentEmail, participantCode, câu trả lời chi tiết...) trước khi trả về, để
// đảm bảo đúng cam kết bảo mật: giáo viên chỉ thấy số liệu tổng hợp, không biết ai làm bài nào.
function stripToAggregateFields(row) {
  return {
    schoolLevel: row.schoolLevel || null,
    grade: row.grade || null,
    aiFrequency: row.aiFrequency || null,
    acdiScore: typeof row.acdiScore === "number" ? row.acdiScore : null,
    acdiLevel: row.acdiLevel || null,
    dimensionScores: row.dimensionScores || null,
    classId: row.classId || null, // chỉ dùng nội bộ để lọc theo lớp, không hiển thị ra UI
  };
}

// Toàn bộ dữ liệu ACDI trong hệ thống, đã ẩn danh — dùng cho mục "Toàn hệ thống" ở trang giáo viên.
export async function listAssessmentsAnonymized() {
  const snap = await getDocs(collection(db, "assessments"));
  return snap.docs.map((d) => stripToAggregateFields(d.data()));
}

// Dữ liệu ACDI của riêng một lớp (theo classId đã gắn khi học sinh nộp bài), đã ẩn danh —
// dùng cho mục "Lớp của bạn" ở trang giáo viên.
export async function listAssessmentsForClassAnonymized(classId) {
  if (!classId) return [];
  const all = await listAssessmentsAnonymized();
  return all.filter((r) => r.classId === classId);
}

// Gộp số liệu thống kê hiển thị (đếm, điểm trung bình, phân bố mức, điểm TB từng nhóm chỉ báo).
export function summarizeAssessments(rows) {
  const count = rows.length;
  const avgAcdi = count ? Math.round((rows.reduce((s, r) => s + (r.acdiScore || 0), 0) / count) * 10) / 10 : 0;
  const levelCounts = { 1: 0, 2: 0, 3: 0, 4: 0 };
  rows.forEach((r) => { if (r.acdiLevel >= 1 && r.acdiLevel <= 4) levelCounts[r.acdiLevel]++; });

  const dimKeys = ["start", "idea", "process", "trust", "independence"];
  const dimAvg = {};
  dimKeys.forEach((k) => {
    const vals = rows.map((r) => r.dimensionScores?.[k]).filter((v) => typeof v === "number");
    dimAvg[k] = vals.length ? Math.round((vals.reduce((s, x) => s + x, 0) / vals.length) * 10) / 10 : 0;
  });

  return { count, avgAcdi, levelCounts, dimAvg };
}