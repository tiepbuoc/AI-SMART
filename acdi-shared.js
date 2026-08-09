// acdi-shared.js
// Lõi dùng chung cho hệ thống ACDI Check: ngân hàng câu hỏi, công thức tính điểm,
// mô hình 4 mức độ, và các hàm đọc/ghi Firestore.
//
// ACDI Check ĐỘC LẬP với AI SMART: không dùng chatbot, Learning Passport,
// Chrome Extension hay chức năng quản lí lớp học — chỉ đo lường mức độ lệ thuộc
// nhận thức vào AI qua bảng hỏi + nhiệm vụ tình huống, chấm điểm bằng công thức
// cố định trong JavaScript (không gọi API mô hình ngôn ngữ nào).

import { db } from "./firebase-config.js";
import {
  collection, addDoc, getDocs, getDoc, doc, query, orderBy, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ============ 0. THANG LIKERT DÙNG CHUNG ============
export const LIKERT_OPTIONS = [
  { value: 1, label: "Hoàn toàn không đúng" },
  { value: 2, label: "Phần lớn không đúng" },
  { value: 3, label: "Đúng một phần" },
  { value: 4, label: "Phần lớn đúng" },
  { value: 5, label: "Hoàn toàn đúng" },
];

// ============ 1. BẢNG HỎI ACDI — 5 nhóm chỉ báo x 5 câu = 25 câu ============
// reverse:true = câu hỏi mang tính "độc lập" (Likert càng cao thì càng ÍT lệ thuộc),
// cần đảo điểm để điểm ACDI luôn tăng theo mức độ lệ thuộc nhận thức, đúng như mô tả:
// "Các câu hỏi tích cực được đảo điểm để bảo đảm điểm ACDI càng cao thì mức độ lệ
// thuộc nhận thức càng lớn."
export const ACDI_GROUPS = [
  {
    key: "start",
    title: "Phụ thuộc khi bắt đầu nhiệm vụ",
    desc: "Mức độ cần AI để xác định cách làm hoặc khởi động một nhiệm vụ.",
    questions: [
      { id: "g1q1", text: "Tôi thường hỏi AI ngay khi nhận được một bài tập khó.", reverse: false },
      { id: "g1q2", text: "Tôi khó bắt đầu làm bài nếu không có AI gợi ý.", reverse: false },
      { id: "g1q3", text: "Tôi thường chờ AI đưa ra hướng giải quyết trước khi tự nghĩ.", reverse: false },
      { id: "g1q4", text: "Tôi cảm thấy lo lắng nếu phải bắt đầu một nhiệm vụ mà không có AI hỗ trợ.", reverse: false },
      { id: "g1q5", text: "Tôi ít khi tự đọc kỹ đề bài trước khi mở công cụ AI.", reverse: false },
    ],
  },
  {
    key: "idea",
    title: "Phụ thuộc về ý tưởng",
    desc: "Khả năng tự hình thành ý tưởng, dàn ý hoặc phương án giải quyết.",
    questions: [
      { id: "g2q1", text: "Tôi thường nhờ AI nghĩ ý tưởng thay mình.", reverse: false },
      { id: "g2q2", text: "Tôi khó tự lập dàn ý nếu không có AI.", reverse: false },
      { id: "g2q3", text: "Tôi thường chọn ý tưởng của AI mà không phát triển ý tưởng riêng.", reverse: false },
      { id: "g2q4", text: "Tôi hiếm khi đưa ra ý tưởng của riêng mình trước khi hỏi AI.", reverse: false },
      { id: "g2q5", text: "Tôi thấy khó nghĩ ra hướng giải quyết mới nếu không tham khảo AI trước.", reverse: false },
    ],
  },
  {
    key: "process",
    title: "Phụ thuộc trong xử lí nhiệm vụ",
    desc: "Mức độ giao cho AI thực hiện phân tích, lập luận hoặc hoàn thành sản phẩm.",
    questions: [
      { id: "g3q1", text: "Tôi thường nhờ AI làm phần khó nhất của bài tập.", reverse: false },
      { id: "g3q2", text: "Tôi sử dụng câu trả lời của AI ngay cả khi chưa hiểu rõ.", reverse: false },
      { id: "g3q3", text: "Tôi ít tự tìm cách giải khác sau khi AI đã đưa ra đáp án.", reverse: false },
      { id: "g3q4", text: "Tôi thường để AI hoàn thành phần lớn bài làm rồi chỉ chỉnh sửa lại.", reverse: false },
      { id: "g3q5", text: "Tôi hiếm khi tự phân tích vấn đề trước khi để AI xử lí.", reverse: false },
    ],
  },
  {
    key: "trust",
    title: "Phụ thuộc vào kết quả của AI",
    desc: "Mức độ tin tưởng và chấp nhận câu trả lời AI mà không kiểm tra.",
    questions: [
      { id: "g4q1", text: "Tôi thường cho rằng câu trả lời của AI là đúng.", reverse: false },
      { id: "g4q2", text: "Tôi ít kiểm tra thông tin AI bằng sách hoặc nguồn khác.", reverse: false },
      { id: "g4q3", text: "Tôi khó phát hiện điểm chưa hợp lí trong câu trả lời của AI.", reverse: false },
      { id: "g4q4", text: "Tôi thường nộp bài ngay sau khi nhận được câu trả lời từ AI mà không xem lại.", reverse: false },
      { id: "g4q5", text: "Tôi tin tưởng AI hơn là tự kiểm tra lại bằng kiến thức của mình.", reverse: false },
    ],
  },
  {
    key: "independence",
    title: "Khả năng hoạt động khi không có AI",
    desc: "Khả năng ghi nhớ, giải thích, vận dụng và tự hoàn thành nhiệm vụ khi AI không còn hỗ trợ.",
    questions: [
      { id: "g5q1", text: "Tôi có thể giải thích lại nội dung do AI hỗ trợ bằng lời của mình.", reverse: true },
      { id: "g5q2", text: "Tôi có thể làm một bài tương tự mà không cần AI.", reverse: true },
      { id: "g5q3", text: "Sau khi dùng AI, tôi vẫn nhớ được cách giải quyết vấn đề.", reverse: true },
      { id: "g5q4", text: "Tôi vẫn hoàn thành được nhiệm vụ nếu không có AI, dù mất nhiều thời gian hơn.", reverse: true },
      { id: "g5q5", text: "Tôi có thể tự kiểm tra lại kết quả của mình mà không cần AI xác nhận.", reverse: true },
    ],
  },
];

export function allQuestionIds() {
  return ACDI_GROUPS.flatMap((g) => g.questions.map((q) => q.id));
}

// Điểm 1 câu quy về thang 0-100, đã đảo điểm nếu cần (reverse:true)
function scoreQuestion(q, rawValue) {
  const v = q.reverse ? 6 - rawValue : rawValue;
  return ((v - 1) / 4) * 100;
}

// Điểm từng nhóm chỉ báo (0-100)
export function computeDimensionScores(answers) {
  const dimensionScores = {};
  ACDI_GROUPS.forEach((g) => {
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

// ============ 2. NHIỆM VỤ TÌNH HUỐNG (5 tình huống) ============
// Toàn bộ được chấm bằng công thức/logic cố định trong JS — không dùng AI để chấm.

export const SCENARIOS = [
  {
    id: "s1",
    title: "Tình huống 1 · Phát hiện lỗi trong câu trả lời AI",
    prompt:
      "AI trả lời câu hỏi \"Tính diện tích hình chữ nhật có chiều dài 8cm và chiều rộng 3cm\" như sau:",
    aiAnswer: "\"Diện tích hình chữ nhật là 8 + 3 = 11 cm².\"",
    question: "Theo bạn, câu trả lời trên có vấn đề gì?",
    type: "choice",
    options: [
      { id: "a", text: "Câu trả lời đúng, không có vấn đề gì.", risk: 100 },
      { id: "b", text: "Phép tính sai: phải nhân 8 × 3 = 24 cm², không phải cộng lại.", risk: 0 },
      { id: "c", text: "Chỉ sai đơn vị, phải là cm chứ không phải cm².", risk: 70 },
      { id: "d", text: "Không chắc, cứ tin theo AI vì AI thường đúng.", risk: 100 },
    ],
  },
  {
    id: "s2",
    title: "Tình huống 2 · Kiểm chứng nguồn thông tin",
    prompt: "Bạn vừa nhận được một câu trả lời từ AI và muốn kiểm chứng lại. Bạn sẽ ưu tiên kiểm tra bằng nguồn nào?",
    question: "Chọn nguồn bạn thấy đáng tin cậy nhất để đối chiếu:",
    type: "choice",
    options: [
      { id: "a", text: "Một bài đăng ẩn danh trên mạng xã hội có nội dung tương tự.", risk: 90 },
      { id: "b", text: "Sách giáo khoa hoặc tài liệu do giáo viên cung cấp.", risk: 0 },
      { id: "c", text: "Một video ngắn giải trí không rõ nguồn gốc.", risk: 90 },
      { id: "d", text: "Hỏi lại chính AI đó xem câu trả lời trước có đúng không.", risk: 60 },
    ],
  },
  {
    id: "s3",
    title: "Tình huống 3 · Giải thích bằng lời của bản thân",
    prompt: "AI giải thích khái niệm sau:",
    aiAnswer:
      "\"Quang hợp là quá trình cây xanh sử dụng ánh sáng mặt trời, nước và khí carbon dioxide để tạo ra glucose và khí oxy, nhờ chất diệp lục trong lá cây.\"",
    question: "Hãy viết lại cách hiểu của bạn về khái niệm trên bằng lời của chính mình (ít nhất một câu):",
    type: "text",
  },
  {
    id: "s4",
    title: "Tình huống 4 · Lựa chọn cách sử dụng AI",
    prompt: "Khi gặp một bài tập khó, bạn thường có xu hướng làm gì nhất?",
    question: "Chọn cách bạn thường làm nhất:",
    type: "choice",
    options: [
      { id: "a", text: "Tự làm trước, sau đó nhờ AI nhận xét và góp ý.", risk: 10 },
      { id: "b", text: "Xin AI gợi ý từng bước để tự hoàn thành.", risk: 45 },
      { id: "c", text: "Xin AI đáp án hoàn chỉnh ngay từ đầu.", risk: 85 },
      { id: "d", text: "Sao chép trực tiếp câu trả lời của AI để nộp bài.", risk: 100 },
    ],
  },
  {
    id: "s5",
    title: "Tình huống 5 · Tự giải quyết khi không có AI",
    prompt: "Hãy tự giải bài toán ngắn sau (không dùng AI, máy tính hay tra cứu):",
    question: "Một quyển sách có 240 trang. Nếu đọc đều 24 trang mỗi ngày thì cần bao nhiêu ngày để đọc hết? (nhập một số)",
    type: "number",
    correctAnswer: 10,
  },
];

// Chấm điểm nguy cơ (0-100) cho từng tình huống dựa trên câu trả lời của học sinh
export function scoreScenario(scenario, answer) {
  if (scenario.type === "choice") {
    const opt = scenario.options.find((o) => o.id === answer);
    return opt ? opt.risk : 100; // chưa chọn / chọn không hợp lệ -> coi như rủi ro cao nhất
  }
  if (scenario.type === "number") {
    const num = Number(answer);
    if (Number.isNaN(num)) return 100;
    return num === scenario.correctAnswer ? 0 : 100;
  }
  if (scenario.type === "text") {
    return scoreOwnWordsExplanation(scenario.aiAnswer || "", String(answer || ""));
  }
  return 100;
}

// Tình huống 3: so khớp mức độ trùng lặp từ ngữ với đoạn giải thích gốc của AI.
// Trùng lặp càng cao (gần như chép lại) => rủi ro càng cao. Trả lời quá ngắn cũng bị
// coi là chưa thực sự tự diễn đạt lại.
function scoreOwnWordsExplanation(aiText, studentText) {
  const normalize = (s) =>
    s
      .toLowerCase()
      .normalize("NFC")
      .replace(/[.,!?;:"'()\u201c\u201d]/g, "")
      .split(/\s+/)
      .filter(Boolean);
  const studentWords = normalize(studentText);
  if (studentWords.length < 8) return 80;
  const aiWords = new Set(normalize(aiText));
  const overlapCount = studentWords.filter((w) => aiWords.has(w)).length;
  const overlapRatio = overlapCount / studentWords.length;
  return Math.max(0, Math.min(100, Math.round(overlapRatio * 100)));
}

export function computeScenarioScores(scenarioAnswers) {
  const perScenario = {};
  SCENARIOS.forEach((sc) => {
    perScenario[sc.id] = scoreScenario(sc, scenarioAnswers[sc.id]);
  });
  const vals = Object.values(perScenario);
  const overall = vals.reduce((s, x) => s + x, 0) / vals.length;
  return { perScenario, overall };
}

// ============ 3. CÔNG THỨC ACDI ============
// ACDI = 0,7 × Điểm lệ thuộc tự đánh giá (bảng hỏi) + 0,3 × Điểm nguy cơ từ tình huống
export const QUESTIONNAIRE_WEIGHT = 0.7;
export const SCENARIO_WEIGHT = 0.3;

export function computeAcdiScore(questionnaireScore, scenarioScore) {
  const raw = QUESTIONNAIRE_WEIGHT * questionnaireScore + SCENARIO_WEIGHT * scenarioScore;
  return Math.round(raw * 10) / 10;
}

// ============ 4. MÔ HÌNH BỐN MỨC ĐỘ ============
export const LEVEL_INFO = {
  1: {
    title: "Sử dụng AI có kiểm soát",
    range: "0–24",
    color: "#1f9d6c",
    desc: "Bạn chủ động suy nghĩ, có khả năng kiểm chứng và vẫn hoàn thành nhiệm vụ khi không có AI. AI chưa thay thế đáng kể các hoạt động nhận thức của bạn.",
  },
  2: {
    title: "Có dấu hiệu dựa vào AI",
    range: "25–49",
    color: "#f39c12",
    desc: "Bạn sử dụng AI thường xuyên để tìm ý tưởng hoặc định hướng, nhưng vẫn còn khả năng tự xử lí và điều chỉnh kết quả.",
  },
  3: {
    title: "Lệ thuộc AI",
    range: "50–74",
    color: "#e67e22",
    desc: "Bạn thường để AI thực hiện các phần quan trọng của nhiệm vụ, ít kiểm chứng và có thể gặp khó khăn khi phải tự giải thích hoặc làm lại.",
  },
  4: {
    title: "Nguy cơ lệ thuộc AI cao",
    range: "75–100",
    color: "#e74c3c",
    desc: "AI đang có xu hướng thay thế phần lớn hoạt động tư duy của bạn. Bạn có thể thấy khó bắt đầu, giải quyết và hoàn thành nhiệm vụ nếu không có sự hỗ trợ của AI.",
  },
};

export function classifyLevel(acdi) {
  if (acdi < 25) return 1;
  if (acdi < 50) return 2;
  if (acdi < 75) return 3;
  return 4;
}

// ============ 5. KHUYẾN NGHỊ CÁ NHÂN ============
// Diễn đạt nhẹ nhàng, không dùng các từ như "mất khả năng tư duy", "bị bệnh",
// "rỗng não nghiêm trọng" để tránh gây lo lắng và dán nhãn học sinh.
const GROUP_TIPS = {
  start: "Hãy thử dành 2–3 phút tự đọc kỹ đề bài và phác thảo hướng làm trước khi mở công cụ AI.",
  idea: "Hãy dành khoảng 5–10 phút tự viết ra các ý tưởng ban đầu của riêng mình trước khi tham khảo AI.",
  process: "Hãy thử tự làm phần khó trước, chỉ xin AI gợi ý đúng chỗ mình thực sự vướng.",
  trust: "Hãy tập thói quen đối chiếu câu trả lời của AI với ít nhất một nguồn khác trước khi dùng.",
  independence: "Hãy thử làm lại một bài tương tự mà không dùng AI, để kiểm tra mức độ mình đã thực sự nắm được cách làm.",
};

export function groupTitle(key) {
  return ACDI_GROUPS.find((g) => g.key === key)?.title || key;
}

export function buildRecommendation(dimensionScores) {
  const entries = Object.entries(dimensionScores);
  const highest = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
  const lowest = entries.reduce((a, b) => (b[1] < a[1] ? b : a));
  return {
    highestRiskGroupKey: highest[0],
    highestRiskGroup: groupTitle(highest[0]),
    bestMaintainedGroupKey: lowest[0],
    bestMaintainedGroup: groupTitle(lowest[0]),
    tip: GROUP_TIPS[highest[0]],
  };
}

// ============ 6. MÃ NGƯỜI THAM GIA (ẨN DANH) ============
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function generateParticipantCode(len = 8) {
  let out = "";
  for (let i = 0; i < len; i++) out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return out;
}

// ============ 7. FIRESTORE ============
// assessments/{assessmentId} -> xem cấu trúc trong tài liệu mô tả hệ thống (mục 4.10)
export async function saveAssessment(data) {
  const ref = await addDoc(collection(db, "assessments"), {
    ...data,
    createdAt: serverTimestamp(),
  });
  return ref.id;
}

// Trang quản trị nghiên cứu: lấy toàn bộ kết quả (không có thông tin định danh)
export async function listAssessments() {
  const snap = await getDocs(query(collection(db, "assessments"), orderBy("createdAt", "desc")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Kiểm tra tài khoản đăng nhập có nằm trong danh sách quản trị nghiên cứu hay không.
// Tài khoản quản trị được thêm thủ công vào collection `admins/{uid}` (không có form tự đăng ký,
// để đảm bảo chỉ nhóm nghiên cứu mới truy cập được trang quản trị).
export async function isResearchAdmin(uid) {
  const snap = await getDoc(doc(db, "admins", uid));
  return snap.exists();
}
