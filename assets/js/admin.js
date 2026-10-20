/* Trang quản trị Ngã Rẽ 10: sửa nghề, nhóm nghề, câu hỏi, môn học, việc cần làm và lưu vào Firestore (site/content) */
const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
const clone=o=>JSON.parse(JSON.stringify(o));
const BAD=/[<>"'&|]/;           // ký tự không cho phép trong tên môn học
let D=null,dirty=false,tab="careers",user=null,isNew=false,filter="";
const open=new Set();           // các nghề đang mở, giữ nguyên khi vẽ lại

function toast(t){let e=$(".toast");if(e)e.remove();e=document.createElement("div");e.className="toast";e.setAttribute("role","status");e.textContent=t;document.body.appendChild(e);setTimeout(()=>e.remove(),2400)}
function setDirty(v){dirty=v;$("#dirty").hidden=!v}
window.addEventListener("beforeunload",e=>{if(dirty){e.preventDefault();e.returnValue=""}});

// Cổng mật khẩu (không dùng Firebase Auth). Chỉ lưu mã băm SHA-256 của mật khẩu.
const PW_HASH="03f184975659327642443cf1076df192b10556b0b583a10d7d11605261a1482d";
async function sha(s){if(!(window.crypto&&crypto.subtle))return s==="nhat1234"?PW_HASH:"";const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));return[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}
user={email:"admin"};
if(typeof firebase==="undefined"||!window.DB){$("#gmsg").textContent="Không tải được Firebase. Kiểm tra kết nối mạng rồi tải lại trang."}
else{
  const enter=async()=>{$("#login").hidden=true;await load()};
  if(sessionStorage.getItem("nr10_adm")==="1")enter();else $("#login").hidden=false;
  $("#lf").onsubmit=async e=>{e.preventDefault();$("#lmsg").textContent="";
    if(await sha($("#pw").value)===PW_HASH){sessionStorage.setItem("nr10_adm","1");enter()}else $("#lmsg").textContent="Mật khẩu chưa đúng."};
  $("#out").onclick=()=>{if(dirty&&!confirm("Bạn có thay đổi chưa lưu. Vẫn thoát?"))return;setDirty(false);sessionStorage.removeItem("nr10_adm");location.reload()};
  $("#save").onclick=save;
}

async function load(){
  try{
    const snap=await DB.doc(DATA_DOC).get({source:"server"});
    if(snap.exists&&validData(snap.data())){D=clone(snap.data());delete D.updatedAt;isNew=false}
    else{D=clone(DEFAULT_DATA);isNew=true}
    setDirty(false);$("#newnote").hidden=!isNew;$("#app").hidden=false;draw();
  }catch(err){
    $("#app").hidden=true;
    $("#gmsg").textContent=err.code==="permission-denied"?"Chưa có quyền. Hãy dán firestore.rules mới vào Firebase rồi tải lại.":"Không tải được dữ liệu ("+(err.code||err.message)+").";
  }
}

