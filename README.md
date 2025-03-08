# SEVRA

## Selamat Datang di Proyek SEVRA!
Proyek ini dikembangkan untuk berjalan di Internet Computer. Secara default, proyek ini dilengkapi dengan README dan beberapa file template untuk mempermudah siklus pengembangan.

---

## Cara Clone Proyek

```bash
# Metode standar:
git clone https://github.com/WillyGrahamm/SEVRA.git

# Jika metode standar gagal, gunakan:
git clone -c http.version=HTTP/1.1 https://github.com/WillyGrahamm/SEVRA.git

# Atau menggunakan SSH jika telah mengatur kunci SSH:
git clone git@github.com:WillyGrahamm/SEVRA.git
```

---

## Konfigurasi HTTPS untuk Vite

Setelah clone proyek, konfigurasikan HTTPS untuk Vite:

```bash
cd SEVRA

# Install dependencies
sudo apt install libnss3-tools # Dependensi mkcert
sudo apt install mkcert

# Verifikasi Instalasi
mkcert -version # Harus menampilkan versi

# Buat Sertifikat
mkdir -p ~/.vite-certs
cd ~/.vite-certs
mkcert -key-file localhost+2-key.pem -cert-file localhost+2.pem localhost 127.0.0.1 ::1
mkcert -install # Instal CA ke sistem agar browser mempercayai
cd ~/SEVRA  # Kembali ke direktori proyek
```

---

## Cara Menjalankan Proyek

### Backend (Motoko)

Buka terminal dan pindah ke direktori proyek:

```bash
cd SEVRA/
```

Install dependencies:

```bash
npm install
```

Jalankan perintah berikut untuk memulai:

```bash
dfx start --background  # Menjalankan replica di background
```

Jika ingin membersihkan semua riwayat sebelum menjalankan ulang:

```bash
dfx start --clean --background
```

Jika menggunakan opsi `--clean`, buat ulang canister:

```bash
dfx canister create rwa
```

Bangun dan deploy canister:

```bash
dfx build rwa
dfx deploy rwa
```

---

### Frontend (React & Web3)

Pindah ke direktori frontend:

```bash
cd src/SEVRA_frontend/
```

Install & Jalankan development server:

```bash
npm install
npm run dev
```

Klik link yang muncul di terminal, biasanya [http://localhost:5173/](http://localhost:5173/).

---

## Koneksi ke Aplikasi

Setelah aplikasi berjalan di localhost:

1. **Connect ke Google account**
2. **Connect wallet** (contohnya Zerion)
3. Jika sudah memiliki wallet yang terinstall/men-setup walletnya, refresh halaman dan klik kembali opsi connect wallet
4. Pilih opsi wallet yang sudah memiliki keterangan "terinstall" (biasanya dia men-detectnya MetaMask)
5. Anda akan diarahkan ke proses **KYC** dengan mengisi password wallet Anda

---

## Full Experience (Landing Page)

Untuk menikmati pengalaman penuh dari SEVRA, buka file berikut:

```bash
Buka File Explorer di Ubuntu
Navigasikan ke:
/home/willygrahammm/SEVRA/src/SEVRA_frontend/public/sevra_webpage.html
```

Klik dua kali untuk membuka di browser.

---

## Dokumentasi

Untuk melihat dokumentasi lebih lanjut, bisa mengakses navbar **"About"** atau langsung ke:

- **SEVRA Finance Documentation**

---

## Tim Pengembang

Tim terdiri dari **3 orang**, namun proyek ini dikembangkan oleh hanya **2 orang** karena satu anggota tidak aktif. Semua animasi dan video yang digunakan adalah hasil produksi internal kami sendiri.

---
