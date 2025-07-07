Perencana Perbaikan Strategis (PPS) Berbasis AI
Aplikasi web ini membantu institusi untuk mempercepat proses perencanaan perbaikan strategis berdasarkan temuan dari hasil survei akreditasi.
Cara Kerja
Masukkan Kunci API: Pengguna memasukkan kunci API Google Gemini mereka sendiri.
Unggah File Excel: Unggah file berisi elemen penilaian.
Bantuan AI: Gunakan AI untuk menghasilkan rekomendasi Rencana Tindak Lanjut (RTL), Indikator, Sasaran, dan Bukti Implementasi.
Sinkronisasi & Unduh: Semua perubahan disimpan otomatis ke cloud (menggunakan Firebase backend milik proyek ini) dan hasilnya bisa diunduh.
Tumpukan Teknologi
Frontend: React (dengan Vite)
Styling: Tailwind CSS
AI: Google Gemini API (Kunci disediakan oleh pengguna)
Backend & Database: Firebase (Authentication & Firestore)
Deployment: GitHub Pages dengan GitHub Actions
Panduan untuk Pemilik Proyek (Anda)
Setup Awal
Clone Repositori: git clone ...
Install Dependencies: npm install
Siapkan Firebase:
Buat proyek di Firebase.
Aktifkan Authentication (metode: Anonymous) dan Firestore.
Atur GitHub Secrets:
Di repositori GitHub Anda, pergi ke Settings > Secrets and variables > Actions.
Tambahkan semua konfigurasi Firebase Anda sebagai secrets (contoh: VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, dll.).
Cara Deploy
Cukup push perubahan ke branch main. GitHub Actions akan menangani proses build dan deploy secara otomatis.
Panduan untuk Pengguna Aplikasi
Buka website aplikasi yang sudah di-deploy.
Pergi ke Google AI Studio untuk mendapatkan Kunci API Anda.
Salin dan tempel Kunci API Anda ke dalam kolom yang tersedia di aplikasi.
Mulai gunakan aplikasi!
