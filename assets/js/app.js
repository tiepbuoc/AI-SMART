/* Ngã Rẽ 10 – tiện ích dùng chung: khung trang, lưu trữ, so sánh, trợ lý AI, QR */
const KEY="ngare10_v1",CMP="ngare10_cmp",PLAN="ngare10_plan";
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const store={get(k,d){try{const r=localStorage.getItem(k);return r==null?d:JSON.parse(r)}catch(e){return d}},set(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}};
// Trợ lý AI: gọi API chuẩn OpenAI-compatible (POST {ENDPOINT}/chat/completions) giống chatbot AI SMART.
// Lưu ý: khóa API đặt ở đây ai cũng đọc được. Muốn an toàn hơn, để KEY rỗng và trỏ ENDPOINT tới proxy của bạn
// (ví dụ Firebase Cloud Function giữ khóa ở phía máy chủ). Xem README.
const AI={
  ENDPOINT:"https://api.shopaikey.com/v1",
  MODEL:"gpt-4.1-mini-2025-04-14",
  KEY:"sk-4150297863e3eee405805e8609648e6c5cebb1b502ffb46e",
  MAX_TOKENS:1500,
  KEEP:20, // số tin nhắn gần nhất được lưu và gửi kèm
  SYSTEM:`Bạn là trợ lý hướng nghiệp thân thiện của website "Ngã Rẽ 10", giúp học sinh lớp 9 chọn môn lựa chọn lớp 10.
QUY TẮC:
- Trả lời bằng tiếng Việt, ngắn gọn, dễ hiểu, giọng thân thiện phù hợp học sinh.
- Không quyết định thay học sinh: gợi mở, nêu ưu và nhược điểm, hỏi lại sở thích và môn học em mạnh khi cần.
- Với thông tin tuyển sinh cụ thể (điểm chuẩn, chỉ tiêu, tổ hợp môn của từng trường), nhắc học sinh kiểm tra thông báo mới nhất của trường và hỏi thầy cô.
- Nếu câu hỏi không liên quan đến chọn môn, nghề nghiệp, học tập thì từ chối nhẹ nhàng và đưa cuộc trò chuyện về chủ đề chính.
- Dùng Markdown đơn giản: **in đậm** ý chính, danh sách gạch đầu dòng khi liệt kê. Không dùng bảng phức tạp.`
};
const NAV=[["index.html","Trang chủ","home","house"],["khao-sat.html","Khảo sát","survey","clipboard-list"],["nghe-nghiep.html","Nghề","careers","briefcase"],["mon-hoc.html","Chọn môn","subjects","book-open"],["so-sanh.html","So sánh","compare","scale-balanced"],["ke-hoach.html","Kế hoạch","plan","list-check"]];

