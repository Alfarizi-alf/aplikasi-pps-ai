# Perencana Perbaikan Strategis (PPS) Berbasis AI

Aplikasi web ini membantu institusi (seperti Puskesmas atau lembaga pendidikan) untuk mempercepat proses perencanaan perbaikan strategis berdasarkan temuan dari hasil survei akreditasi. Dengan mengunggah file Excel berisi elemen penilaian, aplikasi ini akan memetakannya ke dalam hierarki yang jelas dan menggunakan AI (Google Gemini) untuk menghasilkan rekomendasi Rencana Tindak Lanjut (RTL), Indikator, Sasaran, hingga bukti implementasi (Keterangan).

![Contoh Tampilan Aplikasi](https://placehold.co/800x450/1e293b/94a3b8?text=Contoh+Tampilan+Aplikasi+Anda)

## Fitur Utama

-   **Unggah & Proses Excel**: Unggah file `.xlsx` atau `.csv` dengan format standar akreditasi.
-   **Tampilan Hierarki**: Data ditampilkan dalam struktur Bab -> Standar -> Kriteria -> Elemen Penilaian yang mudah dinavigasi.
-   **Asisten AI**:
    -   Buat ide **Rencana Perbaikan (RTL)** dari rekomendasi awal.
    -   Buat **Indikator** dan **Sasaran** yang terukur.
    -   Buat **Keterangan (Judul Dokumen Bukti)** secara otomatis.
-   **Sinkronisasi Cloud**: Semua perubahan disimpan secara *real-time* ke Firebase Firestore, memungkinkan kolaborasi dan mencegah kehilangan data.
-   **Ekspor Data**: Unduh semua hasil kerja Anda dalam format `.xlsx`, `.csv`, atau `.docx`.

## Tumpukan Teknologi

-   **Frontend**: React (dengan Vite)
-   **Styling**: Tailwind CSS
-   **AI**: Google Gemini API
-   **Backend & Database**: Firebase (Authentication & Firestore)
-   **Deployment**: GitHub Pages

---

## Panduan Setup & Instalasi

### Prasyarat

1.  **Node.js**: Pastikan Node.js versi 18 atau lebih baru terinstal.
2.  **Akun Google**: Untuk mendapatkan kunci API Gemini.
3.  **Akun Firebase**: Untuk membuat proyek dan mendapatkan konfigurasi Firebase.

### Langkah-langkah Instalasi

1.  **Clone Repositori**
    ```bash
    git clone [https://github.com/NAMA_PENGGUNA_ANDA/NAMA_REPOSITORI_ANDA.git](https://github.com/NAMA_PENGGUNA_ANDA/NAMA_REPOSITORI_ANDA.git)
    cd NAMA_REPOSITORI_ANDA
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Buat File Environment (`.env.local`)**

    Buat sebuah file baru di direktori utama proyek dengan nama `.env.local`. File ini **SANGAT PENTING** dan tidak akan diunggah ke GitHub. Salin konten di bawah ini ke dalam file tersebut dan isi dengan kunci dan konfigurasi Anda sendiri.

    ```env
    # Ambil dari Google AI Studio ([https://aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey))
    VITE_GEMINI_API_KEY="MASUKKAN_KUNCI_API_GEMINI_ANDA_DI_SINI"

    # Ambil dari Pengaturan Proyek Firebase Anda
    VITE_FIREBASE_API_KEY="MASUKKAN_FIREBASE_API_KEY"
    VITE_FIREBASE_AUTH_DOMAIN="proyek-anda.firebaseapp.com"
    VITE_FIREBASE_PROJECT_ID="proyek-anda"
    VITE_FIREBASE_STORAGE_BUCKET="proyek-anda.appspot.com"
    VITE_FIREBASE_MESSAGING_SENDER_ID="1234567890"
    VITE_FIREBASE_APP_ID="1:1234567890:web:abcdef123456"
    ```

4.  **Jalankan Aplikasi Secara Lokal**
    ```bash
    npm run dev
    ```
    Buka `http://localhost:5173` (atau port lain yang ditampilkan) di browser Anda.

### Deployment ke GitHub Pages

1.  **Update `package.json`**:
    -   Ganti nilai `homepage` dengan URL GitHub Pages Anda (`https://NAMA_PENGGUNA_ANDA.github.io/NAMA_REPOSITORI_ANDA`).

2.  **Update `vite.config.js`**:
    -   Ganti nilai `base` dengan nama repositori Anda (`/NAMA_REPOSITORI_ANDA/`).

3.  **Jalankan Perintah Deploy**:
    ```bash
    npm run deploy
    ```
    Skrip ini akan secara otomatis membuat build produksi dan mengunggahnya ke branch `gh-pages` di repositori Anda. Aktifkan GitHub Pages dari branch ini di pengaturan repositori Anda.
    