// ---------- kiểm tra dữ liệu trước khi lưu ----------
function validate(){
  const e=[],gk=D.groups.map(g=>g.key);
  D.groups.forEach((g,i)=>{if(!/^[A-Za-z0-9]{1,3}$/.test(g.key))e.push(`Nhóm ${i+1}: mã nhóm gồm 1–3 chữ cái hoặc số.`);if(!g.name.trim())e.push(`Nhóm ${g.key||i+1}: thiếu tên.`);if(!/^[a-z0-9-]+$/.test(g.icon))e.push(`Nhóm ${g.key}: tên biểu tượng chỉ gồm chữ thường, số, dấu gạch (ví dụ microchip).`)});
  if(new Set(gk).size!==gk.length)e.push("Có hai nhóm trùng mã.");
  if(!D.groups.length)e.push("Cần ít nhất một nhóm nghề.");
  [["electives","Môn lựa chọn"],["surveySubjects","Môn ở câu hỏi cuối khảo sát"]].forEach(([k,n])=>{
    D[k].forEach((s,i)=>{if(!s.trim())e.push(`${n}: dòng ${i+1} đang để trống.`);else if(BAD.test(s))e.push(`${n}: "${s}" chứa ký tự không được dùng (< > " ' & |).`)});
    if(new Set(D[k]).size!==D[k].length)e.push(`${n}: có môn bị trùng tên.`)});
  D.careers.forEach((c,i)=>{const n=c.name.trim()||`Nghề số ${i+1}`;
    if(!c.name.trim())e.push(`Nghề số ${i+1}: thiếu tên.`);
    if(!gk.includes(c.group))e.push(`${n}: chưa chọn nhóm nghề.`);
    if(c.subjects.length!==4)e.push(`${n}: cần chọn đúng 4 môn lựa chọn (đang có ${c.subjects.length}).`);
    c.subjects.forEach(s=>{if(!D.electives.includes(s))e.push(`${n}: môn "${s}" không còn trong danh sách môn lựa chọn.`)})});
  if(new Set(D.careers.map(c=>c.id)).size!==D.careers.length)e.push("Có hai nghề trùng mã nội bộ.");
  D.questions.forEach((q,i)=>{if(!q.text.trim())e.push(`Câu hỏi ${i+1}: thiếu nội dung.`);if(!gk.includes(q.group))e.push(`Câu hỏi ${i+1}: chưa chọn nhóm.`)});
  D.todo.forEach((t,i)=>{if(!t.trim())e.push(`Việc cần làm ${i+1}: đang để trống.`)});
  return e;
}
async function save(){
  const e=validate();let b=$("#errs");if(b)b.remove();
  if(e.length){$("#tabs").insertAdjacentHTML("beforebegin",`<div class="errs" id="errs" role="alert"><b>Chưa lưu được. Hãy sửa các mục sau:</b><ul>${e.map(x=>`<li>${esc(x)}</li>`).join("")}</ul></div>`);scrollTo(0,0);return}
  $("#save").disabled=true;
  try{
    const out=clone(D);out.groups.forEach(g=>delete g._new);
    await DB.doc(DATA_DOC).set({...out,updatedAt:firebase.firestore.FieldValue.serverTimestamp()});
    D.groups.forEach(g=>delete g._new);setDirty(false);isNew=false;$("#newnote").hidden=true;toast("Đã lưu lên Firestore");if(tab==="groups")draw();
  }catch(err){toast(err.code==="permission-denied"?"Không có quyền ghi. Kiểm tra firestore.rules.":"Lưu thất bại: "+(err.code||err.message))}
  $("#save").disabled=false;
}

// ---------- giao diện ----------
const TABS=[["careers","Nghề nghiệp",()=>D.careers.length],["groups","Nhóm nghề",()=>D.groups.length],["questions","Câu hỏi khảo sát",()=>D.questions.length],["subjects","Môn học",()=>D.electives.length],["todo","Việc cần làm",()=>D.todo.length],["data","Sao lưu",null]];
const gOpts=sel=>D.groups.map(g=>`<option value="${esc(g.key)}" ${g.key===sel?"selected":""}>${esc(g.name)}</option>`).join("");
const tools=(l,i,n)=>`<span class="tools"><button class="btn alt sm mini" data-act="up" data-l="${l}" data-i="${i}" ${i?"":"disabled"} aria-label="Chuyển lên"><i class="fas fa-arrow-up"></i></button><button class="btn alt sm mini" data-act="down" data-l="${l}" data-i="${i}" ${i<n-1?"":"disabled"} aria-label="Chuyển xuống"><i class="fas fa-arrow-down"></i></button><button class="btn alt sm mini del" data-act="del" data-l="${l}" data-i="${i}" aria-label="Xóa"><i class="fas fa-trash"></i></button></span>`;

function draw(){
  $("#tabs").innerHTML=TABS.map(t=>`<button role="tab" data-tab="${t[0]}" aria-selected="${tab===t[0]}">${t[1]}${t[2]?` (${t[2]()})`:""}</button>`).join("");
  $("#pane").innerHTML=({careers:pCareers,groups:pGroups,questions:pQuestions,subjects:pSubjects,todo:pTodo,data:pData})[tab]();
}

