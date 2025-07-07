import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
// Pustaka Ikon
import { UploadCloud, FileText, BrainCircuit, LoaderCircle, AlertTriangle, ChevronRight, CheckCircle, ArrowRight, Download, Lightbulb, Zap, XCircle } from 'lucide-react';

// Impor modul Firebase
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

// --- Konfigurasi Firebase dari Environment Variables (Milik Pemilik Proyek) ---
// Kunci-kunci ini diambil dari GitHub Secrets saat deploy
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Fungsi pembantu untuk memuat skrip XLSX secara dinamis
const loadXlsxScript = () => {
  return new Promise((resolve, reject) => {
    if (window.XLSX) return resolve();
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Gagal memuat pustaka Excel.'));
    document.head.appendChild(script);
  });
};

// Komponen Modal Pesan
const MessageModal = ({ message, type, onClose }) => {
  if (!message) return null;
  const bgColor = type === 'error' ? 'bg-red-800' : 'bg-blue-800';
  const textColor = type === 'error' ? 'text-red-100' : 'text-blue-100';
  const borderColor = type === 'error' ? 'border-red-700' : 'border-blue-700';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`rounded-lg shadow-xl p-6 border ${bgColor} ${borderColor} max-w-sm w-full mx-auto animate-fade-in`}>
        <div className="flex justify-between items-center mb-4">
          <h3 className={`text-lg font-bold ${textColor}`}>Pesan</h3>
          <button onClick={onClose} className="text-white hover:text-gray-300"><XCircle className="w-6 h-6" /></button>
        </div>
        <p className={`text-sm ${textColor} mb-4`}>{message}</p>
        <div className="text-right">
          <button onClick={onClose} className="px-4 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-500">Tutup</button>
        </div>
      </div>
    </div>
  );
};

