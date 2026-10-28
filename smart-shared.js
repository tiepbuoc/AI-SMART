// smart-shared.js
// Dùng chung cho chatbot.html và passport.html
// Chứa: system prompt AI SMART 5 bước (tiếng Việt), hàm gọi API,
// và rubric phân tích ACI CỐ ĐỊNH (để mọi lần chấm đều theo cùng 1 mốc chuẩn).

// ============ 0. NHÃN TIẾNG VIỆT CHO 5 BƯỚC SMART ============
// Dùng thống nhất ở mọi nơi hiển thị cho người dùng (web + extension).
export const SMART_STEPS_VI = [
  { key: "state", label: "Nêu vấn đề", desc: "Nói rõ mình đang vướng gì, đã thử gì" },
  { key: "missing", label: "Xác định chỗ thiếu", desc: "AI tìm đúng phần kiến thức còn thiếu" },
  { key: "assist", label: "Gợi ý hướng đi", desc: "AI gợi ý công thức/hướng làm, không giải hộ" },
  { key: "resolve", label: "Tự hoàn thành", desc: "Học sinh tự làm dựa trên gợi ý" },
  { key: "test", label: "Kiểm tra & Giải thích", desc: "AI chấm đúng/sai và giải thích rõ" },
];

// ============ 1. PROMPT & RUBRIC ============
// System prompt của gia sư và rubric chấm ACI đã chuyển lên n8n (node "Config") để không nằm trong mã web.

// ============ 2. RUBRIC CHUẨN CHO PHÂN TÍCH ACI (schema cố định, không đổi giữa các lần gọi) ============
// Mỗi prompt sau khi phân tích trả về đúng 5 số theo thứ tự:
export const ACI_METRIC_LABELS = [
  { key: "aci", label: "AI Crutch Index (mức phụ thuộc AI)", range: "0-100" },
  { key: "complexity", label: "Độ phức tạp câu hỏi", range: "0-100" },
  { key: "effort", label: "Mức nỗ lực tự thân thể hiện trong prompt", range: "0-100" },
  { key: "subjectCode", label: "Mã môn học (0=Toán,1=Lý,2=Hóa,3=Văn,4=Anh,5=Khác)", range: "0-5" },
  { key: "riskScore", label: "Nguy cơ ỷ lại AI thay vì tự học", range: "0-100" },
];

export function subjectCodeToLabel(code) {
  const map = ["Toán", "Lý", "Hóa", "Văn", "Anh", "Khác"];
  return map[code] ?? "Khác";
}

// ============ 3. PHÂN TÍCH HÀNG LOẠT PROMPT CHƯA ĐƯỢC PHÂN TÍCH (qua n8n) ============
// n8n giữ rubric cố định + gọi AI. Web chỉ gửi danh sách prompt, nhận lại mảng [aci,complexity,effort,subjectCode,riskScore].
import { runTask, friendlyError } from "./ai-gateway.js";

const ANALYZE_CHUNK = 25;        // số prompt mỗi lần gửi (n8n cho tối đa 40)
const MAX_PROMPT_CHARS = 2000;   // cắt prompt quá dài trước khi gửi

async function analyzeChunk(prompts) {
  const numbered = prompts
    .map((p, i) => `${i + 1}. """${String(p).slice(0, MAX_PROMPT_CHARS).replace(/"""/g, '"')}"""`)
    .join("\n");
  const message = `Số prompt cần chấm: ${prompts.length}\n\nDanh sách prompt cần chấm:\n${numbered}`;

  let raw;
  try {
    raw = await runTask("analyze", message);
  } catch (e) {
    throw new Error(friendlyError(e));
  }

  const cleaned = raw.replace(/```json|```/g, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error("Không parse được JSON từ model. Nội dung trả về: " + raw.slice(0, 300));
  }
  if (!Array.isArray(parsed) || parsed.length !== prompts.length) {
    throw new Error(`Model trả về ${Array.isArray(parsed) ? parsed.length : "?"} mục, cần đúng ${prompts.length}.`);
  }
  return parsed;
}

export async function analyzePromptsBatch({ prompts }) {
  const results = [];
  for (let i = 0; i < prompts.length; i += ANALYZE_CHUNK) {
    results.push(...(await analyzeChunk(prompts.slice(i, i + ANALYZE_CHUNK))));
  }
  return results;
}