const cix=id=>C.findIndex(c=>c[6]===id),cid=i=>C[i][6];
function calc(d){
  const gs={};Object.keys(G).forEach(k=>gs[k]=0);Q.forEach((q,i)=>{if(q[0] in gs)gs[q[0]]+=(d.a[i]||0)});
  const mx=Math.max(2,...Object.keys(G).map(k=>Q.filter(q=>q[0]===k).length*2));
  const bo={};d.s.forEach(x=>(BOOST[x]||"").split("").forEach(g=>bo[g]=1));
  const list=C.map((c,i)=>{const m=c[3].split("|"),h=m.filter(x=>d.s.includes(x)).length,sc=gs[c[1]]*2+h*1.5+(bo[c[1]]?1:0);return{i,c,m,pct:Math.min(99,Math.round(sc/(mx*2+5.5)*100)),sc}}).sort((a,b)=>b.sc-a.sc);
  return{gs,list,mx};
}
const chips=(m,s=[])=>m.map(x=>`<span class="chip ${s.includes(x)?"pick":""}">${x}</span>`).join("");
const inCmp=i=>store.get(CMP,[]).includes(cid(i));
function careerBody(i,s=[]){const c=C[i];return `<p>${c[2]}</p><p style="margin-bottom:2px"><b>Môn lựa chọn gợi ý:</b></p>${chips(c[3].split("|"),s)}<p><b>Ngành học:</b> ${c[4]}<br><b>Khối thi tham khảo:</b> ${c[5]}</p><div class="row" style="margin:8px 0 0"><button class="btn alt sm" data-cmp="${i}">${inCmp(i)?"Bỏ khỏi so sánh":"Thêm vào so sánh"}</button><a class="btn alt sm" href="mon-hoc.html?nghe=${encodeURIComponent(c[6])}"><i class="fas fa-book-open ic"></i>Xem tổ hợp</a></div>`}
function toast(t){let e=$(".toast");if(e)e.remove();e=document.createElement("div");e.className="toast";e.setAttribute("role","status");e.textContent=t;document.body.appendChild(e);setTimeout(()=>e.remove(),2200)}
document.addEventListener("click",e=>{
  const b=e.target.closest("[data-cmp]");if(!b)return;
  const i=+b.dataset.cmp,id=cid(i);let l=store.get(CMP,[]).filter(x=>cix(x)>=0);
  if(l.includes(id)){l=l.filter(x=>x!==id);toast("Đã bỏ khỏi danh sách so sánh")}
  else if(l.length>=3){toast("Chỉ so sánh tối đa 3 nghề. Hãy bỏ bớt một nghề trước.");return}
  else{l.push(id);toast("Đã thêm vào so sánh ("+l.length+"/3)")}
  store.set(CMP,l);$$(`[data-cmp="${i}"]`).forEach(x=>x.textContent=l.includes(id)?"Bỏ khỏi so sánh":"Thêm vào so sánh");
  if(window.onCmpChange)onCmpChange();
});

// Khung trang
const cur=document.body.dataset.p;
document.body.insertAdjacentHTML("afterbegin",`<header class="top"><a class="logo" href="index.html" aria-label="Về trang chủ">Ngã Rẽ<i>10</i></a><nav id="mainnav" aria-label="Các mục chính">${NAV.map(n=>`<a href="${n[0]}" ${n[2]===cur?'aria-current="page"':""}><i class="fas fa-${n[3]}"></i><span>${n[1]}</span></a>`).join("")}</nav><button class="btn alt sm" id="share" aria-label="Chia sẻ mã QR"><i class="fas fa-qrcode"></i><span class="lb"> Chia sẻ</span></button></header>`);
document.body.insertAdjacentHTML("beforeend",`<footer><p>Công cụ tham khảo, không thay thế tư vấn của thầy cô và gia đình. Dữ liệu cá nhân chỉ lưu trên máy bạn.</p></footer><button class="btn" id="chat-fab" aria-label="Hỏi trợ lý"><i class="fas fa-comments"></i></button><button id="navtg" aria-controls="mainnav" aria-expanded="true" aria-label="Ẩn menu"><i class="fas fa-chevron-down"></i></button>`);

// Popup chi tiết
function pop(h){let d=$("#pop");if(!d){document.body.insertAdjacentHTML("beforeend",`<dialog id="pop"><button class="px" aria-label="Đóng"><i class="fas fa-xmark"></i></button><div id="pb"></div></dialog>`);d=$("#pop");$(".px",d).onclick=()=>d.close();d.addEventListener("click",e=>{if(e.target===d)d.close()})}$("#pb").innerHTML=h;$("#pb").scrollTop=0;d.showModal()}
function careerPop(i,s=[]){const c=C[i];pop(`<h3 class="pt"><span class="ib" style="--gc:${GC[c[1]]};margin-right:10px;vertical-align:middle"><i class="fas fa-${GI[c[1]]}"></i></span>${c[0]}</h3><p class="soft" style="font-size:14px;margin:0 0 6px">${G[c[1]]}</p>${careerBody(i,s)}`)}
document.addEventListener("click",e=>{const b=e.target.closest("[data-pop]");if(b)careerPop(+b.dataset.pop,(b.dataset.s||"").split("|").filter(Boolean))});
// Ẩn hiện menu trên điện thoại
function setNav(off){document.body.classList.toggle("nav-off",off);const b=$("#navtg");b.setAttribute("aria-expanded",String(!off));b.setAttribute("aria-label",off?"Hiện menu":"Ẩn menu");b.innerHTML=`<i class="fas fa-${off?"bars":"chevron-down"}"></i>`;store.set("ngare10_navoff",off)}
$("#navtg").onclick=()=>setNav(!document.body.classList.contains("nav-off"));setNav(store.get("ngare10_navoff",false)===true);

