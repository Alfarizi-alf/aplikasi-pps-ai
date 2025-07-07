import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
// Pustaka Ikon
import { UploadCloud, FileText, BrainCircuit, LoaderCircle, AlertTriangle, ChevronRight, CheckCircle, ArrowRight, Download, Lightbulb, Zap, XCircle } from 'lucide-react';

// Impor modul Firebase
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

// --- Konfigurasi Firebase dari GitHub Secrets (Milik Pemilik Proyek) ---
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Fungsi pembantu untuk memuat skrip XLSX
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
  // State untuk API Key Pengguna
  const [apiKey, setApiKey] = useState('');
  const [isApiKeyInvalid, setIsApiKeyInvalid] = useState(false);
  
  // State untuk Data dan Proses
  const [rawData, setRawData] = useState(null);
  const [groupedData, setGroupedData] = useState(null);
  const [fileName, setFileName] = useState('');
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [loadingStates, setLoadingStates] = useState({});
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0, message: '' });
  const [modalMessage, setModalMessage] = useState({ message: '', type: '' });
  const [openStates, setOpenStates] = useState({});

  // State Firebase
  const [db, setDb] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  // Inisialisasi Firebase
  useEffect(() => {
    try {
      if (!firebaseConfig.apiKey) {
        console.error("Konfigurasi Firebase tidak ditemukan.");
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

  // Fungsi untuk memproses file Excel
  const onDrop = useCallback(async (acceptedFiles) => {
    setRawData(null);
    setGroupedData(null);
    setFileName('');
    setIsProcessingFile(true);
    const file = acceptedFiles[0];
    if (!file) {
      setModalMessage({ message: "File tidak valid.", type: 'error' });
      setIsProcessingFile(false);
      return;
    }
    setFileName(file.name);

    try {
      await loadXlsxScript();
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const workbook = window.XLSX.read(event.target.result, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const jsonData = window.XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: "" });
          setRawData(jsonData);
          // Proses data setelah di-set
          const processed = processData(jsonData);
          setGroupedData(processed);
        } catch (e) {
          setModalMessage({ message: "Gagal memproses file Excel.", type: 'error' });
        } finally {
          setIsProcessingFile(false);
        }
      };
      reader.readAsBinaryString(file);
    } catch (err) {
      setModalMessage({ message: err.message, type: 'error' });
      setIsProcessingFile(false);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'] } });

  // Fungsi untuk memproses data mentah menjadi hierarki
  const processData = (data) => {
    const groups = {};
    data.forEach((row, index) => {
      const cleanedRow = Object.keys(row).reduce((acc, key) => {
        acc[key.trim().toLowerCase().replace(/\s+/g, '')] = row[key];
        return acc;
      }, {});
      const codeKey = Object.keys(cleanedRow).find(k => k.includes('kode'));
      if (!codeKey || !cleanedRow[codeKey]) return;
      
      const code = String(cleanedRow[codeKey]);
      const parts = code.split('.');
      if (parts.length < 4) return;
      
      const [bab, standar, kriteria, ...epParts] = parts;
      const ep = epParts.join('.');

      if (!groups[bab]) groups[bab] = { title: `BAB ${bab}`, standards: {} };
      if (!groups[bab].standards[standar]) groups[bab].standards[standar] = { title: `Standar ${standar}`, criterias: {} };
      if (!groups[bab].standards[standar].criterias[kriteria]) {
        groups[bab].standards[standar].criterias[kriteria] = { title: `Kriteria ${kriteria}`, items: [] };
      }
      
      const itemData = {
        id: `${code}-${index}`,
        ...cleanedRow
      };
      groups[bab].standards[standar].criterias[kriteria].items.push(itemData);
    });
    return groups;
  };

  const toggleOpen = (id) => setOpenStates(prev => ({ ...prev, [id]: !prev[id] }));

  // ... (Fungsi-fungsi lain seperti callAiApi, handleApiError, dll. bisa ditambahkan di sini)

  return (
    <div className="bg-slate-900 min-h-screen text-white font-sans p-4 sm:p-6 lg:p-8">
      <MessageModal message={modalMessage.message} type={modalMessage.type} onClose={() => setModalMessage({ message: '', type: '' })} />
      <div className="max-w-7xl mx-auto">
        <header className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-cyan-400">Rencana Perbaikan Akreditasi Berbasis AI</h1>
          <p className="text-slate-400 mt-2">Unggah file, masukkan kunci API, biarkan AI membantu, lalu unduh hasilnya.</p>
        </header>

        {/* Bagian Input Kunci API */}
        <div className="bg-slate-800 rounded-xl p-6 mb-8 shadow-lg">
           <label htmlFor="apiKey" className="block text-sm font-medium text-slate-300 mb-2">Kunci API Google AI Anda</label>
           <input
             id="apiKey" type="password" value={apiKey}
             onChange={(e) => { setApiKey(e.target.value); setIsApiKeyInvalid(false); }}
             placeholder="Masukkan Kunci API Anda di sini..."
             className={`w-full bg-slate-700 border rounded-md px-3 py-2 text-white placeholder-slate-400 focus:outline-none focus:ring-2 ${isApiKeyInvalid ? 'border-red-500 focus:ring-red-500' : 'border-slate-600 focus:ring-cyan-500'}`}
           />
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

        {/* Bagian Upload File (Dropzone) */}
        {!groupedData && (
          <div {...getRootProps()} className={`w-full p-10 border-2 border-dashed rounded-xl transition-all duration-300 ${isProcessingFile ? 'cursor-wait bg-slate-800' : 'cursor-pointer hover:border-cyan-500 hover:bg-slate-800'} ${isDragActive ? 'border-cyan-400 bg-slate-700' : 'border-slate-600'}`}>
            <input {...getInputProps()} />
            <div className="flex flex-col items-center justify-center text-center">
              {isProcessingFile ? (
                <>
                  <LoaderCircle className="w-12 h-12 text-cyan-500 mb-4 animate-spin" />
                  <p className="text-lg font-semibold text-slate-300">Memproses file...</p>
                </>
              ) : (
                <>
                  <UploadCloud className="w-12 h-12 text-slate-500 mb-4" />
                  {isDragActive ?
                    <p className="text-lg font-semibold text-cyan-400">Lepaskan file di sini...</p> :
                    <p className="text-lg font-semibold text-slate-300">Seret & lepas file .xlsx di sini</p>
                  }
                </>
              )}
            </div>
          </div>
        )}

        {/* Bagian Tampilan Hasil */}
        {groupedData && (
          <div className="animate-fade-in space-y-2">
            <h2 className="text-2xl font-bold text-cyan-400 mb-4">Hasil Proses: {fileName}</h2>
            {Object.values(groupedData).map(bab => (
              <div key={bab.title} className="bg-slate-800 rounded-lg shadow-md overflow-hidden">
                <div onClick={() => toggleOpen(bab.title)} className="flex justify-between items-center bg-slate-700/50 px-6 py-3 cursor-pointer hover:bg-slate-700">
                  <h3 className="text-xl font-bold text-cyan-400">{bab.title}</h3>
                  <ChevronRight className={`w-6 h-6 text-cyan-400 transition-transform duration-300 ${openStates[bab.title] ? 'rotate-90' : ''}`} />
                </div>
                {openStates[bab.title] && (
                  <div className="p-4">
                    {/* Di sini Anda bisa menambahkan logika untuk menampilkan standar, kriteria, dan item */}
                    <p className="text-slate-400">Detail untuk {bab.title} akan ditampilkan di sini.</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
