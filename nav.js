// nav.js — Thanh menu DÙNG CHUNG cho mọi trang (index/chatbot/passport).
// Chỉ có 1 nguồn markup+logic duy nhất ở đây, đảm bảo mọi trang hiển thị
// thanh menu giống hệt nhau tuyệt đối (không bị lệch giữa các trang).

const NAV_LINKS = [
  { key: "chatbot", href: "chatbot.html", icon: "fa-comments", label: "AI SMART Chatbot" },
  { key: "passport", href: "passport.html", icon: "fa-route", label: "Learning Passport" },
];

function truncateEmail(email) {
  if (!email) return "";
  return email.slice(0, 5) + "...";
}

function renderSiteNav(activeKey) {
  const wrap = document.createElement("div");
  wrap.innerHTML = `
    <nav id="siteNav" class="site-nav">
      <a href="index.html" class="logo">
        <div class="logo-mark"><i class="fa-solid fa-compass"></i></div>
        <div class="logo-type"><span class="logo-ai">AI</span><span class="logo-rest">SMART</span></div>
      </a>

      <div class="nav-menu">
        ${NAV_LINKS.map(
          (l) =>
            `<a href="${l.href}" class="nav-link${l.key === activeKey ? " active" : ""}"><i class="fa-solid ${l.icon}"></i> ${l.label}</a>`
        ).join("")}
      </div>

      <div class="nav-right">
        <div id="navUserBox" class="nav-user-box" style="display:none;">
          <span id="navUserEmail" class="nav-user-email"></span>
          <button id="navLogoutBtn" class="nav-pill-btn"><i class="fa-solid fa-arrow-right-from-bracket"></i><span class="btn-text"> Đăng xuất</span></button>
        </div>
        <button class="menu-toggle" id="menuToggleBtn"><i class="fa-solid fa-bars"></i></button>
      </div>
    </nav>

    <div class="mobile-menu-panel" id="mobileMenuPanel">
      <div class="nav-links-mobile">
        ${NAV_LINKS.map(
          (l) =>
            `<a href="${l.href}" class="nav-link-mobile${l.key === activeKey ? " active" : ""}"><i class="fa-solid ${l.icon}"></i> ${l.label}</a>`
        ).join("")}
        <div id="mobileUserEmail" class="mobile-user-email" style="display:none;"></div>
        <button id="mobileLogoutBtn" class="nav-pill-btn" style="display:none; width:100%; justify-content:center; margin-top:6px;">
          <i class="fa-solid fa-arrow-right-from-bracket"></i> Đăng xuất
        </button>
      </div>
    </div>
  `;
  document.body.prepend(wrap.firstElementChild);
  document.body.appendChild(wrap.firstElementChild); // di chuyển mobile panel ra sau nav (thứ tự DOM)

  const menuToggle = document.getElementById("menuToggleBtn");
  const mobilePanel = document.getElementById("mobileMenuPanel");
  menuToggle.addEventListener("click", () => {
    mobilePanel.classList.toggle("open");
    menuToggle.classList.toggle("open");
  });
  mobilePanel.querySelectorAll(".nav-link-mobile").forEach((a) => {
    a.addEventListener("click", () => {
      mobilePanel.classList.remove("open");
      menuToggle.classList.remove("open");
    });
  });

  return {
    setUser(email, onLogout) {
      const navBox = document.getElementById("navUserBox");
      const navEmail = document.getElementById("navUserEmail");
      const navLogoutBtn = document.getElementById("navLogoutBtn");
      const mobileLogoutBtn = document.getElementById("mobileLogoutBtn");
      const mobileUserEmail = document.getElementById("mobileUserEmail");
      if (email) {
        navBox.style.display = "flex";
        navEmail.textContent = truncateEmail(email);
        navEmail.title = email;
        mobileLogoutBtn.style.display = "flex";
        mobileUserEmail.style.display = "block";
        mobileUserEmail.textContent = email;
      } else {
        navBox.style.display = "none";
        mobileLogoutBtn.style.display = "none";
        mobileUserEmail.style.display = "none";
      }
      navLogoutBtn.onclick = onLogout;
      mobileLogoutBtn.onclick = onLogout;
    },
  };
}
