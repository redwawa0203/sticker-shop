import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query
} from 'firebase/firestore';
import { 
  Store, 
  LogIn, 
  Plus, 
  Trash2, 
  ExternalLink, 
  Image as ImageIcon, 
  LogOut,
  Heart,
  Upload,
  Link as LinkIcon,
  Eye,
  Coffee,
  Tag,
  Palette,
  Smile,
  Grid
} from 'lucide-react';

// --- Firebase Configuration ---
const firebaseConfig = {
  apiKey: "AIzaSyA2dy9tWcbgUqbvaAXldVnF0JepQsUitng",
  authDomain: "linegarden-f35bd.firebaseapp.com",
  projectId: "linegarden-f35bd",
  storageBucket: "linegarden-f35bd.firebasestorage.app",
  messagingSenderId: "994802750891",
  appId: "1:994802750891:web:a8eb7973ff44ef9ad1eeee",
  measurementId: "G-XX4SZC74C3"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- Types ---
type CategoryType = 'sticker' | 'theme' | 'emoji';

interface Sticker {
  id: string;
  title: string;
  imageUrl: string;      
  contentImageUrl?: string; 
  storeUrl: string;
  category?: CategoryType;
  createdAt: any;
}

const CATEGORY_LABELS: Record<CategoryType, string> = {
  sticker: '貼圖',
  theme: '主題',
  emoji: '表情貼'
};

const CATEGORY_ICONS: Record<CategoryType, React.ReactNode> = {
  sticker: <Tag className="w-4 h-4" />,
  theme: <Palette className="w-4 h-4" />,
  emoji: <Smile className="w-4 h-4" />
};

// --- Main Component ---
export default function App() {
  const [user, setUser] = useState<any>(null);
  const [stickers, setStickers] = useState<Sticker[]>([]);
  const [view, setView] = useState<'home' | 'login' | 'admin'>('home');
  const [isAdmin, setIsAdmin] = useState(false);

  // Filter State
  const [activeCategory, setActiveCategory] = useState<'all' | CategoryType>('all');

  // Login Form States
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  // Add Sticker Form States
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<CategoryType>('sticker');
  const [newImage, setNewImage] = useState(''); 
  const [imageInputMethod, setImageInputMethod] = useState<'url' | 'upload'>('url');
  const [newContentImage, setNewContentImage] = useState('');
  const [contentImageInputMethod, setContentImageInputMethod] = useState<'url' | 'upload'>('url');
  const [newLink, setNewLink] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const contentFileInputRef = useRef<HTMLInputElement>(null);

  // 1. 初始化 Auth
  useEffect(() => {
    const initAuth = async () => {
      try {
        await signInAnonymously(auth);
      } catch (error: any) {
        console.error("Auth Error:", error);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, (u) => setUser(u));
    return () => unsubscribe();
  }, []);

  // 2. 監聽 Firestore 資料 (改為讀取 Public Data)
  useEffect(() => {
    // 即使沒登入也嘗試讀取，但為了安全通常還是等 auth ready
    // 這裡改用 'public/data/allStickers' 讓所有人共享資料
    const q = query(
      collection(db, 'artifacts', appId, 'public', 'data', 'allStickers')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const loadedStickers = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Sticker[];
      
      loadedStickers.sort((a, b) => b.createdAt - a.createdAt);
      setStickers(loadedStickers);
    }, (error) => {
      console.error("Error fetching stickers:", error);
      if (error.code === 'permission-denied') {
        // 這會提示你去設定 Firestore Rules
        alert("權限不足！請去 Firebase Console -> Firestore Database -> Rules 貼上我提供的規則設定。");
      }
    });

    return () => unsubscribe();
  }, []); // 移除 [user] 依賴，讓任何人都能觸發讀取

  // --- Utility: Resize Image to Base64 ---
  const handleImageUpload = (file: File, setter: (val: string) => void) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert("圖片太大了！請選擇小一點的圖片。");
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const MAX_WIDTH = 500;
        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        setter(dataUrl);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // --- Handlers ---
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === 'ireneuser' && password === 'line888') {
      setIsAdmin(true);
      setView('admin');
      setLoginError('');
      setUsername('');
      setPassword('');
    } else {
      setLoginError('帳號或密碼錯誤，請再試一次');
    }
  };

  const handleLogout = () => {
    setIsAdmin(false);
    setView('home');
  };

  const handleAddSticker = async (e: React.FormEvent) => {
    e.preventDefault();
    // 雖然寫入需要 auth，但因為我們開啟了 anonymous，user 應該是存在的
    if (!newTitle || !newImage) return;

    setIsSubmitting(true);
    try {
      // 寫入到 Public 區域
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'allStickers'), {
        title: newTitle,
        imageUrl: newImage,
        contentImageUrl: newContentImage,
        storeUrl: newLink,
        category: newCategory,
        createdAt: Date.now()
      });
      setNewTitle('');
      setNewImage('');
      setNewContentImage('');
      setNewLink('');
      setNewCategory('sticker');
      if (fileInputRef.current) fileInputRef.current.value = '';
      if (contentFileInputRef.current) contentFileInputRef.current.value = '';
    } catch (error) {
      console.error("Error adding sticker:", error);
      alert("上架失敗，請檢查網路或 Firestore 權限規則。");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('確定要刪除這組貼圖嗎？')) {
      try {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'allStickers', id));
      } catch (error) {
        console.error("Error deleting:", error);
      }
    }
  };

  // --- Filter Logic ---
  const filteredStickers = stickers.filter(sticker => {
    if (activeCategory === 'all') return true;
    const itemCategory = sticker.category || 'sticker'; 
    return itemCategory === activeCategory;
  });

  // --- UI Components ---
  const renderImageInput = (
    label: string, 
    value: string, 
    setValue: (v: string) => void,
    method: 'url' | 'upload',
    setMethod: (m: 'url' | 'upload') => void,
    inputRef: React.RefObject<HTMLInputElement>,
    placeholder: string
  ) => (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
      <div className="flex gap-4 mb-3">
        <button
          type="button"
          onClick={() => {
            setMethod('url');
            setValue('');
            if (inputRef.current) inputRef.current.value = '';
          }}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium border transition-all ${
            method === 'url' 
              ? 'bg-pink-50 border-pink-500 text-pink-600' 
              : 'border-gray-200 text-gray-500 hover:bg-gray-50'
          }`}
        >
          <LinkIcon className="w-4 h-4 inline mr-2" />
          使用網址
        </button>
        <button
          type="button"
          onClick={() => {
            setMethod('upload');
            setValue('');
          }}
          className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium border transition-all ${
            method === 'upload' 
              ? 'bg-pink-50 border-pink-500 text-pink-600' 
              : 'border-gray-200 text-gray-500 hover:bg-gray-50'
          }`}
        >
          <Upload className="w-4 h-4 inline mr-2" />
          上傳檔案
        </button>
      </div>
      {method === 'url' ? (
        <div className="relative animate-in fade-in slide-in-from-top-2 duration-300">
          <ImageIcon className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
          <input 
            type="url" 
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-pink-500 outline-none"
          />
        </div>
      ) : (
        <div className="relative animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-pink-400 transition-colors bg-gray-50">
            <input 
              ref={inputRef}
              type="file" 
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageUpload(file, setValue);
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="flex flex-col items-center justify-center text-gray-500">
              {value ? (
                <>
                  <img src={value} alt="Preview" className="h-24 w-24 object-contain mb-2 rounded border bg-white" />
                  <span className="text-sm text-green-600 font-medium">圖片已選取</span>
                </>
              ) : (
                <>
                  <Upload className="w-8 h-8 mb-2 text-gray-400" />
                  <span className="text-sm">點擊上傳</span>
                  <span className="text-xs text-gray-400 mt-1">JPG, PNG (自動壓縮)</span>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderNavbar = () => (
    <nav className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-pink-100 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <div 
          className="flex items-center gap-2 cursor-pointer" 
          onClick={() => setView('home')}
        >
          <div className="bg-pink-100 p-2 rounded-full">
            <Store className="w-6 h-6 text-pink-500" />
          </div>
          <span className="font-bold text-xl text-gray-800 tracking-wide">
            Irene<span className="text-pink-500">.Stickers</span>
          </span>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setView('home')}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              view === 'home' 
                ? 'bg-pink-500 text-white shadow-md shadow-pink-200' 
                : 'text-gray-500 hover:bg-pink-50'
            }`}
          >
            首頁
          </button>
          <a
             href="https://buymeacoffee.com/lunacoffee9"
             target="_blank"
             rel="noopener noreferrer"
             className="hidden md:inline-flex px-4 py-2 rounded-full text-sm font-medium transition-all bg-yellow-400 hover:bg-yellow-500 text-gray-800 shadow-md shadow-yellow-200 items-center gap-2"
          >
             <Coffee className="w-4 h-4" />
             贊助可頌
          </a>
          {isAdmin ? (
            <button 
              onClick={() => setView('admin')}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-1 ${
                view === 'admin' 
                  ? 'bg-gray-800 text-white' 
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              後台管理
            </button>
          ) : (
            <button 
              onClick={() => setView('login')}
              className="text-gray-400 hover:text-pink-500 transition-colors"
            >
              <LogIn className="w-5 h-5" />
            </button>
          )}
          {isAdmin && (
            <button onClick={handleLogout} className="text-gray-400 hover:text-red-500">
              <LogOut className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </nav>
  );

  const renderHome = () => (
    <div className="min-h-screen bg-[#FFF5F7]">
      <div className="bg-white pb-6 pt-8 px-4 text-center rounded-b-[3rem] shadow-sm mb-8">
        <div className="w-24 h-24 mx-auto bg-pink-100 rounded-full flex items-center justify-center mb-4 border-4 border-white shadow-lg">
           <Heart className="w-10 h-10 text-pink-400 fill-pink-400 animate-pulse" />
        </div>
        <h1 className="text-3xl font-bold text-[#8B4513] mb-2 tracking-wide font-['Nunito',_'Varela_Round',_sans-serif]">
          花謬思汀-Line花園
        </h1>
        <p className="text-gray-500 max-w-md mx-auto leading-relaxed mb-8">
          歡迎來到我的貼圖展示間✨<br />
          探索自製各式各樣的貼圖、表情貼、主題~
        </p>
        <div className="flex justify-center gap-2 mb-4 flex-wrap">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-6 py-2 rounded-full text-sm font-bold transition-all duration-300 flex items-center gap-2 ${
              activeCategory === 'all'
                ? 'bg-gray-800 text-white shadow-lg transform scale-105'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            <Grid className="w-4 h-4" />
            全部
          </button>
          {(['sticker', 'theme', 'emoji'] as CategoryType[]).map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-6 py-2 rounded-full text-sm font-bold transition-all duration-300 flex items-center gap-2 ${
                activeCategory === cat
                  ? 'bg-pink-500 text-white shadow-lg shadow-pink-200 transform scale-105'
                  : 'bg-white text-gray-500 hover:bg-pink-50 border border-transparent hover:border-pink-200'
              }`}
            >
              {CATEGORY_ICONS[cat]}
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>
      </div>
      <div className="max-w-6xl mx-auto px-4 pb-20">
        {filteredStickers.length === 0 ? (
          <div className="text-center py-20 bg-white/50 rounded-3xl border border-pink-100">
            <p className="text-gray-400 mb-2">
              {activeCategory === 'all' ? '目前還沒有上架貼圖喔' : `目前沒有${CATEGORY_LABELS[activeCategory]}類型的作品`}
            </p>
            {isAdmin && <p className="text-sm text-pink-400">請到後台新增</p>}
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 animate-in fade-in zoom-in duration-500">
            {filteredStickers.map((sticker) => (
              <div 
                key={sticker.id} 
                className="group bg-white rounded-2xl overflow-visible relative shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-pink-50 z-0 hover:z-50"
              >
                {sticker.contentImageUrl && (
                    <div className="absolute -top-[15px] left-1/2 -translate-x-1/2 -translate-y-full w-[180%] opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-300 z-50">
                        <div className="bg-white p-2 rounded-2xl shadow-2xl border-4 border-pink-200 transform scale-95 group-hover:scale-100 transition-transform duration-300 origin-bottom">
                            <img 
                                src={sticker.contentImageUrl} 
                                alt="Preview" 
                                className="w-full h-auto rounded-xl" 
                            />
                            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[12px] border-l-transparent border-r-[12px] border-r-transparent border-t-[12px] border-t-pink-200"></div>
                        </div>
                    </div>
                )}
                <div className="aspect-square bg-gray-50 relative overflow-hidden rounded-t-2xl z-10">
                  <img 
                    src={sticker.imageUrl} 
                    alt={sticker.title}
                    className="w-full h-full object-cover transition-transform duration-500"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://placehold.co/400x400/pink/white?text=No+Image';
                    }}
                  />
                  <div className="absolute top-2 left-2">
                     <span className="text-[10px] font-bold bg-white/90 backdrop-blur text-gray-600 px-2 py-1 rounded-full shadow-sm border border-gray-100">
                        {CATEGORY_LABELS[sticker.category || 'sticker']}
                     </span>
                  </div>
                  {sticker.contentImageUrl && (
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center bg-black/10 backdrop-blur-[2px]">
                        <span className="text-white font-bold text-sm bg-pink-500/80 px-3 py-1 rounded-full shadow-lg backdrop-blur-md">
                           預覽中
                        </span>
                    </div>
                  )}
                </div>
                <div className="p-4 text-center bg-white rounded-b-2xl relative z-20">
                  <h3 className="font-bold text-gray-800 mb-3 truncate px-2">{sticker.title}</h3>
                  <a 
                    href={sticker.storeUrl || '#'} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center w-full gap-2 bg-[#00B900] hover:bg-[#009900] text-white py-2 px-4 rounded-xl font-bold transition-colors text-sm shadow-md shadow-green-100"
                  >
                    <Store className="w-4 h-4" />
                    去購買
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <footer className="text-center py-8 text-gray-400 text-sm">
        © 2025 Irene Sticker Shop. All rights reserved.
      </footer>
    </div>
  );

  const renderLogin = () => (
    <div className="min-h-screen bg-[#FFF5F7] flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md p-8 rounded-3xl shadow-xl border border-pink-100">
        <div className="text-center mb-8">
          <div className="bg-pink-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <LogIn className="w-8 h-8 text-pink-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800">創作者登入</h2>
          <p className="text-gray-400 text-sm mt-1">請輸入你的專屬帳號密碼</p>
        </div>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">帳號</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-200 outline-none transition-all bg-gray-50 focus:bg-white"
              placeholder="輸入帳號"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">密碼</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-pink-500 focus:ring-2 focus:ring-pink-200 outline-none transition-all bg-gray-50 focus:bg-white"
              placeholder="輸入密碼"
            />
          </div>
          {loginError && (
            <div className="text-red-500 text-sm text-center bg-red-50 py-2 rounded-lg">
              {loginError}
            </div>
          )}
          <button 
            type="submit"
            className="w-full bg-pink-500 hover:bg-pink-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-pink-200 transition-all active:scale-95"
          >
            登入後台
          </button>
        </form>
        <div className="text-center mt-6">
          <button onClick={() => setView('home')} className="text-gray-400 hover:text-gray-600 text-sm">
            ← 返回首頁
          </button>
        </div>
      </div>
    </div>
  );

  const renderAdmin = () => (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">
        <header className="mb-8 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">貼圖管理後台</h2>
            <p className="text-gray-500">歡迎回來，Irene！</p>
          </div>
          <button 
            onClick={() => setView('home')}
            className="flex items-center gap-2 text-pink-500 hover:bg-pink-50 px-4 py-2 rounded-lg transition-colors font-medium"
          >
            <ExternalLink className="w-4 h-4" />
            預覽網站
          </button>
        </header>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 mb-8">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-pink-500" />
            上架新作品
          </h3>
          <form onSubmit={handleAddSticker} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">作品標題</label>
              <input 
                type="text" 
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="例如：Irene 的日常用語"
                className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-pink-500 outline-none"
                required
              />
            </div>
            <div className="md:col-span-2">
               <label className="block text-sm font-medium text-gray-700 mb-2">作品分類</label>
               <div className="flex gap-4">
                 {(['sticker', 'theme', 'emoji'] as CategoryType[]).map((cat) => (
                   <label key={cat} className={`flex-1 cursor-pointer relative`}>
                      <input 
                        type="radio" 
                        name="category" 
                        value={cat}
                        checked={newCategory === cat}
                        onChange={(e) => setNewCategory(e.target.value as CategoryType)}
                        className="peer sr-only"
                      />
                      <div className="p-3 rounded-xl border border-gray-200 bg-gray-50 peer-checked:bg-pink-500 peer-checked:text-white peer-checked:border-pink-500 text-center transition-all flex items-center justify-center gap-2">
                        {CATEGORY_ICONS[cat]}
                        {CATEGORY_LABELS[cat]}
                      </div>
                   </label>
                 ))}
               </div>
            </div>
            <div>
               {renderImageInput(
                 "封面圖片 (列表顯示)",
                 newImage,
                 setNewImage,
                 imageInputMethod,
                 setImageInputMethod,
                 fileInputRef,
                 "https://..."
               )}
            </div>
            <div>
               {renderImageInput(
                 "懸浮預覽圖 (滑鼠移上去時顯示)",
                 newContentImage,
                 setNewContentImage,
                 contentImageInputMethod,
                 setContentImageInputMethod,
                 contentFileInputRef,
                 "https://..."
               )}
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">購買連結 (Store URL)</label>
              <div className="relative">
                <Store className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                <input 
                  type="url" 
                  value={newLink}
                  onChange={(e) => setNewLink(e.target.value)}
                  placeholder="https://store.line.me/..."
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-pink-500 outline-none"
                />
              </div>
            </div>
            <div className="md:col-span-2 flex justify-end">
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="bg-gray-900 hover:bg-black text-white px-8 py-3 rounded-xl font-bold transition-colors disabled:opacity-50 shadow-lg shadow-gray-200"
              >
                {isSubmitting ? '處理中...' : '確認上架'}
              </button>
            </div>
          </form>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-bold text-gray-800">已上架列表 ({stickers.length})</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-gray-50 text-gray-500 text-sm">
                <tr>
                  <th className="p-4 font-medium">封面</th>
                  <th className="p-4 font-medium">分類</th>
                  <th className="p-4 font-medium">標題</th>
                  <th className="p-4 font-medium hidden md:table-cell">連結</th>
                  <th className="p-4 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {stickers.map((sticker) => (
                  <tr key={sticker.id} className="hover:bg-pink-50/50 transition-colors">
                    <td className="p-4">
                      <img 
                        src={sticker.imageUrl} 
                        alt="" 
                        className="w-12 h-12 rounded-lg object-cover border border-gray-200"
                      />
                    </td>
                    <td className="p-4">
                      <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">
                        {CATEGORY_LABELS[sticker.category || 'sticker']}
                      </span>
                    </td>
                    <td className="p-4 font-medium text-gray-800">{sticker.title}</td>
                    <td className="p-4 text-sm text-gray-500 hidden md:table-cell max-w-xs truncate">
                      {sticker.storeUrl || '-'}
                    </td>
                    <td className="p-4 text-right">
                      <button 
                        onClick={() => handleDelete(sticker.id)}
                        className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-full transition-all"
                        title="刪除"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {stickers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-gray-400">
                      目前沒有貼圖，快去上架第一組吧！
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="font-sans text-gray-900">
      {renderNavbar()}
      {view === 'home' && renderHome()}
      {view === 'login' && renderLogin()}
      {view === 'admin' && renderAdmin()}
    </div>
  );
}