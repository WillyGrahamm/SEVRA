# `SEVRA`

Selamat datang di proyek `SEVRA`! Proyek ini dikembangkan sebagai bagian dari ekosistem Internet Computer.

## 📖 Tentang SEVRA

Proyek ini memungkinkan pengembang untuk bereksperimen dengan teknologi blockchain dan smart contract berbasis Internet Computer. Semua pengembangan dilakukan secara independen oleh tim kecil kami.

## 🚀 Cara Menjalankan Proyek

Untuk menjalankan proyek ini secara lokal, ikuti langkah-langkah berikut:

### 1. Buka Terminal (Ubuntu atau CLI lain yang mendukung DFX)
```bash
cd SEVRA
```

### 2. Mulai replikanya
```bash
dfx start --background
```
Jika ingin membersihkan semua riwayat sebelumnya, gunakan:
```bash
dfx start --clean --background
```

### 3. Deploy Canister
```bash
dfx canister create rwa  # (Hanya jika menggunakan opsi clean, jika tidak, skip langkah ini)
dfx build rwa
dfx deploy rwa
```

### 4. Jalankan Frontend
```bash
cd src/SEVRA_frontend
npm run dev
```
Setelah itu, buka browser dan akses:  
👉 `https://localhost:5173/`  
Selamat menikmati!

## 🎨 Full Experience

Untuk menikmati pengalaman penuh, kunjungi:
```
src/SEVRA_frontend/public/sevra_webpage.html  --> Buka di File Explorernya
```
Di sana, kamu bisa melihat landing page, aset web, dan elemen lain yang telah kami buat.

### ℹ️ Dokumentasi Tambahan
Lebih banyak informasi tersedia di halaman dokumentasi kami:  
🔗 [SEVRA Documentation](https://sevra-finance.gitbook.io/sevra_ff/)

## 👥 Tim Pengembang
Tim ini terdiri dari 3 orang, namun hanya 2 yang aktif mengembangkan proyek ini. Semua animasi dan video yang digunakan berasal dari internal tim kami sendiri.

---
Terima kasih telah mencoba SEVRA! 🚀
