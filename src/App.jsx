import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, doc, deleteDoc, setDoc } from "firebase/firestore";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { LogOut, Plus, Trash2, Activity, Target, Wallet, Edit2, History, Check } from 'lucide-react';

// --- কনফিগারেশন (CONFIGURATION) ---
// আপনার দেওয়া কনফিগারেশন এখানে বসানো হলো
const firebaseConfig = {
  apiKey: "AIzaSyDaQfuD73uS9Lqnd1PZAbcKa4zNpeTwbCU",
  authDomain: "ritesh-crypto-journal.firebaseapp.com",
  projectId: "ritesh-crypto-journal",
  storageBucket: "ritesh-crypto-journal.firebasestorage.app",
  messagingSenderId: "879781771829",
  appId: "1:879781771829:web:91895788fc04885d90cf7c"
};

// ফায়ারবেস ইনিশিয়ালাইজেশন
let app, auth, db;
try {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.error("Firebase Config Error. Please check console.");
}

const USD_INR_RATE = 85;

// ১. ল্যান্ডিং পেজ (Landing Page)
const LandingPage = ({ onLogin }) => (
  <div className="min-h-screen flex flex-col items-center justify-center relative overflow-hidden bg-black">
    <div className="absolute inset-0 z-0">
       <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1642104704074-907c0698cbd9?q=80&w=2532&auto=format&fit=crop')] bg-cover bg-center opacity-20"></div>
       <div className="absolute inset-0 bg-gradient-to-t from-black via-black/80 to-transparent"></div>
    </div>
    <div className="relative z-10 text-center p-8 max-w-4xl mx-auto border border-white/10 bg-white/5 backdrop-blur-md rounded-3xl shadow-2xl">
      <div className="mb-6 flex justify-center">
        {/* লোগো - myphoto.png */}
        <div className="w-32 h-32 rounded-full border-4 border-orange-500 shadow-[0_0_30px_rgba(249,115,22,0.6)] overflow-hidden bg-black">
           <img src="/myphoto.png" alt="Logo" className="w-full h-full object-cover" onError={(e) => {e.target.src = 'https://placehold.co/200x200/orange/white?text=RD'}} />
        </div>
      </div>
      <h1 className="text-6xl font-black mb-4 bg-clip-text text-transparent bg-gradient-to-r from-orange-400 to-yellow-300">RITESH DHARA</h1>
      <p className="text-2xl text-gray-300 mb-8 font-light tracking-wide">Professional Crypto Trading Journal</p>
      <button onClick={onLogin} className="group relative px-10 py-4 bg-gradient-to-r from-orange-600 to-orange-500 rounded-full text-white font-bold text-lg transition-all hover:scale-105 shadow-[0_0_20px_rgba(234,88,12,0.4)]">
        <span className="flex items-center gap-2">Enter Daily Journal / PnL <Activity className="w-5 h-5 group-hover:animate-pulse" /></span>
      </button>
    </div>
  </div>
);

