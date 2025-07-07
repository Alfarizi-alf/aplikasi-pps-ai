import React, { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
// Pustaka pihak ketiga
import { UploadCloud, FileText, BrainCircuit, LoaderCircle, AlertTriangle, ChevronRight, CheckCircle, ArrowRight, Download, Lightbulb, Zap, XCircle } from 'lucide-react';

// Impor modul Firebase
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc } from 'firebase/firestore';

// --- Variabel Lingkungan untuk Konfigurasi Aman ---
// Kunci-kunci ini diambil dari file .env.local Anda
const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Fungsi pembantu untuk memuat skrip XLSX secara dinamis dari CDN
const loadXlsxScript = () => {
  return new Promise((resolve, reject) => {
    if (window.XLSX) return resolve();
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Gagal memuat pustaka Excel. Periksa koneksi internet Anda.'));
    document.head.appendChild(script);
  });
};

// Komponen Modal Pesan Kustom (Menggantikan window.alert)
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
          <button onClick={onClose} className="text-white hover:text-gray-300">
            <XCircle className="w-6 h-6" />
          </button>
        </div>
        <p className={`text-sm ${textColor} mb-4`}>{message}</p>
        <div className="text-right">
          <button onClick={onClose} className="px-4 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-500 transition-colors duration-200">
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};


