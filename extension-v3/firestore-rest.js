// firestore-rest.js — ES module, dùng trong background.js (service worker)
// Gọi thẳng Firestore REST API + Identity Toolkit REST API bằng fetch(),
// KHÔNG dùng Firebase SDK (SDK giả định có `window`, không chạy tốt trong service worker).

const PROJECT_ID = "cdmtdc";
const WEB_API_KEY = "AIzaSyBIJ_YqEVvDiqylaCiFu32ViE4RO9YSAZw";
const ID_TOKEN_MAX_AGE_MS = 50 * 60 * 1000; // làm mới trước khi hết hạn (token sống ~1h)

// Lấy idToken còn hạn dùng (tự làm mới bằng refreshToken nếu cần)
export async function getValidIdToken() {
  const { authTokens } = await chrome.storage.local.get({ authTokens: null });
  if (!authTokens || !authTokens.refreshToken) return null;

  const isFresh = Date.now() - authTokens.obtainedAt < ID_TOKEN_MAX_AGE_MS;
  if (isFresh) return authTokens;

  try {
    const res = await fetch(`https://securetoken.googleapis.com/v1/token?key=${WEB_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(authTokens.refreshToken)}`,
    });
    if (!res.ok) throw new Error("Không làm mới được token đăng nhập");
    const data = await res.json();

    const updated = {
      ...authTokens,
      idToken: data.id_token,
      refreshToken: data.refresh_token,
      obtainedAt: Date.now(),
    };
    await chrome.storage.local.set({ authTokens: updated });
    return updated;
  } catch (e) {
    console.error("Lỗi làm mới token:", e);
    return null;
  }
}

function toFirestoreFields(obj) {
  const fields = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === null || value === undefined) {
      fields[key] = { nullValue: null };
    } else if (typeof value === "boolean") {
      fields[key] = { booleanValue: value };
    } else if (typeof value === "number") {
      fields[key] = { doubleValue: value };
    } else {
      fields[key] = { stringValue: String(value) };
    }
  }
  return fields;
}

// Ghi 1 entry lên Firestore: users/{uid}/entries/{entryId} (tạo mới hoặc merge nếu đã có)
export async function writeEntryToFirestore(uid, idToken, entry) {
  const docId = entry.id;
  const url =
    `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents/` +
    `users/${uid}/entries/${docId}?` +
    ["site", "text", "time", "url", "analyzed"].map((f) => `updateMask.fieldPaths=${f}`).join("&");

  const body = {
    fields: toFirestoreFields({
      site: entry.site,
      text: entry.text,
      time: entry.time,
      url: entry.url || "",
      analyzed: entry.analyzed === true,
    }),
  };

  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + idToken,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Firestore PATCH lỗi ${res.status}: ${errText.slice(0, 200)}`);
  }
}