// ২. মেইন অ্যাপ (Main App)
const App = () => {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('dashboard');
  const [journals, setJournals] = useState([]);
  const [withdrawals, setWithdrawals] = useState([]);
  const [wallet, setWallet] = useState({ balance: 0 });
  const [targets, setTargets] = useState({ indianMarketLoss: 44875.75 }); // ডিফল্ট টার্গেট
  const [loading, setLoading] = useState(true);

  // Auth Listener
  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (u) => { setUser(u); setLoading(false); });
  }, []);

  // Data Listener (Real-time updates)
  useEffect(() => {
    if (!user || !db) return;

    // ১. জার্নাল ডেটা
    const qJournal = query(collection(db, "users", user.uid, "journals"), orderBy("date", "desc"));
    const unsubJournal = onSnapshot(qJournal, (snapshot) => {
      setJournals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // ২. উইথড্রয়াল ডেটা
    const qWithdraw = query(collection(db, "users", user.uid, "withdrawals"), orderBy("date", "desc"));
    const unsubWithdraw = onSnapshot(qWithdraw, (snapshot) => {
      setWithdrawals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // ৩. ওয়ালেট এবং টার্গেট সেটিংস
    const unsubSettings = onSnapshot(doc(db, "users", user.uid, "settings", "config"), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        if(data.balance !== undefined) setWallet({ balance: data.balance });
        if(data.indianMarketLoss !== undefined) setTargets({ indianMarketLoss: data.indianMarketLoss });
      }
    });

    return () => { unsubJournal(); unsubWithdraw(); unsubSettings(); };
  }, [user]);

  const handleLogin = async () => {
    if(!auth) return;
    try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch (e) { console.error(e); }
  };

  // সব হিসাব-নিকাশ
  const stats = useMemo(() => {
    let totalPnL = 0; let wins = 0; let profitSum = 0; let losses = 0; let lossSum = 0; let tradeCount = 0;
    journals.forEach(day => {
      totalPnL += (day.dailyPnL || 0);
      if(day.trades) {
        day.trades.forEach(t => {
          tradeCount++;
          const pnl = Number(t.pnl);
          if(pnl > 0) { wins++; profitSum += pnl; } else { losses++; lossSum += Math.abs(pnl); }
        });
      }
    });
    const recoveredAmountINR = Math.max(0, totalPnL * USD_INR_RATE); 
    return {
      totalPnL, totalPnLINR: totalPnL * USD_INR_RATE,
      winRate: tradeCount > 0 ? ((wins/tradeCount)*100).toFixed(1) : 0,
      avgProfit: wins > 0 ? (profitSum/wins).toFixed(2) : 0,
      avgLoss: losses > 0 ? (lossSum/losses).toFixed(2) : 0,
      tradeCount, recoveredAmountINR
    };
  }, [journals]);

  if (loading) return <div className="bg-black h-screen text-white flex items-center justify-center">Loading...</div>;
  if (!user) return <LandingPage onLogin={handleLogin} />;

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans">
      {/* Navbar */}
      <nav className="border-b border-white/10 bg-black/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => setView('dashboard')}>
             <div className="h-10 w-10 rounded-full border border-orange-500 overflow-hidden bg-white">
                <img src="/myphoto.png" alt="logo" className="w-full h-full object-cover"/>
             </div>
             <div>
               <h1 className="font-bold text-lg leading-none">RITESH DHARA</h1>
               <span className="text-xs text-orange-500 font-mono">TRADING JOURNAL HELPER</span>
             </div>
          </div>
          <div className="flex items-center gap-4">
             <button onClick={() => setView('entry')} className="bg-orange-600 hover:bg-orange-500 px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2">
               <Plus size={16} /> <span className="hidden sm:inline">New Entry</span>
             </button>
             <button onClick={() => signOut(auth)} className="text-gray-400 hover:text-white" title="Logout"><LogOut size={20} /></button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {view === 'dashboard' && (
          <div className="space-y-8 animate-fade-in">
            
            {/* ১. টপ সেকশন: রিকভারি এবং ব্যালেন্স */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* রিকভারি কার্ড (EDITABLE TARGET) */}
              <RecoveryCard 
                db={db} 
                user={user} 
                target={targets.indianMarketLoss} 
                recovered={stats.recoveredAmountINR} 
                totalPnL={stats.totalPnL}
                totalPnLINR={stats.totalPnLINR}
              />

              {/* ব্যালেন্স কার্ড (EDITABLE) */}
              <BalanceCard db={db} user={user} currentBalance={wallet.balance} />
            </div>

            {/* ২. স্ট্যাটিস্টিকস */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatBox label="Win Rate" value={`${stats.winRate}%`} sub={`${stats.tradeCount} Trades`} />
              <StatBox label="Avg Profit" value={`$${stats.avgProfit}`} sub="Per Win" color="text-green-400" />
              <StatBox label="Avg Loss" value={`$${stats.avgLoss}`} sub="Per Loss" color="text-red-400" />
              <StatBox label="Current Rate" value={`₹${USD_INR_RATE}`} sub="1 USD" />
            </div>

            {/* ৩. গ্রাফ এবং উইথড্রয়াল হিস্ট্রি */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* P&L গ্রাফ */}
              <div className="lg:col-span-2 bg-gray-900/50 p-4 rounded-2xl border border-white/10 h-96">
                <h3 className="text-sm font-bold text-gray-400 mb-4">P&L GROWTH CURVE</h3>
                <ResponsiveContainer width="100%" height="90%">
                  <LineChart data={[...journals].reverse()}>
                    <CartesianGrid stroke="#222" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="date" stroke="#555" fontSize={12} tickFormatter={(str) => str.slice(5)} />
                    <YAxis stroke="#555" fontSize={12} />
                    <Tooltip contentStyle={{ backgroundColor: '#000', border: '1px solid #333' }} />
                    <Line type="monotone" dataKey="dailyPnL" stroke="#f97316" strokeWidth={3} dot={{r:4, fill:'#f97316'}} activeDot={{r:6}} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              
              {/* উইথড্রয়াল সেকশন */}
              <WithdrawalSection db={db} user={user} list={withdrawals} />
            </div>

            {/* ৪. জার্নাল লিস্ট */}
            <div className="space-y-4">
              <h3 className="text-lg font-bold flex items-center gap-2 text-gray-300">
                 <Wallet className="w-5 h-5 text-orange-500" /> Recent Journals
              </h3>
              {journals.map(day => (
                <div key={day.id} className="bg-gray-900/30 border border-white/5 rounded-xl p-4 hover:border-orange-500/30 transition-all">
                   <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="font-bold text-lg text-white">{new Date(day.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</h4>
                        <div className="flex gap-3 text-xs text-gray-400 mt-1">
                          <span>Trades: {day.trades?.length || 0}</span>
                          <span>Win Rate: {day.dailyWinRate}%</span>
                        </div>
                      </div>
                      <div className={`text-xl font-mono font-bold ${day.dailyPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {day.dailyPnL >= 0 ? '+' : ''}${day.dailyPnL.toFixed(2)}
                      </div>
                   </div>
                   <div className="space-y-2 pl-4 border-l-2 border-white/10">
                      {day.trades?.map((t, idx) => (
                        <div key={idx} className="flex justify-between text-sm">
                           <span className="text-gray-300">
                             <span className="text-orange-500 font-mono mr-2">{idx+1}.</span>
                             {t.asset} {t.type} <span className={`text-[10px] px-1 rounded ${t.direction === 'Long' ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>{t.direction}</span>
                           </span>
                           <span className={t.pnl >= 0 ? 'text-green-500' : 'text-red-500'}>{t.pnl >= 0 ? '+' : ''}${t.pnl}</span>
                        </div>
                      ))}
                   </div>
                   <button onClick={async () => { if(confirm('Are you sure?')) await deleteDoc(doc(db, "users", user.uid, "journals", day.id)) }} className="mt-4 text-xs text-red-900 hover:text-red-500">Delete Entry</button>
                </div>
              ))}
            </div>
          </div>
        )}
        {view === 'entry' && <EntryForm onCancel={() => setView('dashboard')} db={db} user={user} setView={setView} />}
      </main>
    </div>
  );
};

// --- কম্পোনেন্টস (COMPONENTS) ---

// ১. রিকভারি কার্ড (টার্গেট চেঞ্জ করা যায়)
const RecoveryCard = ({ db, user, target, recovered, totalPnL, totalPnLINR }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempTarget, setTempTarget] = useState(target);

  useEffect(() => { setTempTarget(target) }, [target]);

  const saveTarget = async () => {
    if (!db || !user) return;
    await setDoc(doc(db, "users", user.uid, "settings", "config"), { indianMarketLoss: parseFloat(tempTarget) }, { merge: true });
    setIsEditing(false);
  };

  return (
    <div className="lg:col-span-2 bg-gradient-to-br from-gray-900 to-black p-6 rounded-2xl border border-white/10 relative group">
       <div className="absolute top-4 right-4 cursor-pointer text-gray-500 hover:text-white" onClick={() => setIsEditing(!isEditing)}>
         {isEditing ? <div className="text-xs bg-red-900 px-2 py-1 rounded">Cancel</div> : <Edit2 size={16} />}
       </div>

       <h2 className="text-xl font-bold mb-6 flex items-center gap-2 text-gray-200">
         <Target className="text-red-500" /> LOSS RECOVERY
       </h2>
       
       <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-3">
            <div className="flex justify-between text-sm items-center">
               <span className="text-gray-400">Target (Indian Market Loss)</span>
               {isEditing ? (
                 <div className="flex gap-2">
                   <input type="number" value={tempTarget} onChange={(e) => setTempTarget(e.target.value)} className="w-24 bg-black border border-orange-500 rounded p-1 text-right text-red-400" autoFocus />
                   <button onClick={saveTarget} className="bg-green-700 p-1 rounded"><Check size={14}/></button>
                 </div>
               ) : (
                 <span className="font-mono text-red-400">₹{target.toLocaleString()}</span>
               )}
            </div>
            <div className="flex justify-between text-sm">
               <span className="text-gray-400">Recovered (Via Crypto)</span>
               <span className="font-mono text-green-400">₹{recovered.toLocaleString()}</span>
            </div>
            <div className="h-3 w-full bg-gray-800 rounded-full overflow-hidden">
               <div className="h-full bg-gradient-to-r from-green-600 to-green-400 transition-all duration-1000" style={{ width: `${Math.min((recovered / target) * 100, 100)}%` }} />
            </div>
            <p className="text-xs text-right text-gray-500">{((recovered / target) * 100).toFixed(2)}% Completed</p>
          </div>
          <div className="bg-black/40 rounded-xl p-4 border border-white/5 flex flex-col justify-center items-center">
            <span className="text-gray-500 text-xs uppercase tracking-wider mb-1">Total P&L</span>
            <span className={`text-4xl font-mono font-bold ${totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
               {totalPnL >= 0 ? '+' : ''}${totalPnL.toFixed(2)}
            </span>
            <span className="text-sm text-gray-500 mt-1">≈ ₹{totalPnLINR.toLocaleString()}</span>
          </div>
       </div>
    </div>
  );
};

// ২. ব্যালেন্স কার্ড (ব্যালেন্স চেঞ্জ করা যায়)
const BalanceCard = ({ db, user, currentBalance }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [tempBal, setTempBal] = useState(currentBalance);

  useEffect(() => { setTempBal(currentBalance || 0) }, [currentBalance]);

  const handleSave = async () => {
    if (!db || !user) return;
    await setDoc(doc(db, "users", user.uid, "settings", "config"), { balance: parseFloat(tempBal) }, { merge: true });
    setIsEditing(false);
  };

  return (
    <div className="bg-gradient-to-br from-orange-900/20 to-black p-6 rounded-2xl border border-orange-500/20 flex flex-col justify-between relative group">
       <div className="absolute top-4 right-4 cursor-pointer text-gray-500 hover:text-white" onClick={() => setIsEditing(!isEditing)}>
         {isEditing ? <div className="text-xs bg-red-900 px-2 py-1 rounded">Cancel</div> : <Edit2 size={16} />}
       </div>
       
       <div>
         <h3 className="text-gray-400 font-bold flex items-center gap-2 mb-4">
           <Wallet className="text-orange-500" /> ACCOUNT BALANCE
         </h3>
         
         {isEditing ? (
           <div className="space-y-2">
             <input type="number" value={tempBal} onChange={(e) => setTempBal(e.target.value)} className="w-full bg-black border border-orange-500 rounded p-2 text-xl font-mono text-white" autoFocus />
             <button onClick={handleSave} className="w-full bg-orange-600 hover:bg-orange-500 text-sm font-bold py-2 rounded">Update Balance</button>
           </div>
         ) : (
           <div>
             <div className="text-4xl font-mono font-bold text-white mb-2">
               ${(currentBalance || 0).toLocaleString()}
             </div>
             <div className="text-sm text-gray-500">
               ≈ ₹{((currentBalance || 0) * USD_INR_RATE).toLocaleString()}
             </div>
           </div>
         )}
       </div>
       <div className="mt-4 text-xs text-gray-600 border-t border-white/5 pt-2">
         *Manually updated. Does not auto-sync with P&L.
       </div>
    </div>
  );
};

// ৩. উইথড্রয়াল সেকশন
const WithdrawalSection = ({ db, user, list }) => {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const handleAdd = async () => {
    if(!amount || !db) return;
    await addDoc(collection(db, "users", user.uid, "withdrawals"), {
      amount: parseFloat(amount),
      date: date,
      createdAt: new Date()
    });
    setAmount('');
  };

  return (
    <div className="bg-gray-900/50 rounded-2xl border border-white/10 flex flex-col h-96">
      <div className="p-4 border-b border-white/10 bg-white/5 rounded-t-2xl">
        <h3 className="font-bold flex items-center gap-2 text-gray-300">
          <History size={18} className="text-blue-400" /> Withdrawal History
        </h3>
      </div>
      
      {/* ইনপুট এরিয়া */}
      <div className="p-4 grid grid-cols-2 gap-2 border-b border-white/5">
        <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-black border border-white/20 rounded p-2 text-xs text-gray-300" />
        <input type="number" placeholder="Amount ($)" value={amount} onChange={e => setAmount(e.target.value)} className="bg-black border border-white/20 rounded p-2 text-xs text-white font-mono" />
        <button onClick={handleAdd} className="col-span-2 bg-blue-900/50 hover:bg-blue-800 text-blue-200 text-xs font-bold py-2 rounded border border-blue-500/30">
          + Record Withdrawal
        </button>
      </div>

      {/* লিস্ট */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
        {list.length === 0 && <p className="text-center text-gray-600 text-xs mt-10">No withdrawals recorded yet.</p>}
        {list.map(item => (
          <div key={item.id} className="flex justify-between items-center bg-black/40 p-3 rounded hover:bg-white/5 transition-colors group">
            <div className="flex flex-col">
              <span className="text-xs text-gray-400">{item.date}</span>
              <span className="text-sm font-bold text-white font-mono">${item.amount}</span>
            </div>
            <div className="flex items-center gap-2">
               <span className="text-[10px] text-gray-600">₹{(item.amount * USD_INR_RATE).toLocaleString()}</span>
               <button onClick={() => deleteDoc(doc(db, "users", user.uid, "withdrawals", item.id))} className="text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                 <Trash2 size={14} />
               </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const StatBox = ({ label, value, sub, color="text-white" }) => (
  <div className="bg-gray-900/50 p-4 rounded-xl border border-white/5">
    <p className="text-gray-500 text-xs uppercase mb-1">{label}</p>
    <p className={`text-2xl font-bold ${color}`}>{value}</p>
    {sub && <p className="text-xs text-gray-600 mt-1">{sub}</p>}
  </div>
);

const EntryForm = ({ onCancel, db, user, setView }) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [trades, setTrades] = useState([{ asset: 'BTC', type: 'Future', direction: 'Long', pnl: '', notes: '' }]);

  const handleAddTrade = () => { setTrades([...trades, { asset: 'BTC', type: 'Future', direction: 'Long', pnl: '', notes: '' }]); };
  const updateTrade = (idx, field, val) => { const newTrades = [...trades]; newTrades[idx][field] = val; setTrades(newTrades); };

  const handleSave = async () => {
    if (!db || !user) return;
    let dailyPnL = 0; let wins = 0;
    trades.forEach(t => { const val = parseFloat(t.pnl) || 0; dailyPnL += val; if (val > 0) wins++; });
    const winRate = trades.length > 0 ? ((wins / trades.length) * 100).toFixed(2) : 0;
    try {
      await addDoc(collection(db, "users", user.uid, "journals"), { date, trades, dailyPnL, dailyWinRate: winRate, createdAt: new Date() });
      setView('dashboard');
    } catch (e) { alert("Error saving: " + e.message); }
  };

  return (
    <div className="max-w-2xl mx-auto bg-gray-900 rounded-2xl border border-white/10 p-6">
      <h2 className="text-2xl font-bold mb-6">New Journal Entry</h2>
      <div className="mb-6"><label className="block text-sm text-gray-500 mb-2">Date</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-black border border-white/20 rounded-lg p-3" /></div>
      <div className="space-y-4 mb-8">
         {trades.map((t, i) => (
           <div key={i} className="bg-black/50 p-4 rounded-xl border border-white/5 grid gap-4">
              <div className="flex justify-between items-center text-xs text-gray-500"><span>Trade #{i+1}</span>{trades.length > 1 && <button onClick={() => setTrades(trades.filter((_,idx) => idx !== i))} className="text-red-500"><Trash2 size={14}/></button>}</div>
              <div className="grid grid-cols-2 gap-3"><input placeholder="Asset" value={t.asset} onChange={e => updateTrade(i, 'asset', e.target.value)} className="bg-gray-800 rounded p-2 text-sm" /><input type="number" placeholder="P&L ($)" value={t.pnl} onChange={e => updateTrade(i, 'pnl', e.target.value)} className={`bg-gray-800 rounded p-2 text-sm font-bold ${Number(t.pnl) >= 0 ? 'text-green-400' : 'text-red-400'}`} /></div>
              <div className="grid grid-cols-2 gap-3">
                 <select value={t.type} onChange={e => updateTrade(i, 'type', e.target.value)} className="bg-gray-800 rounded p-2 text-sm text-gray-300"><option>Future</option><option>Option Call</option><option>Option Put</option><option>Spot</option></select>
                 <select value={t.direction} onChange={e => updateTrade(i, 'direction', e.target.value)} className="bg-gray-800 rounded p-2 text-sm text-gray-300"><option>Long</option><option>Short</option></select>
              </div>
              <input placeholder="Notes..." value={t.notes} onChange={e => updateTrade(i, 'notes', e.target.value)} className="w-full bg-gray-800 rounded p-2 text-sm text-gray-300" />
           </div>
         ))}
         <button onClick={handleAddTrade} className="w-full py-3 border border-dashed border-white/20 rounded-xl text-sm text-gray-400 hover:text-white hover:border-white/50 transition-all">+ Add Trade</button>
      </div>
      <div className="flex gap-4"><button onClick={onCancel} className="flex-1 py-3 rounded-lg text-gray-400 hover:bg-white/5">Cancel</button><button onClick={handleSave} className="flex-1 py-3 bg-orange-600 hover:bg-orange-500 rounded-lg font-bold text-white shadow-lg">Save Journal</button></div>
    </div>
  );
};

export default App;
