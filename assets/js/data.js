/* Ngã Rẽ 10 – dữ liệu nội dung
   1) DEFAULT_DATA: dữ liệu mẫu, dùng khi chưa có dữ liệu trên Firestore hoặc khi mất mạng.
   2) Phần cuối file: tải dữ liệu từ Firestore (tài liệu site/content), lưu bản sao vào máy, rồi gán vào các biến toàn cục
      G, GC, GI, C, Q, SUB, SUBL, BOOST, TODO. Mỗi trang gọi onData(() => {...}) để chạy sau khi dữ liệu sẵn sàng.
   Dữ liệu được chỉnh trong trang admin.html, không cần sửa file này. */
const DEFAULT_DATA={
 "groups": [
  {
   "key": "K",
   "name": "Kỹ thuật – Công nghệ",
   "color": "#3B6CFF",
   "icon": "microchip"
  },
  {
   "key": "T",
   "name": "Khoa học – Sức khỏe",
   "color": "#12B886",
   "icon": "flask"
  },
  {
   "key": "N",
   "name": "Sáng tạo – Truyền thông",
   "color": "#E64980",
   "icon": "palette"
  },
  {
   "key": "X",
   "name": "Con người – Giáo dục",
   "color": "#F76707",
   "icon": "people-group"
  },
  {
   "key": "D",
   "name": "Kinh doanh – Dịch vụ",
   "color": "#E8A800",
   "icon": "chart-line"
  },
  {
   "key": "Q",
   "name": "Tài chính – Pháp lý",
   "color": "#7950F2",
   "icon": "landmark"
  }
 ],
 "careers": [
  {
   "id": "c01",
   "name": "Lập trình, AI và dữ liệu",
   "group": "K",
   "desc": "Viết phần mềm, ứng dụng, xây hệ thống thông minh.",
   "subjects": [
    "Vật lí",
    "Hóa học",
    "Tin học",
    "Công nghệ"
   ],
   "majors": "Công nghệ thông tin, Khoa học dữ liệu, Trí tuệ nhân tạo",
   "blocks": "A00, A01"
  },
  {
   "id": "c02",
   "name": "Kỹ sư cơ khí, điện, tự động hóa",
   "group": "K",
   "desc": "Thiết kế và vận hành máy móc, robot, hệ thống điện.",
   "subjects": [
    "Vật lí",
    "Hóa học",
    "Công nghệ",
    "Tin học"
   ],
   "majors": "Cơ khí, Điện – điện tử, Tự động hóa",
   "blocks": "A00, A01"
  },
  {
   "id": "c03",
   "name": "Kiến trúc và xây dựng",
   "group": "K",
   "desc": "Thiết kế công trình, nhà ở, không gian đô thị.",
   "subjects": [
    "Vật lí",
    "Mỹ thuật",
    "Công nghệ",
    "Tin học"
   ],
   "majors": "Kiến trúc, Kỹ thuật xây dựng",
   "blocks": "A00, V00"
  },
  {
   "id": "c04",
   "name": "Bác sĩ, dược sĩ, điều dưỡng",
   "group": "T",
   "desc": "Chẩn đoán, điều trị và chăm sóc sức khỏe cho mọi người.",
   "subjects": [
    "Hóa học",
    "Sinh học",
    "Vật lí",
    "Tin học"
   ],
   "majors": "Y đa khoa, Dược học, Điều dưỡng",
   "blocks": "B00"
  },
  {
   "id": "c05",
   "name": "Nghiên cứu khoa học và công nghệ sinh học",
   "group": "T",
   "desc": "Làm thí nghiệm, tìm ra vật liệu, giống, thuốc hoặc quy trình mới.",
   "subjects": [
    "Hóa học",
    "Sinh học",
    "Vật lí",
    "Công nghệ"
   ],
   "majors": "Công nghệ sinh học, Hóa học, Khoa học vật liệu",
   "blocks": "A00, B00"
  },
  {
   "id": "c06",
   "name": "Nông nghiệp và môi trường",
   "group": "T",
   "desc": "Bảo vệ cây trồng, vật nuôi, đất, nước và hệ sinh thái.",
   "subjects": [
    "Sinh học",
    "Hóa học",
    "Địa lí",
    "Công nghệ"
   ],
   "majors": "Nông nghiệp công nghệ cao, Khoa học môi trường",
   "blocks": "B00, A00"
  },
  {
   "id": "c07",
   "name": "Thiết kế đồ họa và truyền thông số",
   "group": "N",
   "desc": "Làm hình ảnh, video, giao diện, nhận diện thương hiệu.",
   "subjects": [
    "Mỹ thuật",
    "Tin học",
    "Công nghệ",
    "Giáo dục kinh tế và pháp luật"
   ],
   "majors": "Thiết kế đồ họa, Truyền thông đa phương tiện",
   "blocks": "H00, D01"
  },
  {
   "id": "c08",
   "name": "Âm nhạc, biểu diễn và nội dung sáng tạo",
   "group": "N",
   "desc": "Sáng tác, biểu diễn, sản xuất âm nhạc và nội dung giải trí.",
   "subjects": [
    "Âm nhạc",
    "Mỹ thuật",
    "Tin học",
    "Giáo dục kinh tế và pháp luật"
   ],
   "majors": "Sư phạm Âm nhạc, Thanh nhạc, Công nghiệp âm nhạc",
   "blocks": "N00 (khối năng khiếu)"
  },
  {
   "id": "c09",
   "name": "Báo chí và truyền thông",
   "group": "N",
   "desc": "Viết bài, dẫn chương trình, làm báo và nội dung số.",
   "subjects": [
    "Địa lí",
    "Giáo dục kinh tế và pháp luật",
    "Tin học",
    "Mỹ thuật"
   ],
   "majors": "Báo chí, Quan hệ công chúng",
   "blocks": "C00, D01"
  },
  {
   "id": "c10",
   "name": "Giáo viên và sư phạm",
   "group": "X",
   "desc": "Dạy học, đồng hành cùng học sinh. Chọn môn theo bộ môn muốn dạy.",
   "subjects": [
    "Địa lí",
    "Giáo dục kinh tế và pháp luật",
    "Sinh học",
    "Tin học"
   ],
   "majors": "Các ngành Sư phạm",
   "blocks": "Tùy ngành"
  },
  {
   "id": "c11",
   "name": "Tâm lí và công tác xã hội",
   "group": "X",
   "desc": "Lắng nghe, hỗ trợ cá nhân và cộng đồng vượt qua khó khăn.",
   "subjects": [
    "Địa lí",
    "Giáo dục kinh tế và pháp luật",
    "Sinh học",
    "Tin học"
   ],
   "majors": "Tâm lí học, Công tác xã hội",
   "blocks": "C00, D01"
  },
  {
   "id": "c12",
   "name": "Ngôn ngữ, du lịch và khách sạn",
   "group": "X",
   "desc": "Làm việc với người nước ngoài, tổ chức tour, quản lí dịch vụ lưu trú.",
   "subjects": [
    "Địa lí",
    "Giáo dục kinh tế và pháp luật",
    "Tin học",
    "Âm nhạc"
   ],
   "majors": "Ngôn ngữ Anh, Quản trị du lịch – khách sạn",
   "blocks": "D01, C00"
  },
  {
   "id": "c13",
   "name": "Kinh doanh và marketing",
   "group": "D",
   "desc": "Tìm hiểu khách hàng, xây thương hiệu, bán hàng và mở dự án riêng.",
   "subjects": [
    "Giáo dục kinh tế và pháp luật",
    "Địa lí",
    "Tin học",
    "Vật lí"
   ],
   "majors": "Quản trị kinh doanh, Marketing",
   "blocks": "A00, A01, D01"
  },
  {
   "id": "c14",
   "name": "Thương mại điện tử và logistics",
   "group": "D",
   "desc": "Vận hành cửa hàng online, kho vận, chuỗi cung ứng.",
   "subjects": [
    "Giáo dục kinh tế và pháp luật",
    "Địa lí",
    "Tin học",
    "Công nghệ"
   ],
   "majors": "Thương mại điện tử, Logistics",
   "blocks": "A01, D01"
  },
  {
   "id": "c15",
   "name": "Tài chính, ngân hàng, kế toán",
   "group": "Q",
   "desc": "Quản lí tiền, đầu tư, số liệu và báo cáo cho cá nhân, doanh nghiệp.",
   "subjects": [
    "Giáo dục kinh tế và pháp luật",
    "Vật lí",
    "Tin học",
    "Địa lí"
   ],
   "majors": "Tài chính – Ngân hàng, Kế toán, Kiểm toán",
   "blocks": "A00, A01, D01"
  },
  {
   "id": "c16",
   "name": "Luật và hành chính công",
   "group": "Q",
   "desc": "Giải thích quy định, bảo vệ quyền lợi, làm việc trong cơ quan nhà nước.",
   "subjects": [
    "Giáo dục kinh tế và pháp luật",
    "Địa lí",
    "Tin học",
    "Sinh học"
   ],
   "majors": "Luật, Quản lí nhà nước",
   "blocks": "C00, D01"
  }
 ],
 "questions": [
  {
   "group": "K",
   "text": "Mình thích tháo lắp, sửa đồ hoặc tìm hiểu máy móc hoạt động ra sao."
  },
  {
   "group": "T",
   "text": "Mình tò mò về cơ thể người, cây cối hoặc các thí nghiệm khoa học."
  },
  {
   "group": "N",
   "text": "Mình thích vẽ, thiết kế, quay dựng hoặc chơi nhạc."
  },
  {
   "group": "X",
   "text": "Mình vui khi giúp bạn hiểu bài hoặc lắng nghe người khác tâm sự."
  },
  {
   "group": "D",
   "text": "Mình thích thuyết phục người khác hoặc đứng ra tổ chức hoạt động cho cả nhóm."
  },
  {
   "group": "Q",
   "text": "Mình cẩn thận với số liệu, thích lập bảng chi tiêu và tính toán chính xác."
  },
  {
   "group": "K",
   "text": "Mình hứng thú với lập trình, làm game hoặc ứng dụng."
  },
  {
   "group": "T",
   "text": "Mình thích tìm câu trả lời cho “vì sao” bằng quan sát và đo đạc."
  },
  {
   "group": "N",
   "text": "Mình hay nghĩ ra ý tưởng mới, kể chuyện hoặc viết nội dung hấp dẫn."
  },
  {
   "group": "X",
   "text": "Mình thích làm tình nguyện, dạy kèm hoặc chăm sóc người khác."
  },
  {
   "group": "D",
   "text": "Mình thích tưởng tượng việc tự mở một cửa hàng hay dự án riêng."
  },
  {
   "group": "Q",
   "text": "Mình thích tranh luận có lý lẽ và tìm hiểu quy định, luật lệ."
  }
 ],
 "surveySubjects": [
  "Toán",
  "Ngữ văn",
  "Tiếng Anh",
  "Vật lí",
  "Hóa học",
  "Sinh học",
  "Tin học",
  "Công nghệ",
  "Địa lí",
  "Giáo dục kinh tế và pháp luật",
  "Mỹ thuật",
  "Âm nhạc"
 ],
 "electives": [
  "Địa lí",
  "Giáo dục kinh tế và pháp luật",
  "Vật lí",
  "Hóa học",
  "Sinh học",
  "Tin học",
  "Công nghệ",
  "Âm nhạc",
  "Mỹ thuật"
 ],
 "boost": {
  "Toán": "KTQ",
  "Ngữ văn": "XN",
  "Tiếng Anh": "DX"
 },
 "todo": [
  "Trò chuyện với bố mẹ về điều mình mong muốn",
  "Xem lại điểm các môn lớp 6–9: môn nào mình tiến bộ?",
  "Tìm hiểu 2–3 trường THPT và các tổ hợp môn trường mở",
  "Hỏi thầy cô về điểm mạnh của mình",
  "Tham dự buổi tư vấn chọn tổ hợp của trường",
  "Chốt phương án chính và một phương án dự phòng"
 ]
};
const LV=["Chưa thích","Cũng được","Rất thích"];
const DATA_KEY="ngare10_content_v1",DATA_DOC="site/content";
let G={},GC={},GI={},C=[],Q=[],SUB=[],SUBL=[],BOOST={},TODO=[];

