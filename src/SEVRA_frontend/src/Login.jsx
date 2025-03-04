import React, { useContext } from "react";
import { auth, googleProvider, db } from "./firebase";
import { signInWithPopup } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { WalletContext } from "./WalletContext"; // Import context untuk wallet

const Login = () => {
  const { account } = useContext(WalletContext); // Ambil account dari context

  const signInWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Simpan data pengguna ke Firestore
      await setDoc(doc(db, "users", user.uid), {
        email: user.email,
        name: user.displayName,
        photoURL: user.photoURL,
        walletAddress: account || "", // Gunakan account dari context, atau string kosong jika belum terhubung
      });

      console.log("User logged in and data saved:", user);
    } catch (error) {
      console.error("Error signing in with Google:", error);
    }
  };

  return (
    <div>
      <button onClick={signInWithGoogle}>Login with Google</button>
    </div>
  );
};

export default Login;