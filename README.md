# `SEVRA`

Selamat datang di proyek `SEVRA`! Ini adalah proyek yang dikembangkan untuk berjalan di Internet Computer. Secara default, proyek ini dilengkapi dengan README dan beberapa file template untuk mempermudah siklus pengembangan.

## Cara Menjalankan Proyek

Untuk menjalankan proyek ini di lokal, ikuti langkah-langkah berikut:

### Backend (Motoko)
1. Buka terminal dan pindah ke direktori proyek:
   ```bash
   cd SEVRA/
   ```
2. Jalankan perintah berikut untuk memulai:
   ```bash
   dfx start --background  # Menjalankan replica di background
   ```
3. Jika ingin membersihkan semua riwayat sebelum menjalankan ulang:
   ```bash
   dfx start --clean --background
   ```
4. Jika menggunakan opsi `--clean`, buat ulang canister:
   ```bash
   dfx canister create rwa
   ```
5. Bangun dan deploy canister:
   ```bash
   dfx build rwa
   dfx deploy rwa
   ```

### Frontend (React & Web3)
1. Pindah ke direktori frontend:
   ```bash
   cd src/SEVRA_frontend/
   ```
2. Install & Jalankan development server:
   ```bash
   npm install
   npm run dev
   ```
3. Klik link yang muncul di terminal, biasanya `http://localhost:5173/`.

## Full Experience (Landing Page)
Untuk menikmati pengalaman penuh dari SEVRA, buka file berikut:
1. Buka **File Explorer** di Ubuntu.
2. Navigasikan ke:
   ```
   /home/willygrahammm/SEVRA/src/SEVRA_frontend/public/sevra_webpage.html
   ```
3. Klik dua kali untuk membuka di browser.

## Dokumentasi
Untuk melihat dokumentasi lebih lanjut, bisa mengakses navbar "About" atau langsung ke:
[SEVRA Finance Documentation](https://sevra-finance.gitbook.io/sevra_ff/)

## Tim Pengembang
Tim terdiri dari **3 orang**, namun proyek ini dikembangkan oleh **hanya 2 orang** karena satu anggota tidak aktif. Semua animasi dan video yang digunakan adalah hasil produksi internal kami sendiri.
