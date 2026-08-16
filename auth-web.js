// auth-web.js
// Xử lý đăng nhập/đăng ký dùng chung cho mọi trang trong website.

import { auth, db } from "./firebase-config.js";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc, setDoc, getDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

export function translateFirebaseError(err) {
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

export function login(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

// role: "student" | "teacher"
export async function signup(email, password, role = "student") {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await setDoc(doc(db, "users", cred.user.uid), {
    email,
    role: role === "teacher" ? "teacher" : "student",
    classId: null, // học sinh sẽ điền khi tham gia lớp; giáo viên không dùng field này
    createdAt: serverTimestamp(),
  });
  return cred;
}

export function logout() {
  return signOut(auth);
}

export function watchAuth(onLogin, onLogout) {
  return onAuthStateChanged(auth, (user) => {
    if (user) onLogin(user);
    else onLogout();
  });
}

// Lấy hồ sơ (role, classId...) của user hiện tại. Trả về { role: "student", classId: null } nếu chưa có hồ sơ
// (ví dụ tài khoản được tạo trước khi tính năng phân vai trò ra đời).
export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return { role: "student", classId: null };
  const data = snap.data();
  return { role: data.role === "teacher" ? "teacher" : "student", classId: data.classId || null };
}

// ---- Cấu hình API cố định (theo yêu cầu, không cần trang Cài đặt nữa) ----
const FIXED_API_CONFIG = {
  endpoint: "https://api.shopaikey.com/v1",
  model: "gpt-5-nano",
  apiKey: "sk-uQmI5tk7o5FdWLq852gCLO2xZTd5OmG2K9RKy7C3raEqGx6v",
};

export async function getApiConfig() {
  return FIXED_API_CONFIG;
}