// Chống chèn HTML: dữ liệu do admin nhập sẽ được thoát ký tự trước khi hiển thị
const esc=s=>String(s==null?"":s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const okColor=c=>/^#[0-9a-fA-F]{6}$/.test(c)?c:"#2C4BFF";
const okIcon=i=>/^[a-z0-9-]+$/.test(i||"")?i:"circle";

function validData(d){return !!d&&Array.isArray(d.groups)&&d.groups.length&&Array.isArray(d.careers)&&Array.isArray(d.questions)&&Array.isArray(d.electives)&&Array.isArray(d.surveySubjects)}

function applyData(d){
  G={};GC={};GI={};
  d.groups.forEach(g=>{G[g.key]=esc(g.name);GC[g.key]=okColor(g.color);GI[g.key]=okIcon(g.icon)});
  // C: [tên, nhóm, mô tả, môn lựa chọn (nối bằng |), ngành học, khối thi, id]
  C=d.careers.filter(c=>G[c.group]).map(c=>[esc(c.name),c.group,esc(c.desc),(c.subjects||[]).join("|"),esc(c.majors),esc(c.blocks),String(c.id)]);
  Q=d.questions.filter(q=>G[q.group]).map(q=>[q.group,esc(q.text)]);
  SUB=d.surveySubjects.slice();SUBL=d.electives.slice();BOOST=d.boost||{};
  TODO=(d.todo||[]).map(esc);
}

const DATA_READY=(async()=>{
  let d=null;
  try{
    if(typeof firebase==="undefined"||!window.DB)throw new Error("Firebase chưa tải");
    const snap=await Promise.race([DB.doc(DATA_DOC).get(),new Promise((_,r)=>setTimeout(()=>r(new Error("hết thời gian chờ")),5000))]);
    if(snap.exists&&validData(snap.data())){d=snap.data();try{localStorage.setItem(DATA_KEY,JSON.stringify(d))}catch(e){}}
  }catch(e){console.warn("Không tải được dữ liệu từ Firestore, dùng bản lưu trên máy hoặc dữ liệu mẫu.",e)}
  if(!d){try{const c=JSON.parse(localStorage.getItem(DATA_KEY));if(validData(c))d=c}catch(e){}}
  if(!d)d=DEFAULT_DATA;
  applyData(d);
})();
const onData=fn=>DATA_READY.then(fn);
