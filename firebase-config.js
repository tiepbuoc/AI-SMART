// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBIJ_YqEVvDiqylaCiFu32ViE4RO9YSAZw",
  authDomain: "cdmtdc.firebaseapp.com",
  projectId: "cdmtdc",
  storageBucket: "cdmtdc.firebasestorage.app",
  messagingSenderId: "475971990786",
  appId: "1:475971990786:web:2557459a444e26a1c13e1b",
  measurementId: "G-EVX6D75Y7V",
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
