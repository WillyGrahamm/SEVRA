import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBftSmvyf4d7JJ1rIitwuJBvebIEraIlPE",
  authDomain: "sevra-f9943.firebaseapp.com",
  projectId: "sevra-f9943",
  storageBucket: "sevra-f9943.firebasestorage.app",
  messagingSenderId: "376916474638",
  appId: "1:376916474638:web:35a8358f2898629c33f55f",
  measurementId: "G-EZ2KDE8PMV"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();
const db = getFirestore(app);

export { auth, googleProvider, db };