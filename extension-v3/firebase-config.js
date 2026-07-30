// firebase-config.js
// Cấu hình Firebase project của bạn.
// File này được nạp SAU các script firebase-*-compat.js và TRƯỚC auth.js / popup.js

const firebaseConfig = {
  apiKey: "AIzaSyBIJ_YqEVvDiqylaCiFu32ViE4RO9YSAZw",
  authDomain: "cdmtdc.firebaseapp.com",
  projectId: "cdmtdc",
  storageBucket: "cdmtdc.firebasestorage.app",
  messagingSenderId: "475971990786",
  appId: "1:475971990786:web:2557459a444e26a1c13e1b",
  measurementId: "G-EVX6D75Y7V",
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db = firebase.firestore();
