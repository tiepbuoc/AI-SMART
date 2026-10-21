// classes-shared.js
// Logic dùng chung cho tính năng "Lớp học" (Hướng B):
//   classes/{classId}                      -> { teacherUid, teacherEmail, code, createdAt }
//   classes/{classId}/members/{studentUid} -> { email, joinedAt, updatedAt, avgAci, avgEffort,
//                                               avgComplexity, entryCount, riskBand, lastActive }
//
// Giáo viên KHÔNG đọc trực tiếp nội dung câu hỏi (users/{uid}/entries) của học sinh — chỉ đọc
// bản tổng hợp (summary) mà học sinh tự ghi lên mỗi khi họ mở trang Passport. Việc này giữ
// quyền riêng tư cho học sinh trong khi vẫn cho giáo viên theo dõi được tình hình chung.

import { db } from "./firebase-config.js";
import {
  doc, getDoc, setDoc, addDoc, collection,
  query, where, limit, getDocs, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // bỏ ký tự dễ nhầm (0/O, 1/I...)

function randomCode(len = 6) {
  let out = "";
  for (let i = 0; i < len; i++) out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  return out;
}

// Tìm lớp học theo mã (dùng khi học sinh nhập mã để tham gia)
export async function findClassByCode(code) {
  const normalized = String(code || "").trim().toUpperCase();
  if (!normalized) return null;
  const q = query(collection(db, "classes"), where("code", "==", normalized), limit(1));
  const snap = await getDocs(q);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

// Lấy lớp hiện có của giáo viên, hoặc tự tạo lớp mới nếu chưa có (mỗi giáo viên 1 lớp trong bản MVP này)
export async function getOrCreateTeacherClass(teacherUid, teacherEmail) {
  const q = query(collection(db, "classes"), where("teacherUid", "==", teacherUid), limit(1));
  const snap = await getDocs(q);
  if (!snap.empty) {
    const d = snap.docs[0];
    return { id: d.id, ...d.data() };
  }
  // Tạo mới với mã không trùng (thử tối đa 5 lần cho chắc)
  let code = randomCode();
  for (let i = 0; i < 5; i++) {
    const existed = await findClassByCode(code);
    if (!existed) break;
    code = randomCode();
  }
  const ref = await addDoc(collection(db, "classes"), {
    teacherUid, teacherEmail, code, createdAt: serverTimestamp(),
  });
  return { id: ref.id, teacherUid, teacherEmail, code };
}

// Học sinh tham gia lớp bằng mã lớp
export async function joinClassByCode(studentUid, studentEmail, code) {
  const cls = await findClassByCode(code);
  if (!cls) throw new Error("Mã lớp học không đúng hoặc không tồn tại.");
  await setDoc(doc(db, "classes", cls.id, "members", studentUid), {
    email: studentEmail,
    joinedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    avgAci: null, avgEffort: null, avgComplexity: null, entryCount: 0,
    riskBand: null, lastActive: null,
  }, { merge: true });
  // setDoc + merge (thay vì updateDoc) vì tài khoản tạo trước khi có tính năng phân vai trò
  // (kể cả tài khoản tạo qua tiện ích Chrome) có thể CHƯA có document users/{uid} nào cả.
  await setDoc(doc(db, "users", studentUid), { classId: cls.id }, { merge: true });
  return cls;
}

// Học sinh tự cập nhật bản tổng hợp (được gọi mỗi khi Passport tính xong thống kê)
export async function pushSummaryToClass(classId, studentUid, summary) {
  if (!classId) return;
  await setDoc(doc(db, "classes", classId, "members", studentUid), {
    ...summary,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

// Giáo viên lấy danh sách học sinh trong lớp
export async function listClassMembers(classId) {
  const snap = await getDocs(collection(db, "classes", classId, "members"));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}
