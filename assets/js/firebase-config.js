/* Cấu hình Firebase (khóa web của Firebase không phải bí mật; việc bảo vệ dữ liệu nằm ở Firestore Rules, xem firestore.rules) */
const firebaseConfig={
  apiKey:"AIzaSyAQwkoRenPJ8gqz2-adIMihyA3cPMMiCyg",
  authDomain:"nr10-34b6a.firebaseapp.com",
  projectId:"nr10-34b6a",
  storageBucket:"nr10-34b6a.firebasestorage.app",
  messagingSenderId:"89774212375",
  appId:"1:89774212375:web:581303bb0f5f680ae52352",
  measurementId:"G-9D4YDJ1Z0R"
};
try{
  if(typeof firebase!=="undefined"){
    firebase.initializeApp(firebaseConfig);
    window.DB=firebase.firestore();
  }
}catch(e){console.warn("Không khởi tạo được Firebase",e)}
