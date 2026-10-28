/**
 * Cấu hình kết nối tới AI Gateway (n8n) — dùng chung với POP-AI.
 *
 * KHÔNG có API key LLM ở đây: key thật chỉ nằm trong Credentials của n8n.
 * Prompt hệ thống, rubric chấm điểm, model và giới hạn cũng do n8n quyết định (node "Config").
 */

// URL gốc của webhook n8n (không có dấu "/" ở cuối)
export const GATEWAY_BASE_URL = "https://n8nhosting-67079049.phoaify.com/webhook";
