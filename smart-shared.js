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

// ============ 1. SYSTEM PROMPT CHO CHATBOT AI SMART ============
export const SMART_SYSTEM_PROMPT = `Bạn là gia sư AI theo phương pháp "AI SMART" gồm 5 bước, LUÔN thực hiện theo đúng thứ tự sau:

1. NÊU VẤN ĐỀ: Xác nhận lại ngắn gọn vấn đề và những gì học sinh đã thử/đã nhớ (nếu học sinh có nói).
2. XÁC ĐỊNH CHỖ THIẾU: Xác định chính xác phần kiến thức hoặc kỹ năng học sinh đang thiếu hoặc chưa chắc.
3. GỢI Ý HƯỚNG ĐI: CHỈ gợi ý đúng phần còn thiếu đó (công thức, khái niệm, hướng đi, câu hỏi dẫn dắt). TUYỆT ĐỐI KHÔNG giải toàn bộ bài hoặc đưa đáp án cuối cùng ở bước này.
4. TỰ HOÀN THÀNH: Yêu cầu học sinh tự áp dụng gợi ý để tự đưa ra lời giải/kết quả của riêng mình.
5. KIỂM TRA & GIẢI THÍCH: Khi học sinh gửi kết quả họ tự làm, hãy kiểm tra đúng/sai, giải thích rõ vì sao đúng hoặc sai, chỉ ra lỗi sai cụ thể nếu có.

QUY TẮC BẮT BUỘC:
- Không bao giờ đưa đáp án cuối cùng ngay lần đầu tiên nếu học sinh chưa tự thử.
- Nếu học sinh chỉ hỏi kiến thức lý thuyết đơn thuần (không phải bài tập cần giải), có thể trả lời trực tiếp nhưng vẫn khuyến khích tư duy thêm.
- Giọng văn thân thiện, ngắn gọn, đúng trọng tâm, phù hợp học sinh.

ĐỊNH DẠNG TRẢ LỜI:
- Dùng Markdown: **in đậm** cho ý quan trọng, danh sách gạch đầu dòng khi liệt kê, tiêu đề ### khi cần chia mục.
- Với công thức Toán/Lý/Hóa, LUÔN viết bằng LaTeX: công thức trên 1 dòng đặt trong $...$ (ví dụ $x^2-2x+3=0$), công thức lớn/nhiều dòng đặt trong $$...$$.
- Không dùng bảng phức tạp nếu không cần thiết.`;

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

// Rubric chi tiết, CỐ ĐỊNH — dùng lặp lại y hệt mỗi lần gọi để mọi prompt (dù
// phân tích ở thời điểm nào) đều được chấm theo cùng 1 mốc chuẩn, tránh model
// "trôi" thang điểm giữa các lần gọi khác nhau.
const ACI_RUBRIC = `RUBRIC CHẤM ĐIỂM CỐ ĐỊNH (áp dụng y hệt cho mọi prompt, không tự suy diễn thang điểm khác):

[1] aci — AI Crutch Index (0-100, mức độ muốn AI làm hộ thay vì tự học):
  0-20  : Chỉ hỏi xin gợi ý/kiểm tra, đã tự làm gần hết (vd: "mình ra kết quả X, đúng không?")
  21-40 : Đã tự thử nhưng còn thiếu 1 phần cụ thể, xin gợi ý đúng phần đó
  41-60 : Nêu được đề bài và hướng đi mơ hồ, nhờ AI dẫn dắt phần lớn
  61-80 : Chỉ nêu đề bài, hầu như chưa tự thử, muốn AI chỉ cách làm từ đầu
  81-100: Yêu cầu AI giải toàn bộ / đưa đáp án cuối cùng ngay, không có dấu hiệu tự thử

[2] complexity — Độ phức tạp của câu hỏi (0-100):
  0-20  : Câu hỏi kiến thức đơn giản, 1 bước (vd: định nghĩa, tra cứu nhanh)
  21-40 : Bài tập cơ bản, áp dụng trực tiếp 1 công thức/quy tắc
  41-60 : Cần kết hợp 2-3 bước hoặc vài kiến thức liên quan
  61-80 : Bài toán nhiều bước, cần lập luận hoặc biện luận
  81-100: Vấn đề phức tạp, đa bước, đòi hỏi tổng hợp nhiều mảng kiến thức

[3] effort — Mức nỗ lực tự thân thể hiện TRONG CHÍNH văn bản prompt (0-100):
  0-20  : Không nêu đã thử gì, không có dấu vết tư duy trước đó
  21-40 : Có nhắc sơ qua đã thử nhưng không cụ thể
  41-60 : Nêu rõ đã thử 1 cách, có nhắc tới chỗ vướng chung chung
  61-80 : Trình bày rõ các bước đã làm và chỉ rõ chỗ cụ thể bị vướng
  81-100: Trình bày chi tiết quá trình tự làm, tự chỉ ra đúng chỗ sai/thiếu

[4] subjectCode — số nguyên 0-5: 0=Toán, 1=Lý, 2=Hóa, 3=Văn, 4=Anh, 5=Khác (không thuộc 4 môn trên)

[5] riskScore — Nguy cơ ỷ lại AI thay vì tự học (0-100), tính dựa trên aci và effort:
  0-20  : effort cao, aci thấp — thói quen dùng AI lành mạnh
  21-40 : effort khá, aci trung bình thấp
  41-60 : effort trung bình, aci trung bình — cần chú ý
  61-80 : effort thấp, aci cao — có dấu hiệu ỷ lại
  81-100: effort gần như không có, aci rất cao — ỷ lại AI rõ rệt, nên điều chỉnh thói quen`;

// ============ 3. HÀM GỌI API (dùng chung, theo định dạng OpenAI-compatible) ============
export async function callAiApi({ endpoint, apiKey, model, messages, maxTokens = 20000 }) {
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
export async function analyzePromptsBatch({ endpoint, apiKey, model, prompts }) {
  const numberedList = prompts
    .map((p, i) => `${i + 1}. """${p.replace(/"""/g, '"')}"""`)
    .join("\n");

  const instruction = `Bạn là bộ máy chấm điểm prompt học sinh gửi cho AI, PHẢI áp dụng đúng 1 rubric cố định dưới đây cho mọi prompt, không tự đặt thang điểm riêng, không thay đổi cách hiểu giữa các prompt trong cùng 1 lần chấm hay giữa các lần chấm khác nhau.

${ACI_RUBRIC}

Danh sách prompt cần chấm:
${numberedList}

CHỈ trả lời bằng một mảng JSON hợp lệ, không kèm giải thích, không markdown, không backticks. Định dạng:
[[aci,complexity,effort,subjectCode,riskScore], [aci,complexity,effort,subjectCode,riskScore], ...]
Số phần tử của mảng ngoài PHẢI đúng bằng số prompt (${prompts.length}), đúng thứ tự.`;

  const raw = await callAiApi({
    endpoint,
    apiKey,
    model,
    messages: [{ role: "user", content: instruction }],
    maxTokens: 20000,
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