// Komponen Aplikasi Utama
export default function App() {
  // State untuk data dan UI
  const [rawData, setRawData] = useState(null);
  const [groupedData, setGroupedData] = useState(null);
  const [fileName, setFileName] = useState('');
  const [error, setError] = useState('');
  const [loadingStates, setLoadingStates] = useState({});
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [downloadFormat, setDownloadFormat] = useState('xlsx');
  const [openStates, setOpenStates] = useState({});
  const [aiSummary, setAiSummary] = useState('');
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0, message: '' });
  const [documentInventory, setDocumentInventory] = useState(null);
  const [groupedDocumentsByTypeForDisplay, setGroupedDocumentsByTypeForDisplay] = useState(null);
  const [showDocumentInventory, setShowDocumentInventory] = useState(false);
  const [showDocumentGrouping, setShowDocumentGrouping] = useState(false);
  const [modalMessage, setModalMessage] = useState({ message: '', type: '' });
  const [batchResult, setBatchResult] = useState(null);

  // State Firebase
  const [db, setDb] = useState(null);
  const [userId, setUserId] = useState(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isApiKeyMissing, setIsApiKeyMissing] = useState(false);

  // --- Inisialisasi dan Otentikasi Firebase ---
  useEffect(() => {
    // Cek apakah kunci API Gemini ada
    if (!geminiApiKey) {
        setIsApiKeyMissing(true);
        setModalMessage({ message: "Kunci API Google AI tidak ditemukan. Harap pastikan Anda telah membuat file .env.local dan mengisinya dengan benar.", type: 'error' });
    }

    try {
      if (!firebaseConfig.apiKey) {
        console.error("Konfigurasi Firebase tidak ditemukan di environment variables. Persistensi tidak akan berfungsi.");
        setModalMessage({ message: "Konfigurasi Firebase tidak ditemukan. Fitur penyimpanan data tidak akan berfungsi.", type: 'error' });
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
          console.log("Pengguna terautentikasi:", user.uid);
        } else {
          try {
            await signInAnonymously(auth);
            console.log("Masuk secara anonim.");
          } catch (authError) {
            console.error("Kesalahan Otentikasi Firebase:", authError);
            setModalMessage({ message: `Gagal otentikasi Firebase: ${authError.message}`, type: 'error' });
          }
        }
        setIsAuthReady(true);
      });

      return () => unsubscribe();
    } catch (e) {
      console.error("Kesalahan saat menginisialisasi Firebase:", e);
      setModalMessage({ message: `Gagal menginisialisasi Firebase: ${e.message}`, type: 'error' });
      setIsAuthReady(true);
    }
  }, []);

  // --- Penyimpanan Data Firestore ---
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
      console.log("Data berhasil disimpan ke Firestore!");
    } catch (e) {
      console.error("Kesalahan saat menyimpan ke Firestore:", e);
      setError(`Gagal menyimpan ke cloud: ${e.message}`);
    }
  }, [db, aiSummary]);

  // Efek untuk memicu penyimpanan saat data berubah
  useEffect(() => {
    if (isAuthReady && userId && fileName && groupedData) {
      const handler = setTimeout(() => {
        saveToFirestore(groupedData, fileName, userId);
      }, 1500);
      return () => clearTimeout(handler);
    }
  }, [groupedData, aiSummary, userId, fileName, isAuthReady, saveToFirestore]);

  // Fungsi untuk memproses data Excel mentah
  const processData = (data) => {
    const groups = {};
    data.forEach((row, index) => {
      const cleanedRow = Object.keys(row).reduce((acc, key) => {
          acc[key.trim().toLowerCase().replace(/\s+/g, '')] = row[key];
          return acc;
      }, {});
      
      const codeKey = Object.keys(cleanedRow).find(k => k.includes('babstandarkriteriaelemenpenilaian') || k.includes('kodeep') || k.includes('kode'));
      if (!codeKey || !cleanedRow[codeKey]) {
        console.warn(`Melewatkan baris ${index}: Kolom kode hierarki tidak ditemukan atau kosong.`);
        return;
      }

      const code = String(cleanedRow[codeKey]);
      const parts = code.split('.');
      if (parts.length < 4) {
        console.warn(`Melewatkan baris ${index}: Kode hierarki tidak valid (kurang dari 4 bagian): ${code}`);
        return;
      }
      
      const [bab, standar, kriteria, ...epParts] = parts;
      const ep = epParts.join('.');

      if (!groups[bab]) groups[bab] = { title: `BAB ${bab}`, standards: {} };
      if (!groups[bab].standards[standar]) groups[bab].standards[standar] = { title: `Standar ${standar}`, criterias: {} };
      if (!groups[bab].standards[standar].criterias[kriteria]) {
        groups[bab].standards[standar].criterias[kriteria] = { title: `Kriteria ${kriteria}`, items: [] };
      }
      
      const itemData = {
        id: `${code}-${index}`,
        kode_ep: code,
        uraian_ep: cleanedRow['uraianelemenpenilaian'] || '',
        rekomendasi_survey: cleanedRow['rekomendasihasilsurvey'] || '',
        rencana_perbaikan: cleanedRow['rencanaperbaikan'] || '',
        indikator: cleanedRow['indikatorpencapaian'] || cleanedRow['indikator'] || '',
        sasaran: cleanedRow['sasaran'] || '',
        waktu: cleanedRow['waktupenyelesaian'] || cleanedRow['waktu'] || '',
        pj: cleanedRow['penanggungjawab'] || cleanedRow['pj'] || '',
        keterangan: "Klik 'Buat Keterangan'",
      };
      groups[bab].standards[standar].criterias[kriteria].items.push(itemData);
    });
    return groups;
  };

  // Fungsi untuk menangani file drop
  const onDrop = useCallback(async (acceptedFiles) => {
    setError(''); setRawData(null); setGroupedData(null); setFileName(''); setAiSummary(''); setDocumentInventory(null); setGroupedDocumentsByTypeForDisplay(null); setShowDocumentInventory(false); setShowDocumentGrouping(false); setModalMessage({ message: '', type: '' }); setBatchResult(null);
    setIsProcessingFile(true);
    const file = acceptedFiles[0];
    if (!file) { setModalMessage({ message: "File tidak valid.", type: 'error' }); setIsProcessingFile(false); return; }
    setFileName(file.name);

    try {
      await loadXlsxScript();
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const workbook = window.XLSX.read(event.target.result, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const jsonData = window.XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], {defval: ""});
          if(jsonData.length === 0) { 
            setModalMessage({ message: "File Excel kosong atau formatnya tidak bisa dibaca.", type: 'error' }); 
            setRawData(null);
            return; 
          }
          setRawData(jsonData); 
        } catch (e) { 
          setModalMessage({ message: "Terjadi kesalahan saat memproses file Excel. Pastikan format file benar.", type: 'error' });
          console.error("Kesalahan pemprosesan file:", e);
        } finally { 
          setIsProcessingFile(false); 
        }
      };
      reader.onerror = () => { 
        setModalMessage({ message: "Gagal membaca file.", type: 'error' }); 
        setIsProcessingFile(false); 
      }
      reader.readAsBinaryString(file);
    } catch (err) { 
      setModalMessage({ message: err.message, type: 'error' }); 
      setIsProcessingFile(false); 
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop, accept: { 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'], 'text/csv': ['.csv'] }, disabled: isProcessingFile });

  // Efek untuk memproses data dan memuat dari Firestore
  useEffect(() => {
    const loadAndProcess = async () => {
      if (!rawData || !isAuthReady || !userId || !db || !fileName) return;

      setGenerationProgress({ current: 0, total: 0, message: 'Memproses data dan memuat dari cloud...' });
      setError('');

      try {
        let processedData = processData(rawData);
        if (Object.keys(processedData).length === 0) {
            setError("Data tidak dapat diproses. Pastikan file Anda memiliki kolom kode hierarki yang valid.");
            setRawData(null); 
            setGenerationProgress({ current: 0, total: 0, message: '' });
            return;
        }

        const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
        const docRef = doc(db, `artifacts/${appId}/users/${userId}/pps_data`, fileName);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          console.log("Data yang ada ditemukan di Firestore untuk file:", fileName);
          const savedData = docSnap.data();
          const savedGroupedData = savedData.groupedData;
          const savedAiSummary = savedData.aiSummary;

          for (const babKey in processedData) {
            if (savedGroupedData && savedGroupedData[babKey]) {
              for (const stdKey in processedData[babKey].standards) {
                if (savedGroupedData[babKey].standards[stdKey]) {
                  for (const kriKey in processedData[babKey].standards[stdKey].criterias) {
                    if (savedGroupedData[babKey].standards[stdKey].criterias[kriKey]) {
                      processedData[babKey].standards[stdKey].criterias[kriKey].items = 
                        processedData[babKey].standards[stdKey].criterias[kriKey].items.map(newItem => {
                          const existingItem = savedGroupedData[babKey].standards[stdKey].criterias[kriKey].items.find(si => si.id === newItem.id);
                          if (existingItem) {
                            return { 
                              ...newItem,
                              rencana_perbaikan: existingItem.rencana_perbaikan || newItem.rencana_perbaikan,
                              indikator: existingItem.indikator || newItem.indikator,
                              sasaran: existingItem.sasaran || newItem.sasaran,
                              keterangan: existingItem.keterangan || newItem.keterangan,
                              waktu: existingItem.waktu || newItem.waktu,
                              pj: existingItem.pj || newItem.pj,
                            };
                          }
                          return newItem;
                        });
                    }
                  }
                }
              }
            }
          }
          setAiSummary(savedAiSummary || '');
        } else {
          console.log("Tidak ada data yang ada ditemukan di Firestore untuk file:", fileName);
          setAiSummary('');
        }
        setGroupedData(processedData);
        setGenerationProgress({ current: 0, total: 0, message: '' });
      } catch (e) { 
        setError("Terjadi kesalahan saat membuat hierarki atau memuat data dari cloud."); 
        console.error("Kesalahan pemprosesan hierarki atau pemuatan Firestore:", e);
        setGenerationProgress({ current: 0, total: 0, message: '' });
      }
    };

    if (rawData && isAuthReady && userId && db && fileName) {
      loadAndProcess();
    }
  }, [rawData, userId, db, isAuthReady, fileName]);

  // Fungsi untuk memperbarui state item secara immutable
  const updateItemState = useCallback((itemId, field, value) => {
    setGroupedData(prevGroupedData => {
      if (!prevGroupedData) return prevGroupedData;
      const newGroupedData = JSON.parse(JSON.stringify(prevGroupedData));
      for (const babKey in newGroupedData) {
        for (const stdKey in newGroupedData[babKey].standards) {
          for (const kriKey in newGroupedData[babKey].standards[stdKey].criterias) {
            const criteria = newGroupedData[babKey].standards[stdKey].criterias[kriKey];
            const itemIndex = criteria.items.findIndex(i => i.id === itemId);
            if (itemIndex > -1) {
              criteria.items[itemIndex][field] = value;
              return newGroupedData;
            }
          }
        }
      }
      return prevGroupedData;
    });
  }, []);

  // Fungsi untuk memanggil Google AI API
  const callAiApi = async (prompt) => {
    if (!geminiApiKey) throw new Error("API_KEY_MISSING");
    
    const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }] };
    let response;
    try {
        response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`, { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify(payload) 
        });
    } catch (networkError) {
        console.error("Kesalahan Jaringan selama fetch:", networkError);
        throw new Error("NETWORK_ERROR");
    }

    if (!response.ok) {
      const errorBody = await response.json();
      if (response.status === 429) return 'RATE_LIMIT';
      if (response.status === 400 && errorBody?.error?.message.includes("API key not valid")) {
          throw new Error("API_KEY_INVALID");
      }
      throw new Error(`Kesalahan HTTP! status: ${response.status} - ${errorBody?.error?.message || 'Tidak dikenal.'}`);
    }
    const result = await response.json();
    if (result.candidates?.[0]?.content?.parts?.[0]?.text) {
        return result.candidates[0].content.parts[0].text.trim().replace(/^"|"$/g, '');
    }
    return "Respons AI tidak valid.";
  };

  // Fungsi untuk menangani error API
  const handleApiError = (e) => {
    let message = `Gagal menghubungi AI: ${e.message}`;
    if (e.message === "API_KEY_INVALID") {
        message = "Kunci API tidak valid. Harap periksa kembali kunci API di file .env.local Anda.";
    } else if (e.message === "API_KEY_MISSING") {
        message = "Kunci API Google AI tidak ditemukan. Harap buat file .env.local dan isi dengan VITE_GEMINI_API_KEY.";
    } else if (e.message === "NETWORK_ERROR") {
        message = "Gagal terhubung ke server AI. Mohon periksa koneksi internet Anda.";
    }
    setModalMessage({ message, type: 'error' });
    console.error("Kesalahan API yang ditangani:", e);
  };

  // Fungsi untuk membersihkan input AI
  const cleanAiInput = (text) => {
    if (typeof text !== 'string' && text !== null && text !== undefined) text = String(text);
    if (!text) return '';
    const cleaned = text.trim();
    if (['Klik \'Buat Keterangan\'', 'Gagal diproses', 'Input data tidak siap', 'Batas permintaan AI tercapai', 'Data tidak cukup', 'Gagal setelah beberapa percobaan'].some(msg => cleaned.includes(msg))) {
        return '';
    }
    return cleaned;
  };

  // --- Fungsi-fungsi Generate AI (Keterangan, RTL, Indikator, Sasaran) ---
  // (Logika di dalam fungsi ini sama seperti sebelumnya, tidak perlu diubah signifikan)
  const handleGenerateKeterangan = async (item) => {
    const cleanedRencanaPerbaikan = cleanAiInput(item.rencana_perbaikan);
    const cleanedIndikator = cleanAiInput(item.indikator);
    const cleanedSasaran = cleanAiInput(item.sasaran);

    if (!cleanedRencanaPerbaikan && !cleanedIndikator && !cleanedSasaran) {
        updateItemState(item.id, 'keterangan', 'Input data tidak siap (isi RTL/Indikator/Sasaran)');
        return;
    }
    setLoadingStates(prev => ({ ...prev, [item.id + '_ket']: true }));
    const prompt = `PERAN: Anda adalah auditor akreditasi. TUGAS: Buatkan satu judul DOKUMEN BUKTI IMPLEMENTASI yang konkret berdasarkan data berikut. DATA: - Rencana Perbaikan: "${cleanedRencanaPerbaikan}" - Indikator: "${cleanedIndikator}" - Sasaran: "${cleanedSasaran}". ATURAN: Jawaban harus berupa satu frasa/kalimat tunggal, spesifik, dan dalam format nama dokumen resmi (contoh: "SK Rektor tentang...", "Notulensi Rapat...", "Laporan Hasil...").`;
    
    try {
        const generatedText = await callAiApi(prompt);
        updateItemState(item.id, 'keterangan', generatedText);
    } catch (e) {
        handleApiError(e);
        updateItemState(item.id, 'keterangan', `Gagal diproses: ${e.message}`);
    } finally {
        setLoadingStates(prev => ({ ...prev, [item.id + '_ket']: false }));
    }
  };
  
  // (Fungsi handleGenerateRTL, handleGenerateIndikator, handleGenerateSasaran serupa)
  // ...

  // --- Fungsi-fungsi Generate AI Massal ---
  // (Logika di dalam fungsi ini sama seperti sebelumnya, tidak perlu diubah signif