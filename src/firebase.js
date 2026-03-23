import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCoC9NpSfuJBjG2LLtUiZjxes39bsDGWhQ",
  authDomain: "anima-pilates.firebaseapp.com",
  projectId: "anima-pilates",
  storageBucket: "anima-pilates.firebasestorage.app",
  messagingSenderId: "844940300678",
  appId: "1:844940300678:web:6dfb726b9ee5099d5edc07"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
