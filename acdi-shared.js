// acdi-shared.js
// Lõi dùng chung cho hệ thống ACDI Check: ngân hàng câu hỏi mặc định (dự phòng),
// soạn đề bằng AI (có cache theo Firestore để tối ưu chi phí), chấm điểm phần tự luận
// bằng AI, công thức tính điểm ACDI cố định, mô hình 4 mức độ, và các hàm đọc/ghi Firestore.
//
// ACDI Check ĐỘC LẬP với AI SMART Chatbot / Learning Passport / tiện ích Chrome: không dùng
// chung lịch sử hội thoại — nhưng DÙNG CHUNG cấu hình API (endpoint/apiKey/model) với chatbot,
// thông qua getApiConfig() trong auth-web.js, cho 2 việc:
//   (a) soạn đề (bảng hỏi + tình huống) — có cache theo tiêu chí để không phải gọi AI lại
//       mỗi lần có người làm khảo sát giống tiêu chí (cấp học/khối lớp/môn học) của người trước.
//   (b) chấm điểm PHẦN TỰ LUẬN (tình huống 3 — học sinh viết lại bằng lời của mình).
//
// ĐIỂM ACDI TỔNG vẫn luôn được tính bằng CÔNG THỨC CỐ ĐỊNH trong JavaScript (mục 3 bên dưới),
// AI không tham gia vào việc tính điểm tổng — AI chỉ (a) soạn đề và (b) cho điểm nguy cơ của
// riêng câu tự luận, sau đó điểm đó được đưa vào công thức chấm tình huống như các câu khác.

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
    question: "Theo bạn, câu trả lời trên có vấn đề gì?", type: "choice",
    options: [
      { id: "a", text: "Câu trả lời đúng, không có vấn đề gì.", risk: 100 },
      { id: "b", text: "Phép tính sai: phải nhân 8 × 3 = 24 cm², không phải cộng lại.", risk: 0 },
      { id: "c", text: "Chỉ sai đơn vị, phải là cm chứ không phải cm².", risk: 70 },
      { id: "d", text: "Không chắc, cứ tin theo AI vì AI thường đúng.", risk: 100 },
    ],
  },
  {
    id: "s2", title: "Tình huống 2 · Kiểm chứng nguồn thông tin",
    prompt: "Bạn vừa nhận được một câu trả lời từ AI và muốn kiểm chứng lại. Bạn sẽ ưu tiên kiểm tra bằng nguồn nào?",
    question: "Chọn nguồn bạn thấy đáng tin cậy nhất để đối chiếu:", type: "choice",
    options: [
      { id: "a", text: "Một bài đăng ẩn danh trên mạng xã hội có nội dung tương tự.", risk: 90 },
      { id: "b", text: "Sách giáo khoa hoặc tài liệu do giáo viên cung cấp.", risk: 0 },
      { id: "c", text: "Một video ngắn giải trí không rõ nguồn gốc.", risk: 90 },
      { id: "d", text: "Hỏi lại chính AI đó xem câu trả lời trước có đúng không.", risk: 60 },
    ],
  },
  {
    id: "s3", title: "Tình huống 3 · Giải thích bằng lời của bản thân",
    prompt: "AI giải thích khái niệm sau:",
    aiAnswer: "\"Quang hợp là quá trình cây xanh sử dụng ánh sáng mặt trời, nước và khí carbon dioxide để tạo ra glucose và khí oxy, nhờ chất diệp lục trong lá cây.\"",
    question: "Hãy viết lại cách hiểu của bạn về khái niệm trên bằng lời của chính mình (ít nhất một câu):", type: "text",
  },
  {
    id: "s4", title: "Tình huống 4 · Lựa chọn cách sử dụng AI",
    prompt: "Khi gặp một bài tập khó, bạn thường có xu hướng làm gì nhất?",
    question: "Chọn cách bạn thường làm nhất:", type: "choice",
    options: [
      { id: "a", text: "Tự làm trước, sau đó nhờ AI nhận xét và góp ý.", risk: 10 },
      { id: "b", text: "Xin AI gợi ý từng bước để tự hoàn thành.", risk: 45 },
      { id: "c", text: "Xin AI đáp án hoàn chỉnh ngay từ đầu.", risk: 85 },
      { id: "d", text: "Sao chép trực tiếp câu trả lời của AI để nộp bài.", risk: 100 },
    ],
  },
  {
    id: "s5", title: "Tình huống 5 · Tự giải quyết khi không có AI",
    prompt: "Hãy tự giải bài toán ngắn sau (không dùng AI, máy tính hay tra cứu):",
    question: "Một quyển sách có 240 trang. Nếu đọc đều 24 trang mỗi ngày thì cần bao nhiêu ngày để đọc hết? (nhập một số)",
    type: "number", correctAnswer: 10,
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

// ============ 2. CHẤM ĐIỂM TÌNH HUỐNG ============
// choice/number: chấm bằng công thức/logic cố định (không dùng AI).
// text (tự luận): chấm bằng AI, theo rubric CỐ ĐỊNH — xem mục 2b.
export function scoreChoiceOrNumberScenario(scenario, answer) {
  if (scenario.type === "choice") {
    const opt = scenario.options.find((o) => o.id === answer);
    return opt ? Number(opt.risk) || 0 : 100;
  }
  if (scenario.type === "number") {
    const num = Number(answer);
    if (Number.isNaN(num)) return 100;
    return num === scenario.correctAnswer ? 0 : 100;
  }
  return null; // "text" phải chấm bằng AI, xem gradeEssayWithAI
}

// Hàm dự phòng (offline) chấm tự luận bằng độ trùng lặp từ ngữ — CHỈ dùng khi việc gọi AI
// chấm điểm bị lỗi (mất mạng, API lỗi...), để trang kết quả vẫn ra được điểm thay vì bị kẹt.
function fallbackScoreOwnWordsExplanation(aiText, studentText) {
  const normalize = (s) => s.toLowerCase().normalize("NFC")
    .replace(/[.,!?;:"'()\u201c\u201d]/g, "").split(/\s+/).filter(Boolean);
  const studentWords = normalize(studentText || "");
  if (studentWords.length < 8) return 80;
  const aiWords = new Set(normalize(aiText || ""));
  const overlapCount = studentWords.filter((w) => aiWords.has(w)).length;
  const overlapRatio = overlapCount / studentWords.length;
  return Math.max(0, Math.min(100, Math.round(overlapRatio * 100)));
}

// ============ 2b. CHẤM TỰ LUẬN BẰNG AI (rubric cố định, dùng lại nguyên văn cho MỌI lần chấm) ============
const ESSAY_GRADING_RUBRIC = `RUBRIC CHẤM CỐ ĐỊNH — điểm NGUY CƠ LỆ THUỘC AI của câu trả lời tự luận (0-100, càng cao càng đáng lo),
áp dụng Y HỆT cho mọi câu trả lời, không tự đặt tiêu chí khác, không thay đổi cách chấm giữa các lần chấm:

0-20  : Diễn đạt hoàn toàn bằng lời riêng, đúng bản chất khái niệm, không sao chép cấu trúc câu của đoạn gốc.
21-40 : Diễn đạt phần lớn bằng lời riêng, đúng bản chất, còn giữ lại một vài cụm từ giống đoạn gốc.
41-60 : Diễn đạt lẫn lộn giữa lời riêng và sao chép, đúng ý nhưng khá gần với cấu trúc câu gốc.
61-80 : Gần như sao chép lại đoạn gốc, chỉ thay đổi một vài từ.
81-100: Sao chép gần như nguyên văn đoạn gốc, hoặc câu trả lời quá ngắn/rỗng/lạc đề, không thể hiện được sự hiểu bằng lời riêng.`;

// Chấm 1 câu tự luận bằng AI. Trả về { score, source }. Nếu gọi AI lỗi, dùng fallback offline.
export async function gradeEssayWithAI({ aiAnswer, studentText }) {
  try {
    const cfg = await getApiConfig();
    const prompt = `Bạn là bộ máy CHẤM ĐIỂM phần tự luận trong bài kiểm tra ACDI Check.

${ESSAY_GRADING_RUBRIC}

Đoạn giải thích gốc (của AI, dùng làm mốc so sánh):
"""${String(aiAnswer || "").replace(/"""/g, '"')}"""

Câu trả lời của học sinh (cần chấm):
"""${String(studentText || "").replace(/"""/g, '"')}"""

CHỈ trả lời bằng MỘT SỐ NGUYÊN DUY NHẤT từ 0 đến 100 (điểm nguy cơ theo rubric trên). Không kèm giải thích, không chữ, không markdown, không dấu chấm câu.`;

    const raw = await callAiApi({
      endpoint: cfg.endpoint, apiKey: cfg.apiKey, model: cfg.model,
      messages: [{ role: "user", content: prompt }], maxTokens: 10,
    });
    const match = String(raw).match(/-?\d+/);
    if (!match) throw new Error("Không đọc được số điểm từ phản hồi AI: " + raw);
    const score = Math.max(0, Math.min(100, Math.round(Number(match[0]))));
    return { score, source: "ai" };
  } catch (err) {
    console.warn("Chấm tự luận bằng AI thất bại, dùng cách chấm dự phòng offline:", err);
    return { score: fallbackScoreOwnWordsExplanation(aiAnswer, studentText), source: "fallback" };
  }
}

// Chấm toàn bộ tình huống của MỘT bộ đề (nhận "scenarios" của bộ đề đang dùng).
// Trả về { perScenario, overall, essaySource }.
export async function computeScenarioScores(scenarioAnswers, scenarios = DEFAULT_SCENARIOS) {
  const perScenario = {};
  let essaySource = null;
  for (const sc of scenarios) {
    if (sc.type === "text") {
      const { score, source } = await gradeEssayWithAI({ aiAnswer: sc.aiAnswer, studentText: scenarioAnswers[sc.id] });
      perScenario[sc.id] = score;
      essaySource = source;
    } else {
      perScenario[sc.id] = scoreChoiceOrNumberScenario(sc, scenarioAnswers[sc.id]);
    }
  }
  const vals = Object.values(perScenario);
  const overall = vals.reduce((s, x) => s + x, 0) / vals.length;
  return { perScenario, overall, essaySource };
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
2. Mỗi nhóm có đúng 5 câu hỏi kiểu Likert 5 mức (từ "Hoàn toàn không đúng" đến "Hoàn toàn đúng"),
   mỗi câu có "id" duy nhất dạng "g{số nhóm 1-5}q{số câu 1-5}" (ví dụ g1q1..g1q5, g2q1..g2q5,...).
3. Trường "reverse": để false với 4 nhóm đầu ("start","idea","process","trust"); để true với TẤT CẢ
   5 câu của nhóm "independence" (vì nhóm này đo năng lực độc lập, Likert càng cao thì càng ÍT lệ thuộc).
4. Có thể lồng ví dụ, ngữ cảnh gắn với môn học/khối lớp nêu trên để học sinh dễ liên hệ, nhưng Ý NGHĨA
   ĐO LƯỜNG của mỗi nhóm phải giữ đúng như mô tả ở trên — không được tạo câu hỏi đo sai nhóm.
5. Soạn đúng 5 TÌNH HUỐNG, id lần lượt "s1".."s5", ĐÚNG LOẠI như sau:
   - s1 (type "choice"): một câu trả lời của AI có chứa lỗi (nội dung liên quan môn học nêu trên nếu hợp lý),
     4 lựa chọn, mỗi lựa chọn có "risk" (0-100, điểm nguy cơ nếu học sinh chọn đáp án đó) — đúng 1 lựa chọn
     có risk thấp nhất (gần 0, là lựa chọn phát hiện đúng lỗi và đúng cách sửa).
   - s2 (type "choice"): tình huống chọn nguồn kiểm chứng thông tin, 4 lựa chọn kèm "risk" — lựa chọn
     "sách giáo khoa / tài liệu do giáo viên cung cấp" (hoặc tương đương) có risk thấp nhất.
   - s3 (type "text"): có "aiAnswer" là một đoạn AI giải thích một khái niệm liên quan môn học nêu trên
     (3-4 câu), và yêu cầu học sinh viết lại cách hiểu bằng lời riêng của mình.
   - s4 (type "choice"): tình huống về thói quen dùng AI khi gặp bài khó, 4 lựa chọn kèm "risk" tăng dần
     từ "tự làm trước rồi mới nhờ AI nhận xét" (risk thấp) đến "sao chép nguyên câu trả lời AI để nộp" (risk cao).
   - s5 (type "number"): một bài toán/tình huống tính toán đơn giản, ngắn, có đáp án đúng là một số
     nguyên duy nhất trong trường "correctAnswer".
6. CHỈ trả về JSON hợp lệ đúng schema bên dưới. TUYỆT ĐỐI không kèm giải thích, không markdown,
   không dấu backtick, không có chữ nào ngoài JSON.

SCHEMA JSON:
{
  "groups": [
    { "key": "start", "title": "...", "desc": "...", "questions": [ { "id": "g1q1", "text": "...", "reverse": false }, ... đúng 5 câu ... ] },
    ... đúng 5 nhóm theo thứ tự start, idea, process, trust, independence ...
  ],
  "scenarios": [
    { "id": "s1", "title": "...", "prompt": "...", "aiAnswer": "...", "question": "...", "type": "choice",
      "options": [ { "id": "a", "text": "...", "risk": 0 }, { "id": "b", "text": "...", "risk": 0 }, { "id": "c", "text": "...", "risk": 0 }, { "id": "d", "text": "...", "risk": 0 } ] },
    { "id": "s2", "title": "...", "prompt": "...", "question": "...", "type": "choice", "options": [ ... 4 lựa chọn ... ] },
    { "id": "s3", "title": "...", "prompt": "...", "aiAnswer": "...", "question": "...", "type": "text" },
    { "id": "s4", "title": "...", "prompt": "...", "question": "...", "type": "choice", "options": [ ... 4 lựa chọn ... ] },
    { "id": "s5", "title": "...", "prompt": "...", "question": "...", "type": "number", "correctAnswer": 0 }
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
  const expectedTypes = { s1: "choice", s2: "choice", s3: "text", s4: "choice", s5: "number" };
  for (const sc of data.scenarios) {
    if (!sc || !expectedTypes[sc.id] || sc.type !== expectedTypes[sc.id]) return false;
    if (sc.type === "choice" && (!Array.isArray(sc.options) || sc.options.length < 2)) return false;
    if (sc.type === "number" && typeof sc.correctAnswer !== "number") return false;
  }
  return true;
}

// Gọi AI để soạn 1 bộ đề mới theo tiêu chí. Ném lỗi nếu gọi AI thất bại hoặc JSON không hợp lệ
// (nơi gọi hàm này nên tự bắt lỗi và dùng DEFAULT_ACDI_GROUPS/DEFAULT_SCENARIOS làm phương án dự phòng).
export async function generateTestWithAI(criteria) {
  const cfg = await getApiConfig();
  const raw = await callAiApi({
    endpoint: cfg.endpoint, apiKey: cfg.apiKey, model: cfg.model,
    messages: [{ role: "user", content: GENERATION_INSTRUCTION_TEMPLATE(criteria) }],
    maxTokens: 4000,
  });
  const cleaned = String(raw).replace(/```json|```/g, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error("Không parse được JSON đề thi từ AI: " + cleaned.slice(0, 300));
  }
  if (!validateGeneratedTest(parsed)) {
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