function pCareers(){
  const f=filter.toLowerCase();
  const items=D.careers.map((c,i)=>{
    if(f&&!(c.name+c.desc+c.majors).toLowerCase().includes(f))return"";
    const g=D.groups.find(x=>x.key===c.group);
    return `<details class="card ad-item" data-id="${esc(c.id)}" ${open.has(c.id)?"open":""}><summary><span class="gdot" style="background:${okColor(g&&g.color)}"></span><span class="sn">${esc(c.name)||"(chưa đặt tên)"}</span>${tools("careers",i,D.careers.length)}</summary>
    <div class="ad-body"><div class="two"><label>Tên nghề<input type="text" data-p="careers.${i}.name" value="${esc(c.name)}"></label><label>Nhóm nghề<select data-p="careers.${i}.group">${gOpts(c.group)}</select></label></div>
    <label>Mô tả ngắn<textarea data-p="careers.${i}.desc">${esc(c.desc)}</textarea></label>
    <div><span class="fld">Môn lựa chọn gợi ý <span class="ad-count" data-cnt="${i}">(${c.subjects.length}/4)</span></span><div class="opts" style="margin-top:6px">${D.electives.map(s=>`<label class="opt sub"><input type="checkbox" data-act="subj" data-i="${i}" value="${esc(s)}" ${c.subjects.includes(s)?"checked":""}><span>${esc(s)}</span></label>`).join("")}</div></div>
    <label>Ngành học sau THPT<input type="text" data-p="careers.${i}.majors" value="${esc(c.majors)}"></label>
    <label>Khối thi tham khảo<input type="text" data-p="careers.${i}.blocks" value="${esc(c.blocks)}"></label></div></details>`}).join("");
  return `<div class="row" style="margin-top:0"><input type="search" id="cf" placeholder="Tìm nghề" value="${esc(filter)}" aria-label="Tìm nghề"><button class="btn sm" data-act="add" data-l="careers"><i class="fas fa-plus ic"></i>Thêm nghề</button></div>${items||`<p class="soft">Không có nghề nào.</p>`}`;
}
function pGroups(){
  return `<p class="soft">Mỗi nghề và mỗi câu hỏi thuộc một nhóm. Mã nhóm (1–3 ký tự) dùng nội bộ, nên đặt một lần rồi giữ nguyên. Biểu tượng là tên trên <a href="https://fontawesome.com/search?o=r&m=free&s=solid" target="_blank" rel="noopener">Font Awesome</a> (ví dụ microchip, flask).</p>
  ${D.groups.map((g,i)=>`<div class="card lrow"><span class="pv" style="background:${okColor(g.color)}"><i class="fas fa-${okIcon(g.icon)}"></i></span>
  <input type="text" class="gk" data-p="groups.${i}.key" value="${esc(g.key)}" aria-label="Mã nhóm" placeholder="Mã" ${g._new?"":"readonly"}>
  <input type="text" data-p="groups.${i}.name" value="${esc(g.name)}" aria-label="Tên nhóm" placeholder="Tên nhóm">
  <input type="color" data-p="groups.${i}.color" value="${okColor(g.color)}" aria-label="Màu">
  <input type="text" data-p="groups.${i}.icon" value="${esc(g.icon)}" aria-label="Biểu tượng" placeholder="biểu tượng" style="max-width:150px">${tools("groups",i,D.groups.length)}</div>`).join("")}
  <button class="btn sm" data-act="add" data-l="groups"><i class="fas fa-plus ic"></i>Thêm nhóm</button>`;
}
function pQuestions(){
  return `<p class="soft">Mỗi câu hỏi có ba mức trả lời (Chưa thích, Cũng được, Rất thích). Nên để số câu mỗi nhóm bằng nhau để kết quả công bằng. Nếu đổi số câu, học sinh đã làm khảo sát sẽ phải làm lại.</p>
  ${D.questions.map((q,i)=>`<div class="card lrow"><b>${i+1}.</b><input type="text" data-p="questions.${i}.text" value="${esc(q.text)}" aria-label="Câu hỏi ${i+1}"><select data-p="questions.${i}.group" aria-label="Nhóm của câu ${i+1}">${gOpts(q.group)}</select>${tools("questions",i,D.questions.length)}</div>`).join("")}
  <button class="btn sm" data-act="add" data-l="questions"><i class="fas fa-plus ic"></i>Thêm câu hỏi</button>
  <p class="soft" style="margin-top:12px">Số câu theo nhóm: ${D.groups.map(g=>`${esc(g.name)}: <b>${D.questions.filter(q=>q.group===g.key).length}</b>`).join(" · ")}</p>`;
}
function subList(k,title,help){
  return `<div class="card" style="margin:12px 0"><h3>${title}</h3><p class="soft">${help}</p>${D[k].map((s,i)=>`<div class="lrow"><input type="text" data-p="${k}.${i}" data-old="${esc(s)}" value="${esc(s)}" aria-label="Môn ${i+1}">${tools(k,i,D[k].length)}</div>`).join("")}<button class="btn sm" data-act="add" data-l="${k}"><i class="fas fa-plus ic"></i>Thêm môn</button></div>`;
}
function pSubjects(){
  return `${subList("electives","Môn lựa chọn lớp 10","Danh sách môn học sinh được chọn 4 môn. Đây là các môn tick trong từng nghề và trang Chọn môn. Đổi tên môn sẽ tự cập nhật ở các nghề.")}
  ${subList("surveySubjects","Môn ở câu hỏi cuối khảo sát","Danh sách môn học sinh chọn tối đa 3 môn mình học tốt.")}
  <div class="card"><h3>Môn mạnh làm tăng điểm nhóm nghề nào</h3><p class="soft">Nếu học sinh chọn môn ở hàng, các nhóm được tick sẽ được cộng thêm điểm trong gợi ý.</p><div class="tw"><table><thead><tr><th>Môn</th>${D.groups.map(g=>`<th>${esc(g.name)}</th>`).join("")}</tr></thead><tbody>${D.surveySubjects.map(s=>`<tr><td>${esc(s)}</td>${D.groups.map(g=>`<td class="c"><input type="checkbox" data-act="boost" data-s="${esc(s)}" data-g="${esc(g.key)}" aria-label="${esc(s)} – ${esc(g.name)}" ${(D.boost[s]||"").includes(g.key)?"checked":""}></td>`).join("")}</tr>`).join("")}</tbody></table></div></div>`;
}
function pTodo(){
  return `<p class="soft">Danh sách việc cần làm ở trang Kế hoạch của học sinh.</p>${D.todo.map((t,i)=>`<div class="card lrow"><input type="text" data-p="todo.${i}" value="${esc(t)}" aria-label="Việc ${i+1}">${tools("todo",i,D.todo.length)}</div>`).join("")}<button class="btn sm" data-act="add" data-l="todo"><i class="fas fa-plus ic"></i>Thêm việc</button>`;
}
function pData(){
  return `<div class="card"><h3>Sao lưu và khôi phục</h3><p class="soft">Tải bản sao lưu JSON trước khi sửa lớn. Nhập lại file chỉ thay đổi trên màn hình này, bạn vẫn cần bấm Lưu lên Firestore.</p>
  <div class="row" style="margin-top:8px"><button class="btn alt sm" data-act="export"><i class="fas fa-download ic"></i>Tải bản sao lưu</button><label class="btn alt sm" style="cursor:pointer"><i class="fas fa-upload ic"></i>Nhập từ file JSON<input type="file" id="imp" accept="application/json,.json" hidden></label><button class="btn alt sm del" data-act="reset"><i class="fas fa-rotate-left ic"></i>Khôi phục dữ liệu mẫu</button></div></div>`;
}