// Komponen Aplikasi Utama
export default function App() {
  // --- STATE APLIKASI ---
  // Kunci API Gemini, dimasukkan oleh pengguna
  const [apiKey, setApiKey] = useState('');
  const [isApiKeyInvalid, setIsApiKeyInvalid] = useState(false);

  // State untuk data dan proses
  const [rawData, setRawData] = useState(null);
  const [groupedData, setGroupedData] = useState(null);
  const [fileName, setFileName] = useState('');
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  
  // State untuk UI
  const [loadingStates, setLoadingStates] = useState({});
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0, message: '' });
  const [modalMessage, setModalMessage] = useState({ message: '', type: '' });
  const [batchResult, setBatchResult] = useState(null);
  const [openStates, setOpenStates] = useState({});
  
  // State untuk hasil AI
  const [aiSummary, setAiSummary] = useState('');
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);

  // State Firebase
  const [db, setDb] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // --- EFEK & INISIALISASI ---

  // Inisialisasi Firebase saat aplikasi dimuat
  useEffect(() => {
    try {
      if (!firebaseConfig.apiKey) {
        console.error("Konfigurasi Firebase tidak ditemukan. Fitur penyimpanan data tidak akan berfungsi.");
        setIsAuthReady(true);
        return;
      }
      const app = initializeApp(firebaseConfig);
      const firestoreDb = getFirestore(app);
      const auth = getAuth(app);
      setDb(firestoreDb);

      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
          setUserId(user.uid);
        } else {
          try {
            await signInAnonymously(auth);
          } catch (authError) {
            console.error("Kesalahan Otentikasi Firebase:", authError);
          }
        }
        setIsAuthReady(true);
      });
      return () => unsubscribe();
    } catch (e) {
      console.error("Kesalahan saat menginisialisasi Firebase:", e);
      setIsAuthReady(true);
    }
  }, []);

  // Simpan data ke Firestore setiap kali ada perubahan
  const saveToFirestore = useCallback(async (dataToSave, currentFileName, currentUserId) => {
    if (!db || !currentUserId || !currentFileName) return;
    if (Object.keys(dataToSave).length === 0 && !aiSummary) return;
    
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const docRef = doc(db, `artifacts/${appId}/users/${currentUserId}/pps_data`, currentFileName);
    
    try {
      await setDoc(docRef, {
        groupedData: dataToSave,
        aiSummary: aiSummary,
        timestamp: new Date(),
      }, { merge: true });
    } catch (e) {
      console.error("Kesalahan saat menyimpan ke Firestore:", e);
    }
  }, [db, aiSummary]);

  useEffect(() => {
    if (isAuthReady && userId && fileName && groupedData) {
      const handler = setTimeout(() => {
        saveToFirestore(groupedData, fileName, userId);
      }, 1500);
      return () => clearTimeout(handler);
    }
  }, [groupedData, aiSummary, userId, fileName, isAuthReady, saveToFirestore]);


  // --- FUNGSI INTI ---

  // Fungsi untuk memanggil Google AI API menggunakan kunci dari pengguna
  const callAiApi = async (prompt) => {
    if (!apiKey) {
      setIsApiKeyInvalid(true);
      throw new Error("API_KEY_MISSING");
    }
    setIsApiKeyInvalid(false);
    
    const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorBody = await response.json();
      if (response.status === 400 && errorBody?.error?.message.includes("API key not valid")) {
          setIsApiKeyInvalid(true);
          throw new Error("API_KEY_INVALID");
      }
      throw new Error(`Kesalahan HTTP: ${response.status}`);
    }
    const result = await response.json();
    if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
        return result.candidates[0].content.parts[0].text.trim().replace(/^"|"$/g, '');
    }
    return "Respons AI tidak valid.";
  };

  // Fungsi untuk menangani error API
  const handleApiError = (e) => {
    let message;
    if (e.message === "API_KEY_INVALID") {
        message = "Kunci API tidak valid. Harap periksa kembali kunci API dari Google AI Studio.";
    } else if (e.message === "API_KEY_MISSING") {
        message = "Harap masukkan Kunci API Google AI Anda terlebih dahulu.";
    } else {
        message = `Gagal menghubungi AI. Periksa koneksi internet Anda atau coba lagi nanti. (${e.message})`;
    }
    setModalMessage({ message, type: 'error' });
    console.error("Kesalahan API:", e);
  };
  
  // (Fungsi-fungsi lain seperti onDrop, processData, updateItemState, dll. tetap sama)
  // ... [Sisa fungsi-fungsi yang tidak berubah bisa diletakkan di sini]

  // --- RENDER KOMPONEN ---
  return (
    <div className="bg-slate-900 min-h-screen text-white font-sans p-4 sm:p-6 lg:p-8">
      <MessageModal
        message={modalMessage.message}
        type={modalMessage.type}
        onClose={() => setModalMessage({ message: '', type: '' })}
      />
      {/* ... [Sisa komponen modal] ... */}

      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-cyan-400">Rencana Perbaikan Akreditasi Berbasis AI</h1>
          <p className="text-slate-400 mt-2">Unggah file, masukkan kunci API, biarkan AI membantu, lalu unduh hasilnya.</p>
        </header>

        {/* Bagian Input Kunci API */}
        <div className="bg-slate-800 rounded-xl p-6 mb-8 shadow-lg">
           <label htmlFor="apiKey" className="block text-sm font-medium text-slate-300 mb-2">Kunci API Google AI Anda</label>
           <input
             id="apiKey"
             type="password"
             value={apiKey}
             onChange={(e) => { setApiKey(e.target.value); setIsApiKeyInvalid(false); }}
             placeholder="Masukkan Kunci API Anda di sini..."
             className={`w-full bg-slate-700 border rounded-md px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 ${isApiKeyInvalid ? 'border-red-500 focus:ring-red-500' : 'border-slate-600 focus:ring-cyan-500'}`}
           />
           <p className="text-xs text-slate-500 mt-2">Kunci API Anda tidak disimpan. Hanya digunakan di browser Anda untuk sesi ini.</p>
           {isApiKeyInvalid && (
              <p className="text-sm text-red-400 mt-2 flex items-center">
                  <AlertTriangle className="w-4 h-4 mr-1"/> Kunci API tidak valid atau belum dimasukkan.
              </p>
           )}
           <div className="mt-4">
              <button onClick={() => setOpenStates(prev => ({...prev, isHelpOpen: !prev.isHelpOpen}))} className="text-sm font-medium text-cyan-400 cursor-pointer hover:text-cyan-300 list-none flex items-center gap-1">
                  Bagaimana cara mendapatkan Kunci API?
                  <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${openStates.isHelpOpen ? 'rotate-90' : ''}`} />
              </button>
              {openStates.isHelpOpen && (
                <div className="mt-2 text-sm text-slate-400 bg-slate-900/50 p-4 rounded-md border border-slate-700">
                    <ol className="list-decimal list-inside space-y-2">
                        <li>Buka situs <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-teal-400 hover:underline">Google AI Studio</a>.</li>
                        <li>Masuk dengan akun Google Anda.</li>
                        <li>Klik tombol <span className="font-semibold text-slate-300">"Buat kunci API"</span>.</li>
                        <li>Salin (copy) kunci API yang baru dibuat.</li>
                        <li>Tempel (paste) kunci API tersebut ke kolom di atas.</li>
                    </ol>
                </div>
              )}
           </div>
        </div>

        {/* Sisa UI aplikasi (Dropzone, Tampilan Data, dll.) */}
        {/* ... [Kode UI lainnya tetap sama] ... */}
      </div>
    </div>
  );
}
