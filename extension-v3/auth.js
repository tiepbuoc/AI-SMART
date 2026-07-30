// auth.js
// Xử lý đăng nhập / đăng ký / đăng xuất bằng Firebase Auth,
// và đồng bộ các câu hỏi đã lưu cục bộ (chrome.storage.local) lên Firestore
// theo từng tài khoản: users/{uid}/entries/{entryId}

let currentUser = null;

function setAuthMessage(msg, isError = true) {
  const el = document.getElementById("authMessage");
  el.textContent = msg || "";
  el.style.color = isError ? "#b3261e" : "#2e7d32";
}

function showLoggedInUI(user) {
  document.getElementById("authSection").style.display = "none";
  document.getElementById("mainSection").style.display = "flex";
  document.getElementById("currentEmail").textContent = user.email;
}

function showLoggedOutUI() {
  document.getElementById("authSection").style.display = "block";
  document.getElementById("mainSection").style.display = "none";
}

// Đồng bộ các mục CHƯA được đánh dấu synced lên Firestore của user hiện tại
async function syncLocalEntriesToFirestore(uid) {
  const data = await chrome.storage.local.get({ entries: [] });
  const entries = data.entries || [];
  const unsynced = entries.filter((e) => !e.synced);

  if (unsynced.length === 0) {
    setSyncStatus("Đã đồng bộ đầy đủ.");
    return;
  }

  setSyncStatus(`Đang đồng bộ ${unsynced.length} mục...`);

  const batchSize = 400; // an toàn dưới giới hạn 500 write/batch của Firestore
  for (let i = 0; i < unsynced.length; i += batchSize) {
    const chunk = unsynced.slice(i, i + batchSize);
    const batch = db.batch();
    chunk.forEach((entry) => {
      const ref = db
        .collection("users")
        .doc(uid)
        .collection("entries")
        .doc(entry.id);
      batch.set(
        ref,
        {
          site: entry.site,
          text: entry.text,
          time: entry.time,
          url: entry.url || null,
          analyzed: entry.analyzed === true, // giữ nguyên trạng thái phân tích nếu có
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });
    await batch.commit();
  }

  // Đánh dấu đã đồng bộ trong storage local
  const updated = entries.map((e) =>
    unsynced.find((u) => u.id === e.id) ? { ...e, synced: true } : e
  );
  await chrome.storage.local.set({ entries: updated });

  setSyncStatus(`Đã đồng bộ xong ${unsynced.length} mục.`);
}

function setSyncStatus(msg) {
  const el = document.getElementById("syncStatus");
  if (el) el.textContent = msg;
}

// ---- Consent (người dùng phải bật mới đồng bộ dữ liệu hành vi lên Firebase) ----
async function hasSyncConsent() {
  const data = await chrome.storage.local.get({ syncConsent: false });
  return data.syncConsent === true;
}

async function setSyncConsent(value) {
  await chrome.storage.local.set({ syncConsent: value });
}

// ---- Đồng bộ cấu hình API (endpoint/model/apiKey) từ Firestore về chrome.storage.local
// để content-script / background.js (không dùng Firebase) có thể dùng để gọi API viết lại SMART.
async function cacheApiConfigLocally(uid) {
  try {
    const snap = await db.collection("users").doc(uid).collection("settings").doc("apiConfig").get();
    if (snap.exists) {
      await chrome.storage.local.set({ apiConfig: snap.data() });
    }
  } catch (e) {
    console.error("Không tải được cấu hình API:", e);
  }
}

// ---- Auth state ----
auth.onAuthStateChanged(async (user) => {
  currentUser = user;
  if (user) {
    showLoggedInUI(user);
    await cacheApiConfigLocally(user.uid);
    const consentEl = document.getElementById("consentCheckbox");
    if (consentEl) consentEl.checked = await hasSyncConsent();
    if (await hasSyncConsent()) {
      syncLocalEntriesToFirestore(user.uid);
    } else {
      setSyncStatus("Đồng bộ đang TẮT. Bật ở ô bên dưới nếu muốn gửi dữ liệu cho AI Learning Passport.");
    }
  } else {
    showLoggedOutUI();
  }
});

document.getElementById("consentCheckbox")?.addEventListener("change", async (e) => {
  await setSyncConsent(e.target.checked);
  if (e.target.checked && currentUser) {
    syncLocalEntriesToFirestore(currentUser.uid);
  } else {
    setSyncStatus("Đồng bộ đang TẮT.");
  }
});

// ---- Form handlers ----
document.getElementById("loginBtn").addEventListener("click", async () => {
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;
  setAuthMessage("");
  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (err) {
    setAuthMessage(translateFirebaseError(err));
  }
});

document.getElementById("signupBtn").addEventListener("click", async () => {
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;
  setAuthMessage("");
  if (password.length < 6) {
    setAuthMessage("Mật khẩu phải có ít nhất 6 ký tự.");
    return;
  }
  try {
    await auth.createUserWithEmailAndPassword(email, password);
  } catch (err) {
    setAuthMessage(translateFirebaseError(err));
  }
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await auth.signOut();
});

document.getElementById("syncNowBtn").addEventListener("click", async () => {
  if (!currentUser) return;
  if (!(await hasSyncConsent())) {
    setSyncStatus("Vui lòng bật ô đồng ý đồng bộ dữ liệu trước.");
    return;
  }
  syncLocalEntriesToFirestore(currentUser.uid);
});

function translateFirebaseError(err) {
  const code = err && err.code;
  const map = {
    "auth/email-already-in-use": "Email này đã được đăng ký.",
    "auth/invalid-email": "Email không hợp lệ.",
    "auth/weak-password": "Mật khẩu quá yếu (tối thiểu 6 ký tự).",
    "auth/user-not-found": "Tài khoản không tồn tại.",
    "auth/wrong-password": "Sai mật khẩu.",
    "auth/invalid-credential": "Email hoặc mật khẩu không đúng.",
    "auth/too-many-requests": "Bạn thử sai quá nhiều lần, vui lòng thử lại sau.",
  };
  return map[code] || (err && err.message) || "Có lỗi xảy ra, vui lòng thử lại.";
}
