// smart-shared.js
// Dùng chung cho chatbot.html và passport.html
// Chứa: system prompt AI SMART 5 bước, hàm gọi API, và định nghĩa schema ACI.

// ============ 1. SYSTEM PROMPT CHO CHATBOT AI SMART (5 bước S-M-A-R-T) ============
export const SMART_SYSTEM_PROMPT = `Bạn là gia sư AI theo phương pháp "AI SMART" gồm 5 bước: State - Missing - Assist - Resolve - Test.

QUY TẮC BẮT BUỘC:
1. State: Khi học sinh đặt câu hỏi, hãy xác nhận lại ngắn gọn vấn đề và những gì học sinh đã thử/đã nhớ (nếu học sinh có nói).
2. Missing: Xác định chính xác phần kiến thức hoặc kỹ năng học sinh đang thiếu hoặc chưa chắc.
3. Assist: CHỈ gợi ý đúng phần còn thiếu đó (công thức, khái niệm, hướng đi, câu hỏi dẫn dắt). TUYỆT ĐỐI KHÔNG giải toàn bộ bài hoặc đưa đáp án cuối cùng ở bước này.
4. Resolve: Yêu cầu học sinh tự áp dụng gợi ý để tự đưa ra lời giải/kết quả của riêng mình.
5. Test: Khi học sinh gửi kết quả họ tự làm, hãy kiểm tra đúng/sai, giải thích rõ vì sao đúng hoặc sai, có thể chỉ ra lỗi sai cụ thể nếu có.

- Không bao giờ đưa đáp án cuối cùng ngay lần đầu tiên nếu học sinh chưa tự thử.
- Nếu học sinh chỉ hỏi kiến thức lý thuyết đơn thuần (không phải bài tập cần giải), có thể trả lời trực tiếp nhưng vẫn khuyến khích tư duy thêm.
- Giọng văn thân thiện, ngắn gọn, đúng trọng tâm, phù hợp học sinh.`;

// ============ 2. SCHEMA 5 SỐ CHO MỖI PROMPT (AI Crutch Index) ============
// Mỗi prompt sau khi phân tích sẽ trả về 1 mảng đúng 5 số theo thứ tự cố định:
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

// ============ 3. HÀM GỌI API (dùng chung, theo định dạng OpenAI-compatible) ============
export async function callAiApi({ endpoint, apiKey, model, messages, maxTokens = 1024 }) {
  const cleanEndpoint = endpoint.trim().replace(/\/$/, "");
  const res = await fetch(`${cleanEndpoint}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + apiKey,
    },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`HTTP ${res.status}: ${errText}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? "";
}

// ============ 4. PHÂN TÍCH HÀNG LOẠT PROMPT CHƯA ĐƯỢC PHÂN TÍCH ============
// Gửi 1 lần nhiều prompt, yêu cầu model trả về JSON là mảng các mảng 5 số,
// đúng theo thứ tự đầu vào, để tiết kiệm số lần gọi API.
export async function analyzePromptsBatch({ endpoint, apiKey, model, prompts }) {
  const numberedList = prompts
    .map((p, i) => `${i + 1}. """${p.replace(/"""/g, '"')}"""`)
    .join("\n");

  const instruction = `Bạn là bộ máy phân tích prompt học sinh gửi cho AI. Với MỖI prompt dưới đây, hãy chấm 5 chỉ số theo đúng thứ tự:
1) aci (0-100): mức độ phụ thuộc/ỷ lại vào AI thể hiện qua prompt (100 = muốn AI làm hộ hoàn toàn, 0 = chỉ xin gợi ý nhỏ, đã tự làm phần lớn)
2) complexity (0-100): độ phức tạp của câu hỏi/vấn đề
3) effort (0-100): mức độ nỗ lực tự thân thể hiện trong prompt (đã nêu mình thử gì, vướng ở đâu...)
4) subjectCode (số nguyên 0-5): 0=Toán,1=Lý,2=Hóa,3=Văn,4=Anh,5=Khác
5) riskScore (0-100): nguy cơ học sinh dùng AI để né việc tự học

Danh sách prompt:
${numberedList}

CHỈ trả lời bằng một mảng JSON hợp lệ, không kèm giải thích, không markdown, không backticks. Định dạng:
[[aci,complexity,effort,subjectCode,riskScore], [aci,complexity,effort,subjectCode,riskScore], ...]
Số phần tử của mảng ngoài PHẢI đúng bằng số prompt (${prompts.length}), đúng thứ tự.`;

  const raw = await callAiApi({
    endpoint,
    apiKey,
    model,
    messages: [{ role: "user", content: instruction }],
    maxTokens: 1500,
  });

  const cleaned = raw.replace(/```json|```/g, "").trim();
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    throw new Error("Không parse được JSON từ model. Nội dung trả về: " + raw.slice(0, 300));
  }

  if (!Array.isArray(parsed) || parsed.length !== prompts.length) {
    throw new Error(
      `Model trả về ${Array.isArray(parsed) ? parsed.length : "?"} mục, cần đúng ${prompts.length}.`
    );
  }

  return parsed;
}