// Chia sẻ QR
$("#share").onclick=()=>{
  let d=$("#qrd");if(!d){document.body.insertAdjacentHTML("beforeend",`<dialog id="qrd"><h3>Quét để mở trang này</h3><div id="qr" style="display:flex;justify-content:center;margin:12px"></div><p class="soft" style="font-size:13px;max-width:240px;word-break:break-all">${location.href}</p><div class="row" style="justify-content:center"><button class="btn alt sm" id="cp">Sao chép liên kết</button><button class="btn sm" id="qc">Đóng</button></div></dialog>`);d=$("#qrd");
    $("#qc").onclick=()=>d.close();$("#cp").onclick=()=>navigator.clipboard.writeText(location.href).then(()=>toast("Đã sao chép liên kết"),()=>toast("Không sao chép được, hãy chọn và sao chép thủ công"));
    const s=document.createElement("script");s.src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";s.onload=()=>new QRCode($("#qr"),{text:location.href,width:200,height:200});s.onerror=()=>$("#qr").textContent="Không tải được mã QR. Kiểm tra kết nối mạng.";document.head.appendChild(s)}
  d.showModal();
};

// Trợ lý AI
const CHAT_KEY="ngare10_chat";
let hist=(()=>{const h=store.get(CHAT_KEY,[]);return Array.isArray(h)?h.filter(m=>m&&(m.role==="user"||m.role==="assistant")&&typeof m.content==="string").slice(-AI.KEEP):[]})();
const saveHist=()=>store.set(CHAT_KEY,hist.slice(-AI.KEEP));
// Ngữ cảnh lấy từ nội dung của chính website (nghề, nhóm nghề, kết quả khảo sát của học sinh) để câu trả lời khớp với trang
function aiContext(){
  try{
    let t="";
    if(Array.isArray(C)&&C.length){
      t+="\n\nDANH SÁCH NGHỀ TRÊN WEBSITE (tên | nhóm | 4 môn lựa chọn gợi ý | ngành học | khối thi):\n"+C.map(c=>`- ${c[0]} | ${G[c[1]]||c[1]} | ${c[3].split("|").join(", ")} | ${c[4]} | ${c[5]}`).join("\n");
    }
    const d=store.get(KEY,null);
    if(d&&d.a&&d.s&&Array.isArray(C)&&C.length){
      const top=calc(d).list.slice(0,3).map(x=>`${x.c[0]} (${x.pct}%)`).join("; ");
      t+=`\n\nKẾT QUẢ KHẢO SÁT CỦA HỌC SINH NÀY: nhóm nghề phù hợp nhất: ${top}. Môn các em tự thấy mạnh: ${d.s.join(", ")||"chưa chọn"}. Chỉ nhắc tới khi liên quan đến câu hỏi.`;
    }
    return t;
  }catch(e){return""}
}
// Gọi API giống callAiApi của AI SMART: POST {endpoint}/chat/completions, trả về choices[0].message.content
async function callAi(messages){
  const url=AI.ENDPOINT.trim().replace(/\/$/,"")+"/chat/completions";
  const headers={"Content-Type":"application/json"};
  if(AI.KEY)headers.Authorization="Bearer "+AI.KEY;
  const ctl=new AbortController(),to=setTimeout(()=>ctl.abort(),60000);
  try{
    const r=await fetch(url,{method:"POST",headers,signal:ctl.signal,body:JSON.stringify({model:AI.MODEL,messages,max_tokens:AI.MAX_TOKENS,temperature:.6})});
    if(!r.ok){const e=await r.text().catch(()=>"");throw new Error("HTTP "+r.status+(e?": "+e.slice(0,120):""))}
    const j=await r.json();return(j?.choices?.[0]?.message?.content||"").trim();
  }catch(e){throw e.name==="AbortError"?new Error("quá thời gian chờ"):e}
  finally{clearTimeout(to)}
}
// Hiển thị Markdown (marked + DOMPurify như AI SMART), tải khi cần; nếu tải lỗi thì hiện chữ thường
let mdP=null;
function loadScript(src){return new Promise((ok,no)=>{const s=document.createElement("script");s.src=src;s.onload=ok;s.onerror=no;document.head.appendChild(s)})}
function loadMd(){return mdP||(mdP=Promise.all([loadScript("https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js"),loadScript("https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.min.js")]).catch(()=>{}))}
function renderBot(el,t){
  el.textContent=t;
  loadMd().then(()=>{if(window.marked&&window.DOMPurify){el.innerHTML=DOMPurify.sanitize(marked.parse(t,{breaks:true}));el.classList.add("md");$$("a",el).forEach(a=>{a.target="_blank";a.rel="noopener noreferrer"})}const b=$("#cb");if(b)b.scrollTop=1e9});
}

const GREET="Chào bạn! Bạn đang băn khoăn điều gì về việc chọn môn lớp 10?";
function closeChat(){$("#chat")?.remove();$("#chat-bd")?.remove();document.body.classList.remove("chat-open");const f=$("#chat-fab");f.hidden=false;f.focus()}
function openChat(){
  if($("#chat"))return;$("#chat-fab").hidden=true;document.body.classList.add("chat-open");
  document.body.insertAdjacentHTML("beforeend",`<div id="chat-bd" aria-hidden="true"></div><div class="card" id="chat" role="dialog" aria-modal="true" aria-label="Trợ lý hướng nghiệp"><div class="h"><span><i class="fas fa-robot ic"></i>Trợ lý Ngã Rẽ 10</span><span class="hb"><button aria-label="Xóa cuộc trò chuyện" title="Cuộc trò chuyện mới" id="cn"><i class="fas fa-rotate-right"></i></button><button aria-label="Đóng" id="cx">×</button></span></div><div id="cb"></div><form id="cf"><input type="text" id="ci" placeholder="Nhập câu hỏi" autocomplete="off"><button class="btn sm" id="cs" aria-label="Gửi"><i class="fas fa-paper-plane"></i></button></form></div>`);
  const add=(t,c)=>{const m=document.createElement("div");m.className="m "+c;if(c==="b")renderBot(m,t);else m.textContent=t;$("#cb").appendChild(m);$("#cb").scrollTop=1e9;return m};
  const draw=()=>{$("#cb").innerHTML="";add(GREET,"b");hist.forEach(m=>add(m.content,m.role==="user"?"u":"b"))};
  draw();
  $("#chat-bd").onclick=closeChat;$("#cx").onclick=closeChat;
  $("#cn").onclick=()=>{hist=[];saveHist();draw();$("#ci").focus()};
  $("#chat").addEventListener("keydown",e=>{if(e.key==="Escape"){e.stopPropagation();closeChat()}});
  $("#ci").focus();
  $("#cf").onsubmit=async e=>{
    e.preventDefault();const t=$("#ci").value.trim();if(!t||$("#cs").disabled)return;
    $("#ci").value="";add(t,"u");hist.push({role:"user",content:t});
    $("#cs").disabled=true;const w=add("Đang trả lời…","b");w.classList.add("wait");
    try{
      const a=await callAi([{role:"system",content:AI.SYSTEM+aiContext()},...hist.slice(-AI.KEEP)]);
      if(!a)throw new Error("không có nội dung trả về");
      w.classList.remove("wait");renderBot(w,a);hist.push({role:"assistant",content:a});saveHist();
    }catch(err){
      hist.pop();w.classList.remove("wait");w.classList.add("err");
      w.textContent="Trợ lý đang gặp sự cố kết nối ("+err.message+"). Bạn thử lại sau hoặc hỏi thầy cô nhé.";
    }finally{const b=$("#cs");if(b){b.disabled=false;$("#ci")?.focus()}}
  };
}
$("#chat-fab").onclick=openChat;
