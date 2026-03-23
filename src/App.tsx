import React, { useState, useEffect } from 'react';
import { Trophy, RotateCcw, Search, Trash2, ChevronRight, Minus, Plus, LayoutDashboard, History, Circle } from 'lucide-react';
import { format } from 'date-fns';

const PLAYERS = ['CHAN', 'SEOUNGWOO', 'UNI'];

type Match = {
  id: string;
  date: number;
  p1Name: string;
  p2Name: string;
  p1Score: number;
  p2Score: number;
  winner: string;
};

type PlayerStats = {
  name: string;
  wins: number;
  totalMatches: number;
  winRate: number;
};

export default function App() {
  const [activeTab, setActiveTab] = useState<'scoreboard' | 'history'>('scoreboard');
  
  // Scoreboard State
  const [p1Name, setP1Name] = useState('CHAN');
  const [p2Name, setP2Name] = useState('SEOUNGWOO');
  const [p1Score, setP1Score] = useState(0);
  const [p2Score, setP2Score] = useState(0);
  const [server, setServer] = useState<1 | 2>(1);
  const [isGameOver, setIsGameOver] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);

  // History State
  const [matches, setMatches] = useState<Match[]>(() => {
    const saved = localStorage.getItem('tableTennisMatches');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return [];
      }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('tableTennisMatches', JSON.stringify(matches));
  }, [matches]);

  useEffect(() => {
    // Initialize speech synthesis voices early
    if ('speechSynthesis' in window) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => {
        window.speechSynthesis.getVoices();
      };
    }
  }, []);

  // Game Logic
  // Store utterance globally to prevent garbage collection in some browsers
  const speak = (text: string) => {
    if (!('speechSynthesis' in window)) {
      console.warn('Text-to-speech not supported in this browser.');
      return;
    }

    // Only cancel if it's currently speaking or pending to avoid unnecessary audio pipeline spin-down/up
    if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
      window.speechSynthesis.cancel();
    }
    if ((window as any).speakTimeout) {
      clearTimeout((window as any).speakTimeout);
    }

    // 1. Wake up the audio hardware with a nearly silent dummy utterance.
    // This forces the Bluetooth/OS audio pipeline to open without making an annoying sound.
    const wakeUpUtterance = new SpeechSynthesisUtterance('아');
    wakeUpUtterance.volume = 0.01; // Nearly silent
    wakeUpUtterance.rate = 2; // Fast
    window.speechSynthesis.speak(wakeUpUtterance);

    // 2. Wait for the hardware to wake up (approx 600ms), then speak the actual text.
    (window as any).speakTimeout = setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'ko-KR';
      utterance.rate = 1.1;
      utterance.pitch = 1;
      utterance.volume = 1; // Full volume
      
      // Try to explicitly set a Korean voice if available
      const voices = window.speechSynthesis.getVoices();
      const koVoice = voices.find(v => v.lang.includes('ko') || v.lang.includes('KR'));
      if (koVoice) {
        utterance.voice = koVoice;
      }

      // Attach to window to prevent garbage collection (Safari bug workaround)
      (window as any).currentUtterance = utterance;
      
      window.speechSynthesis.speak(utterance);
    }, 600);
  };

  const announceScore = (s1: number, s2: number, n1: string, n2: string) => {
    if (s1 === s2) {
      if (s1 >= 10) {
        speak('듀스!');
      } else {
        speak(`${s1} 대 ${s2} 동점`);
      }
    } else if (s1 > s2) {
      speak(`${n1} ${s1}점 대 ${n2} ${s2}점`);
    } else {
      speak(`${n2} ${s2}점 대 ${n1} ${s1}점`);
    }
  };

  const updateServer = (s1: number, s2: number) => {
    const totalPoints = s1 + s2;
    if (s1 >= 10 && s2 >= 10) {
      setServer((totalPoints % 2 === 0) ? 1 : 2);
    } else {
      setServer((Math.floor(totalPoints / 2) % 2 === 0) ? 1 : 2);
    }
  };

  const checkWinner = (s1: number, s2: number) => {
    if ((s1 >= 11 || s2 >= 11) && Math.abs(s1 - s2) >= 2) {
      setIsGameOver(true);
      const winnerName = s1 > s2 ? p1Name : p2Name;
      setWinner(winnerName);
      
      const newMatch: Match = {
        id: Date.now().toString(),
        date: Date.now(),
        p1Name,
        p2Name,
        p1Score: s1,
        p2Score: s2,
        winner: winnerName,
      };
      
      setMatches(prev => [newMatch, ...prev]);
      
      speak(`경기가 종료되었습니다. ${winnerName} 선수가 승리했습니다.`);
      return true;
    }
    return false;
  };

  const incrementScore = (player: 1 | 2) => {
    if (isGameOver) return;
    
    let newS1 = p1Score;
    let newS2 = p2Score;
    
    if (player === 1) newS1++;
    else newS2++;
    
    setP1Score(newS1);
    setP2Score(newS2);
    
    updateServer(newS1, newS2);
    const isWin = checkWinner(newS1, newS2);
    if (!isWin) {
      announceScore(newS1, newS2, p1Name, p2Name);
    }
  };

  const decrementScore = (player: 1 | 2) => {
    if (isGameOver) return;
    
    let newS1 = p1Score;
    let newS2 = p2Score;
    
    if (player === 1 && newS1 > 0) newS1--;
    else if (player === 2 && newS2 > 0) newS2--;
    else return;
    
    setP1Score(newS1);
    setP2Score(newS2);
    
    updateServer(newS1, newS2);
    announceScore(newS1, newS2, p1Name, p2Name);
  };

  const resetGame = () => {
    setP1Score(0);
    setP2Score(0);
    setIsGameOver(false);
    setWinner(null);
    setServer(1);
    speak("경기를 초기화합니다.");
  };

  const deleteMatch = (id: string) => {
    setMatches(prev => prev.filter(m => m.id !== id));
  };

  // Rankings Logic
  const calculateRankings = (): PlayerStats[] => {
    const statsMap = new Map<string, { wins: number; total: number }>();
    
    matches.forEach(m => {
      // Init P1
      if (!statsMap.has(m.p1Name)) statsMap.set(m.p1Name, { wins: 0, total: 0 });
      // Init P2
      if (!statsMap.has(m.p2Name)) statsMap.set(m.p2Name, { wins: 0, total: 0 });
      
      // Update totals
      statsMap.get(m.p1Name)!.total++;
      statsMap.get(m.p2Name)!.total++;
      
      // Update wins
      statsMap.get(m.winner)!.wins++;
    });
    
    const rankings: PlayerStats[] = Array.from(statsMap.entries()).map(([name, stats]) => ({
      name,
      wins: stats.wins,
      totalMatches: stats.total,
      winRate: (stats.wins / stats.total) * 100
    }));
    
    // Sort by win rate descending, then by total matches descending
    return rankings.sort((a, b) => {
      if (b.winRate !== a.winRate) return b.winRate - a.winRate;
      return b.totalMatches - a.totalMatches;
    }).slice(0, 3); // Top 3
  };

  const isDeuce = p1Score >= 10 && p2Score >= 10 && p1Score === p2Score;

  return (
    <div className="flex flex-col h-screen bg-white text-[#161616] font-sans overflow-hidden">
      {/* Header */}
      <header className="flex justify-between items-center px-4 h-12 w-full shrink-0 bg-white border-b border-[#e0e0e0] z-50">
        <div className="flex items-center gap-3">
          <Trophy className="w-5 h-5 text-[#0f62fe]" />
          <h1 className="font-semibold text-base tracking-tight">sw 탁구</h1>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'scoreboard' ? (
            <button 
              onClick={resetGame}
              className="p-2 text-[#525252] hover:bg-[#e5e5e5] transition-colors duration-200 active:opacity-80 rounded-none"
              aria-label="Reset Game"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
          ) : (
            <button className="p-2 text-[#525252] hover:bg-[#e5e5e5] transition-colors duration-200 rounded-none">
              <Search className="w-5 h-5" />
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 relative overflow-hidden flex flex-col">
        {activeTab === 'scoreboard' ? (
          <div className="flex-1 flex flex-col landscape:flex-row relative">
            {/* Player 1 Section */}
            <section 
              className="flex-1 relative flex flex-col items-center justify-center bg-white select-none cursor-pointer"
              onClick={() => incrementScore(1)}
              onContextMenu={(e) => { e.preventDefault(); decrementScore(1); }}
            >
              <div className="absolute top-4 w-full px-6 flex justify-between items-center pointer-events-none">
                <select 
                  value={p1Name}
                  onChange={(e) => setP1Name(e.target.value)}
                  className="bg-transparent border-none text-[#525252] font-semibold text-sm tracking-widest uppercase focus:ring-0 w-32 pointer-events-auto outline-none cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                >
                  {PLAYERS.filter(p => p !== p2Name || p === p1Name).map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                <div className={`text-[#0f62fe] transition-opacity duration-200 ${server === 1 ? 'opacity-100' : 'opacity-0'}`}>
                  <Circle className="w-4 h-4 fill-current" />
                </div>
              </div>
              
              <div className="text-[clamp(6rem,25vmin,18rem)] leading-none font-semibold tabular-nums tracking-tighter">
                {p1Score}
              </div>
              
              <div className="absolute bottom-6 flex gap-8 pointer-events-none">
                <button 
                  onClick={(e) => { e.stopPropagation(); decrementScore(1); }}
                  className="w-12 h-12 flex items-center justify-center bg-[#e0e0e0] border border-[#d1d1d1] text-[#161616] pointer-events-auto active:bg-[#c6c6c6] rounded-none transition-colors"
                >
                  <Minus className="w-6 h-6" />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); incrementScore(1); }}
                  className="w-12 h-12 flex items-center justify-center bg-[#0f62fe] text-white pointer-events-auto active:bg-[#0043ce] rounded-none transition-colors"
                >
                  <Plus className="w-6 h-6" />
                </button>
              </div>
            </section>

            {/* Divider */}
            <div className="h-[1px] w-full landscape:w-[1px] landscape:h-full bg-[#e0e0e0] z-10 shrink-0"></div>

            {/* Player 2 Section */}
            <section 
              className="flex-1 relative flex flex-col items-center justify-center bg-[#f4f4f4] select-none cursor-pointer"
              onClick={() => incrementScore(2)}
              onContextMenu={(e) => { e.preventDefault(); decrementScore(2); }}
            >
              <div className="absolute top-4 w-full px-6 flex justify-between items-center pointer-events-none">
                <select 
                  value={p2Name}
                  onChange={(e) => setP2Name(e.target.value)}
                  className="bg-transparent border-none text-[#525252] font-semibold text-sm tracking-widest uppercase focus:ring-0 w-32 pointer-events-auto outline-none cursor-pointer"
                  onClick={(e) => e.stopPropagation()}
                >
                  {PLAYERS.filter(p => p !== p1Name || p === p2Name).map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
                <div className={`text-[#0f62fe] transition-opacity duration-200 ${server === 2 ? 'opacity-100' : 'opacity-0'}`}>
                  <Circle className="w-4 h-4 fill-current" />
                </div>
              </div>
              
              <div className="text-[clamp(6rem,25vmin,18rem)] leading-none font-semibold tabular-nums tracking-tighter">
                {p2Score}
              </div>
              
              <div className="absolute bottom-6 flex gap-8 pointer-events-none">
                <button 
                  onClick={(e) => { e.stopPropagation(); decrementScore(2); }}
                  className="w-12 h-12 flex items-center justify-center bg-[#e0e0e0] border border-[#d1d1d1] text-[#161616] pointer-events-auto active:bg-[#c6c6c6] rounded-none transition-colors"
                >
                  <Minus className="w-6 h-6" />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); incrementScore(2); }}
                  className="w-12 h-12 flex items-center justify-center bg-[#0f62fe] text-white pointer-events-auto active:bg-[#0043ce] rounded-none transition-colors"
                >
                  <Plus className="w-6 h-6" />
                </button>
              </div>
            </section>

            {/* Deuce Badge */}
            {isDeuce && (
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 bg-[#da1e28] px-4 py-1 text-white font-bold text-xs tracking-tighter uppercase animate-pulse">
                듀스
              </div>
            )}

            {/* Victory Overlay */}
            {isGameOver && winner && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#161616]/80 backdrop-blur-sm">
                <div className="bg-white p-8 flex flex-col items-center gap-4 min-w-[320px] shadow-2xl animate-in fade-in zoom-in duration-200">
                  <div className="w-16 h-16 bg-[#e0e0e0] rounded-full flex items-center justify-center mb-2">
                    <Trophy className="w-8 h-8 text-[#0f62fe]" />
                  </div>
                  <h2 className="text-3xl font-bold tracking-tight text-[#161616] text-center">
                    {winner} 승리!
                  </h2>
                  <p className="text-[#525252] text-xl font-semibold tabular-nums mb-4">
                    {p1Score} : {p2Score}
                  </p>
                  <button
                    onClick={resetGame}
                    className="w-full py-4 bg-[#0f62fe] text-white text-lg font-semibold hover:bg-[#0043ce] active:bg-[#002d9c] transition-colors flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="w-5 h-5" />
                    다시하기
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto pb-20 bg-white">
            <div className="px-4 py-6 max-w-2xl mx-auto">
              {/* Ranking Board */}
              <div className="mb-10">
                <div className="flex justify-between items-baseline mb-4 border-b border-[#e0e0e0] pb-2">
                  <h2 className="text-xl font-normal tracking-tight text-[#161616]">랭킹 보드</h2>
                  <span className="text-[11px] font-medium text-[#525252] uppercase tracking-widest">Win Rate</span>
                </div>
                
                <div className="bg-[#f4f4f4] border border-[#e0e0e0] p-4 flex flex-col gap-4 rounded-none">
                  {calculateRankings().map((player, index) => (
                    <div key={player.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 flex items-center justify-center font-bold text-sm rounded-none ${
                          index === 0 ? 'bg-[#0f62fe] text-white' : 
                          index === 1 ? 'bg-[#c6c6c6] text-[#161616]' : 
                          'bg-[#e0e0e0] text-[#161616]'
                        }`}>
                          {index + 1}
                        </div>
                        <span className="text-sm font-semibold">{player.name}</span>
                      </div>
                      <div className="flex flex-col items-end">
                        <div className="flex items-center gap-2 text-[11px] text-[#525252] mb-1">
                          <span>경기수: {player.totalMatches}</span>
                          <span className="text-[#c6c6c6]">|</span>
                          <span>승리: {player.wins}</span>
                          <span className="text-[#c6c6c6]">|</span>
                          <span>패배: {player.totalMatches - player.wins}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-[#525252]">승률</span>
                          <span className="text-sm font-semibold">{player.winRate.toFixed(1)}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {calculateRankings().length === 0 && (
                    <div className="text-center text-sm text-[#525252] py-4">기록이 없습니다.</div>
                  )}
                </div>
              </div>

              {/* Match History */}
              <div>
                <div className="flex justify-between items-baseline mb-4 border-b border-[#e0e0e0] pb-2">
                  <h2 className="text-2xl font-normal tracking-tight text-[#161616]">경기 기록</h2>
                  <span className="text-[11px] font-medium text-[#525252] uppercase tracking-widest">Ascending</span>
                </div>
                
                <div className="flex flex-col gap-[1px] bg-[#e0e0e0] border border-[#e0e0e0]">
                  {matches.map((match) => (
                    <div key={match.id} className="bg-white p-4 flex flex-col gap-3 group hover:bg-[#f4f4f4] transition-colors relative rounded-none">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-normal text-[#525252]">
                          {format(match.date, 'yyyy.MM.dd')}
                        </span>
                        <div className="flex items-center gap-2">
                          <div className="bg-[#a7f0ba] text-[#044317] text-[11px] px-2 py-0.5 font-medium uppercase rounded-none">
                            {match.winner} 승리
                          </div>
                          <button 
                            onClick={() => deleteMatch(match.id)}
                            className="text-[#da1e28] hover:bg-[#fff1f1] p-1 rounded-none transition-colors"
                            aria-label="Delete match"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="flex justify-between items-center">
                        <div className="flex flex-col">
                          <span className={`text-sm ${match.p1Name === match.winner ? 'font-semibold text-[#0f62fe]' : 'text-[#161616]'}`}>
                            {match.p1Name}
                          </span>
                          <span className={`text-sm ${match.p2Name === match.winner ? 'font-semibold text-[#0f62fe]' : 'text-[#161616]'}`}>
                            {match.p2Name}
                          </span>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="flex flex-col items-end">
                            <span className={`text-xl tracking-tighter ${match.p1Score > match.p2Score ? 'font-semibold text-[#161616]' : 'font-normal text-[#8d8d8d]'}`}>
                              {match.p1Score}
                            </span>
                            <span className={`text-xl tracking-tighter ${match.p2Score > match.p1Score ? 'font-semibold text-[#161616]' : 'font-normal text-[#8d8d8d]'}`}>
                              {match.p2Score}
                            </span>
                          </div>
                          <ChevronRight className="w-6 h-6 text-[#8d8d8d]" />
                        </div>
                      </div>
                    </div>
                  ))}
                  {matches.length === 0 && (
                    <div className="bg-white p-8 text-center text-sm text-[#525252]">
                      저장된 경기 기록이 없습니다.
                    </div>
                  )}
                </div>
                
                {matches.length > 0 && (
                  <div className="mt-8 flex flex-col items-center gap-2 opacity-40">
                    <div className="h-[1px] w-12 bg-[#161616]"></div>
                    <span className="text-[10px] font-semibold tracking-widest uppercase">End of Records</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="shrink-0 w-full flex justify-around items-center h-14 bg-white border-t border-[#e0e0e0] z-50">
        <button 
          onClick={() => setActiveTab('scoreboard')}
          className={`flex flex-col items-center justify-center flex-1 h-full rounded-none transition-colors ${
            activeTab === 'scoreboard' 
              ? 'text-[#0f62fe] border-t-2 border-[#0f62fe] pt-1 bg-[#f4f4f4]' 
              : 'text-[#525252] pt-1 hover:bg-[#f4f4f4]'
          }`}
        >
          <LayoutDashboard className="w-5 h-5 mb-0.5" />
          <span className={`text-[11px] ${activeTab === 'scoreboard' ? 'font-semibold' : 'font-normal'}`}>점수판</span>
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={`flex flex-col items-center justify-center flex-1 h-full rounded-none transition-colors ${
            activeTab === 'history' 
              ? 'text-[#0f62fe] border-t-2 border-[#0f62fe] pt-1 bg-[#f4f4f4]' 
              : 'text-[#525252] pt-1 hover:bg-[#f4f4f4]'
          }`}
        >
          <History className="w-5 h-5 mb-0.5" />
          <span className={`text-[11px] ${activeTab === 'history' ? 'font-semibold' : 'font-normal'}`}>기록</span>
        </button>
      </nav>
    </div>
  );
}
