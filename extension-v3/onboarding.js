// onboarding.js
// Đăng nhập/đăng ký lần đầu. Sau khi thành công: lưu idToken + refreshToken vào
// chrome.storage.local (để background.js dùng REST API đồng bộ liên tục mà
// không cần Firebase SDK trong service worker), và bật syncConsent = true.

const formScreen = document.getElementById("formScreen");
const successScreen = document.getElementById("successScreen");
const tabLogin = document.getElementById("tabLogin");
const tabSignup = document.getElementById("tabSignup");
const emailEl = document.getElementById("email");
const passwordEl = document.getElementById("password");
const submitBtn = document.getElementById("submitBtn");
const msgEl = document.getElementById("msg");
const closeBtn = document.getElementById("closeBtn");

let mode = "login";
function setMode(m) {
  mode = m;
  tabLogin.classList.toggle("active", m === "login");
  tabSignup.classList.toggle("active", m === "signup");
  submitBtn.textContent = m === "login" ? "Đăng nhập & Đồng ý đồng bộ" : "Đăng ký & Đồng ý đồng bộ";
  msgEl.textContent = "";
}
tabLogin.onclick = () => setMode("login");
tabSignup.onclick = () => setMode("signup");

submitBtn.onclick = async () => {
  const email = emailEl.value.trim();
  const password = passwordEl.value;
  msgEl.textContent = "";

  if (!email || !password) {
    msgEl.textContent = "Vui lòng nhập đầy đủ email và mật khẩu.";
    return;
  }

  submitBtn.disabled = true;
  try {
    let cred;
    if (mode === "login") {
      cred = await auth.signInWithEmailAndPassword(email, password);
    } else {
      if (password.length < 6) {
        msgEl.textContent = "Mật khẩu phải có ít nhất 6 ký tự.";
        submitBtn.disabled = false;
        return;
      }
      cred = await auth.createUserWithEmailAndPassword(email, password);
    }

    const user = cred.user;
    const idToken = await user.getIdToken();
    const refreshToken = user.refreshToken;

    await chrome.storage.local.set({
      authTokens: {
        uid: user.uid,
        email: user.email,
        idToken,
        refreshToken,
        obtainedAt: Date.now(),
      },
      syncConsent: true,
    });

    // Báo cho background.js đồng bộ ngay các dữ liệu đã lưu cục bộ trước đó (nếu có)
    chrome.runtime.sendMessage({ type: "onboardingComplete" });

    formScreen.style.display = "none";
    successScreen.style.display = "block";
  } catch (err) {
    msgEl.textContent = translateError(err);
  } finally {
    submitBtn.disabled = false;
  }
};

closeBtn.onclick = () => window.close();

function translateError(err) {
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