// ---------- sự kiện ----------
function setPath(path,v){const k=path.split(".");let o=D;for(let j=0;j<k.length-1;j++)o=o[k[j]];o[k[k.length-1]]=v}
const NEW={careers:()=>({id:"c"+Date.now().toString(36),name:"",group:D.groups[0].key,desc:"",subjects:[],majors:"",blocks:""}),groups:()=>({key:"",name:"",color:"#2C4BFF",icon:"star",_new:true}),questions:()=>({group:D.groups[0].key,text:""}),electives:()=>"",surveySubjects:()=>"",todo:()=>""};

document.addEventListener("input",e=>{
  const t=e.target;if(t.id==="cf"){filter=t.value;const pos=t.selectionStart;draw();const n=$("#cf");n.focus();n.setSelectionRange(pos,pos);return}
  if(!t.dataset.p)return;
  setPath(t.dataset.p,t.value);setDirty(true);
  if(t.dataset.p.endsWith(".name")&&t.dataset.p.startsWith("careers")){const s=t.closest("details").querySelector(".sn");s.textContent=t.value||"(chưa đặt tên)"}
  if(t.dataset.p.endsWith(".color")||t.dataset.p.endsWith(".icon")){const g=D.groups[+t.dataset.p.split(".")[1]],pv=t.closest(".lrow").querySelector(".pv");pv.style.background=okColor(g.color);pv.innerHTML=`<i class="fas fa-${okIcon(g.icon)}"></i>`}
});
// Đổi tên môn: cập nhật luôn các chỗ đang dùng môn đó
document.addEventListener("change",e=>{
  const t=e.target;
  if(t.dataset.p&&t.dataset.old!==undefined){
    const k=t.dataset.p.split(".")[0],o=t.dataset.old,n=t.value.trim();
    if(o&&n&&o!==n&&!BAD.test(n)){
      if(k==="electives")D.careers.forEach(c=>{c.subjects=c.subjects.map(s=>s===o?n:s)});
      if(k==="surveySubjects"&&D.boost[o]!==undefined){D.boost[n]=D.boost[o];delete D.boost[o]}
      D[k][+t.dataset.p.split(".")[1]]=n;t.dataset.old=n;t.value=n;setDirty(true)}
  }
  if(t.dataset.act==="subj"){
    const c=D.careers[+t.dataset.i];
    if(t.checked){if(c.subjects.length>=4){t.checked=false;toast("Mỗi nghề chỉ chọn đúng 4 môn.");return}c.subjects.push(t.value)}
    else c.subjects=c.subjects.filter(s=>s!==t.value);
    c.subjects=D.electives.filter(s=>c.subjects.includes(s));   // giữ đúng thứ tự danh sách môn
    $(`[data-cnt="${t.dataset.i}"]`).textContent=`(${c.subjects.length}/4)`;setDirty(true);
  }
  if(t.dataset.act==="boost"){
    const s=t.dataset.s;let v=(D.boost[s]||"").split("").filter(Boolean);
    v=t.checked?[...new Set([...v,t.dataset.g])]:v.filter(x=>x!==t.dataset.g);
    if(v.length)D.boost[s]=v.join("");else delete D.boost[s];setDirty(true);
  }
  if(t.id==="imp"&&t.files[0]){
    const r=new FileReader();r.onload=()=>{try{const j=JSON.parse(r.result);if(!validData(j))throw 0;D=clone(j);delete D.updatedAt;setDirty(true);draw();toast("Đã nhập. Nhớ bấm Lưu lên Firestore.")}catch(err){toast("File không đúng định dạng dữ liệu Ngã Rẽ 10.")}};r.readAsText(t.files[0]);t.value="";
  }
  if(t.dataset.p&&/\.group$/.test(t.dataset.p)){const d=t.closest("details");if(d)draw()}
});
document.addEventListener("toggle",e=>{const d=e.target;if(d.matches&&d.matches("details.ad-item")){d.open?open.add(d.dataset.id):open.delete(d.dataset.id)}},true);

document.addEventListener("click",e=>{
  const tb=e.target.closest("[data-tab]");if(tb){tab=tb.dataset.tab;draw();return}
  const b=e.target.closest("[data-act]");if(!b||b.matches("input"))return;
  const a=b.dataset.act,l=b.dataset.l,i=+b.dataset.i;
  if(a==="export"){const u=URL.createObjectURL(new Blob([JSON.stringify(D,null,1)],{type:"application/json"})),x=document.createElement("a");x.href=u;x.download="nga-re-10-"+new Date().toISOString().slice(0,10)+".json";x.click();URL.revokeObjectURL(u);return}
  if(a==="reset"){if(confirm("Thay toàn bộ nội dung trên màn hình bằng dữ liệu mẫu? Dữ liệu trên Firestore chỉ đổi khi bạn bấm Lưu.")){D=clone(DEFAULT_DATA);setDirty(true);draw()}return}
  if(!l)return;
  e.preventDefault();
  if(a==="add"){D[l].push(NEW[l]());if(l==="careers")open.add(D.careers[D.careers.length-1].id)}
  if(a==="up"||a==="down"){const j=a==="up"?i-1:i+1;if(j<0||j>=D[l].length)return;[D[l][i],D[l][j]]=[D[l][j],D[l][i]]}
  if(a==="del"){
    const it=D[l][i];
    if(l==="groups"){const n=D.careers.filter(c=>c.group===it.key).length,m=D.questions.filter(q=>q.group===it.key).length;
      if(n||m){toast(`Nhóm đang có ${n} nghề và ${m} câu hỏi. Hãy chuyển chúng sang nhóm khác trước.`);return}
      if(D.groups.length<2){toast("Cần giữ lại ít nhất một nhóm.");return}}
    if(l==="electives"){const n=D.careers.filter(c=>c.subjects.includes(it)).length;
      if(!confirm(n?`Môn "${it}" đang dùng ở ${n} nghề. Xóa sẽ gỡ môn khỏi các nghề đó và bạn cần chọn lại cho đủ 4 môn. Tiếp tục?`:`Xóa môn "${it}"?`))return;
      D.careers.forEach(c=>{c.subjects=c.subjects.filter(s=>s!==it)})}
    else if(l==="surveySubjects"){delete D.boost[it];if(!confirm(`Xóa môn "${it}"?`))return}
    else if(!confirm("Xóa mục này?"))return;
    D[l].splice(i,1);
  }
  setDirty(true);draw();
});
