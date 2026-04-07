
/// <reference types="vite/client" />
import React, { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { 
  ClientToServerEvents, 
  ServerToClientEvents, 
  ActionState 
} from './types';
import GameCanvas from './components/GameCanvas';
import QuizOverlay from './components/QuizOverlay';
import AdminPanel from './components/AdminPanel';
import { motion, AnimatePresence } from 'motion/react';
import { Swords, Trophy, User, Loader2, Settings, Copy, Share2, Hash, ArrowRight, Plus } from 'lucide-react';

export default function App() {
  const [socket, setSocket] = useState<Socket<ServerToClientEvents, ClientToServerEvents> | null>(null);
  const [gameState, setGameState] = useState<'IDLE' | 'MATCHMAKING' | 'WAITING_ROOM' | 'PLAYING' | 'GAME_OVER'>('IDLE');
  const [showAdmin, setShowAdmin] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [players, setPlayers] = useState<{ id: string; nickname: string; isGM: boolean }[]>([]);
  const [canStart, setCanStart] = useState(false);
  const [isGM, setIsGM] = useState(false);
  const [side, setSide] = useState<'left' | 'right'>('left');
  const [tugOfWarPos, setTugOfWarPos] = useState(0);
  const [globalTimeRemaining, setGlobalTimeRemaining] = useState(60);
  const [actionState, setActionState] = useState<ActionState>('IDLE');
  const [currentQuestion, setCurrentQuestion] = useState<{ text: string; options: string[]; localTimeLimit: number } | null>(null);
  const [lastResult, setLastResult] = useState<{ p1Answer: string | null; p2Answer: string | null; correctAnswer: string; actionState: string } | null>(null);
  const [winner, setWinner] = useState<{ winner: string | null; reason: string } | null>(null);
  const [p1Id, setP1Id] = useState('');
  const [p2Id, setP2Id] = useState('');
  const [p1Nickname, setP1Nickname] = useState('');
  const [p2Nickname, setP2Nickname] = useState('');

  useEffect(() => {
    const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || window.location.origin;
    const newSocket: Socket<ServerToClientEvents, ClientToServerEvents> = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
    });
    setSocket(newSocket);

    // Check for room in URL
    const urlParams = new URLSearchParams(window.location.search);
    const roomFromUrl = urlParams.get('room');
    if (roomFromUrl) {
      setRoomCode(roomFromUrl);
    }

    newSocket.on('connect_error', (err) => {
      console.error('Connection error:', err.message);
      setGameState('IDLE');
    });

    newSocket.on('disconnect', (reason) => {
      console.log('Disconnected:', reason);
      if (reason === 'io server disconnect') {
        newSocket.connect();
      }
      setGameState('IDLE');
    });

    newSocket.on('waiting_for_opponent', () => {
      setGameState('MATCHMAKING');
    });

    newSocket.on('room_info', (data) => {
      setPlayers(data.players);
      setCanStart(data.canStart);
      setGameState('WAITING_ROOM');
      setRoomId(data.roomId);
      
      const me = data.players.find(p => p.id === newSocket.id);
      if (me) {
        setIsGM(me.isGM);
        // Determine side: P1 is always index 0 of combatants
        const combatants = data.players.filter(p => !p.isGM);
        const myIndex = combatants.findIndex(p => p.id === newSocket.id);
        if (myIndex !== -1) {
          setSide(myIndex === 0 ? 'left' : 'right');
        } else {
          setSide('left'); // Spectator default
        }
      }

      const combatants = data.players.filter(p => !p.isGM);
      const p1 = combatants[0];
      const p2 = combatants[1];
      if (p1) {
        setP1Id(p1.id);
        setP1Nickname(p1.nickname);
      }
      if (p2) {
        setP2Id(p2.id);
        setP2Nickname(p2.nickname);
      }
    });

    newSocket.on('match_found', (data) => {
      // This might still be used for global matchmaking or legacy
      setRoomId(data.roomId);
      setSide(data.side);
      setP1Id(data.p1);
      setP2Id(data.p2);
      setGameState('PLAYING');
      setTugOfWarPos(0);
      setGlobalTimeRemaining(60);
      setActionState('IDLE');
      setCurrentQuestion(null);
      setLastResult(null);
    });

    newSocket.on('game_start', (data) => {
      setGameState('PLAYING');
      setRoomId(data.roomId);
      setTugOfWarPos(0);
      setGlobalTimeRemaining(60);
      setActionState('IDLE');
      setCurrentQuestion(null);
      setLastResult(null);
    });

    newSocket.on('server_sync_question', (data) => {
      setGameState('PLAYING'); // Ensure we are in PLAYING state
      setCurrentQuestion({
        text: data.text,
        options: data.options,
        localTimeLimit: data.localTimeLimit
      });
      setLastResult(null);
      setActionState('IDLE');
    });

    newSocket.on('server_broadcast_resolution', (data) => {
      setCurrentQuestion(null);
      setLastResult({
        p1Answer: data.p1Answer,
        p2Answer: data.p2Answer,
        correctAnswer: data.correctAnswer,
        actionState: data.actionState
      });
      setActionState(data.actionState);
      setTugOfWarPos(data.tugOfWarPos);
      setGlobalTimeRemaining(data.globalTimeRemaining);
    });

    newSocket.on('game_over', (data) => {
      setWinner(data);
      setGameState('GAME_OVER');
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  const handleJoinMatchmaking = (code?: string, role: 'GM' | 'PLAYER' = 'PLAYER') => {
    if (!nickname.trim()) {
      alert('Silakan masukkan nickname terlebih dahulu!');
      return;
    }
    if (socket) {
      socket.emit('join_matchmaking', { roomId: code, nickname, role });
    }
  };

  const handleStartGame = () => {
    if (socket && roomId) {
      socket.emit('start_game', { roomId });
    } else if (socket && roomCode) {
      socket.emit('start_game', { roomId: roomCode });
    }
  };

  const handleCreatePrivate = () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    setRoomCode(code);
    handleJoinMatchmaking(code, 'GM');
  };

  const copyLink = () => {
    const url = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
    navigator.clipboard.writeText(url);
    alert('Link disalin ke clipboard!');
  };

  const handleAnswer = (answer: string) => {
    if (socket && roomId) {
      socket.emit('client_submit_answer', { roomId, answer });
    }
  };

  const handlePlayAgain = () => {
    setGameState('IDLE');
    setTugOfWarPos(0);
    setActionState('IDLE');
    setCurrentQuestion(null);
    setLastResult(null);
    setWinner(null);
    setRoomId(null);
    setRoomCode('');
    setPlayers([]);
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans overflow-hidden flex flex-col items-center justify-center">
      <AnimatePresence mode="wait">
        {gameState === 'IDLE' && (
          <motion.div 
            key="idle"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="text-center space-y-8"
          >
            <div className="relative">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="absolute -inset-10 bg-gradient-to-r from-blue-500 via-purple-500 to-red-500 opacity-20 blur-3xl rounded-full"
              />
              <Swords size={80} className="mx-auto text-blue-500 mb-4" />
              <h1 className="text-6xl font-black tracking-tighter uppercase italic">
                Pixel <span className="text-blue-500">Battle</span> Quiz
              </h1>
              <p className="text-gray-400 text-lg max-w-md mx-auto mt-4">
                Uji pengetahuanmu dalam pertarungan real-time pixelated!
              </p>
            </div>
            
            <div className="flex flex-col space-y-4 w-full max-w-xs mx-auto">
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl blur opacity-30 group-focus-within:opacity-100 transition duration-1000 group-focus-within:duration-200"></div>
                <div className="relative flex items-center bg-black rounded-xl border border-white/10">
                  <User className="ml-4 text-gray-500" size={20} />
                  <input 
                    type="text"
                    placeholder="Masukkan Nickname"
                    value={nickname}
                    onChange={e => setNickname(e.target.value)}
                    maxLength={12}
                    className="w-full bg-transparent px-4 py-4 font-bold text-white outline-none placeholder:text-gray-600"
                  />
                </div>
              </div>

              <button 
                onClick={handleCreatePrivate}
                className="group relative px-12 py-5 bg-blue-600 rounded-full font-black text-xl uppercase tracking-widest hover:bg-blue-500 transition-all shadow-2xl shadow-blue-600/30 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!nickname.trim()}
              >
                <span className="relative z-10 flex items-center justify-center space-x-3">
                  <span>Buat Room (GM)</span>
                  <Plus size={24} className="group-hover:rotate-12 transition-transform" />
                </span>
              </button>

              <div className="flex items-center space-x-2">
                <div className="h-[1px] bg-white/10 flex-grow" />
                <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Atau Gabung Sebagai Pemain</span>
                <div className="h-[1px] bg-white/10 flex-grow" />
              </div>

              <div className="space-y-2">
                {roomCode && !nickname.trim() && (
                  <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-center">
                    <p className="text-xs text-yellow-500 font-bold uppercase tracking-widest">
                      Anda diundang ke room: <span className="text-white">{roomCode}</span>
                    </p>
                  </div>
                )}

                <div className="relative">
                  <input 
                    type="text"
                    placeholder="Masukkan Kode Room"
                    value={roomCode}
                    onChange={e => setRoomCode(e.target.value.toUpperCase())}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-center font-mono tracking-widest uppercase focus:border-blue-500 outline-none transition-all"
                  />
                  <button 
                    onClick={() => handleJoinMatchmaking(roomCode, 'PLAYER')}
                    className="absolute right-2 top-2 p-1.5 bg-green-600 rounded-lg hover:bg-green-500 transition-all disabled:opacity-50"
                    disabled={!nickname.trim()}
                  >
                    <ArrowRight size={16} />
                  </button>
                </div>

                <button 
                  onClick={() => handleJoinMatchmaking()}
                  className="w-full py-3 bg-white/5 border border-white/10 rounded-xl font-bold text-xs uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
                  disabled={!nickname.trim()}
                >
                  <Swords size={16} className="text-blue-500" />
                  <span>Matchmaking Global</span>
                </button>
              </div>
            </div>

            <div className="pt-12">
              <button 
                onClick={() => setShowAdmin(true)}
                className="flex items-center space-x-2 text-gray-500 hover:text-white transition-all uppercase text-xs font-bold tracking-widest"
              >
                <Settings size={16} />
                <span>Game Master Settings</span>
              </button>
            </div>
          </motion.div>
        )}

        {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} />}

        {gameState === 'WAITING_ROOM' && (
          <motion.div 
            key="waiting-room"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-8 w-full max-w-md bg-black/40 p-8 rounded-3xl border border-white/10 backdrop-blur-md"
          >
            <div className="space-y-2">
              <h2 className="text-3xl font-black uppercase tracking-widest text-blue-500">Ruang Tunggu</h2>
              <p className="text-gray-400 text-sm">Menunggu Game Master memulai permainan</p>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                {players.map((player) => (
                  <div 
                    key={player.id}
                    className={`flex items-center justify-between p-4 rounded-2xl border ${player.id === socket?.id ? 'bg-blue-500/10 border-blue-500/30' : 'bg-white/5 border-white/10'}`}
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${player.isGM ? 'bg-yellow-500/20 text-yellow-500' : 'bg-blue-500/20 text-blue-500'}`}>
                        <User size={20} />
                      </div>
                      <div className="text-left">
                        <p className="font-bold text-white">{player.nickname} {player.id === socket?.id && '(Anda)'}</p>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest">{player.isGM ? 'Game Master' : 'Pemain'}</p>
                      </div>
                    </div>
                    {player.isGM && <Trophy size={16} className="text-yellow-500" />}
                  </div>
                ))}
                {players.length < 2 && (
                  <div className="flex items-center justify-center p-4 rounded-2xl border border-dashed border-white/10 bg-white/5 animate-pulse">
                    <p className="text-sm text-gray-500 font-bold uppercase tracking-widest">Menunggu Pemain Lain...</p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              {isGM ? (
                <button 
                  onClick={handleStartGame}
                  disabled={!canStart}
                  className="w-full py-5 bg-green-600 rounded-full font-black text-xl uppercase tracking-widest hover:bg-green-500 transition-all shadow-2xl shadow-green-600/30 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Mulai Game
                </button>
              ) : (
                <div className="py-4 px-6 bg-white/5 rounded-2xl border border-white/10">
                  <p className="text-sm text-gray-400 italic">Hanya Game Master yang dapat memulai permainan</p>
                </div>
              )}

              {roomCode && (
                <div className="bg-black/40 p-4 rounded-2xl border border-white/10 space-y-2">
                  <div className="flex items-center justify-center space-x-2 text-yellow-500">
                    <Hash size={16} />
                    <span className="font-black text-xl tracking-widest">{roomCode}</span>
                  </div>
                  <button 
                    onClick={copyLink}
                    className="w-full py-2 bg-white/5 rounded-lg text-[10px] font-bold uppercase tracking-widest hover:bg-white/10 transition-all flex items-center justify-center space-x-2"
                  >
                    <Copy size={12} />
                    <span>Salin Link Undangan</span>
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}

        {gameState === 'PLAYING' && (
          <motion.div 
            key="playing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative w-full min-h-screen flex flex-col items-center justify-center p-4 max-w-5xl mx-auto"
          >
            <div className="relative w-full flex flex-col">
              {isGM && (
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 z-50 bg-yellow-500/20 border border-yellow-500/50 px-4 py-1 rounded-full backdrop-blur-md">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-yellow-500 flex items-center space-x-2">
                    <Settings size={12} className="animate-spin-slow" />
                    <span>Mode Game Master (Spectator)</span>
                  </p>
                </div>
              )}
              <QuizOverlay 
                question={currentQuestion}
                onAnswer={handleAnswer}
                tugOfWarPos={tugOfWarPos}
                globalTimeRemaining={globalTimeRemaining}
                side={side}
                p1Name={p1Id === socket?.id ? `Anda (${p1Nickname})` : p1Nickname}
                p2Name={p2Id === socket?.id ? `Anda (${p2Nickname})` : p2Nickname}
                isGM={isGM}
                lastResult={lastResult}
              >
                <GameCanvas 
                  actionState={actionState} 
                  tugOfWarPos={tugOfWarPos} 
                  side={side} 
                />
              </QuizOverlay>
            </div>
          </motion.div>
        )}

        {gameState === 'GAME_OVER' && (
          <motion.div 
            key="game-over"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center space-y-8 bg-black/50 p-12 rounded-3xl border-2 border-white/10 backdrop-blur-xl"
          >
            <Trophy size={80} className="mx-auto text-yellow-500 mb-4" />
            <h2 className="text-5xl font-black uppercase tracking-tighter">Permainan Selesai!</h2>
            <div className="space-y-2">
              <p className="text-2xl text-gray-300">
                {isGM ? (
                  winner?.winner ? (
                    <span className="text-blue-400 font-bold">
                      {winner.winner === p1Id ? p1Nickname : p2Nickname} Menang!
                    </span>
                  ) : (
                    <span className="text-yellow-400 font-bold">Permainan Seri!</span>
                  )
                ) : (
                  winner?.winner === socket?.id ? (
                    <span className="text-green-400 font-bold">Selamat! Anda Menang!</span>
                  ) : winner?.winner ? (
                    <span className="text-red-400 font-bold">Anda Kalah! Coba lagi!</span>
                  ) : (
                    <span className="text-yellow-400 font-bold">Permainan Seri!</span>
                  )
                )}
              </p>
              <p className="text-gray-500 italic">Alasan: {winner?.reason}</p>
            </div>
            <button 
              onClick={handlePlayAgain}
              className="px-10 py-4 bg-white text-black font-black rounded-full uppercase tracking-widest hover:bg-gray-200 transition-all active:scale-95"
            >
              Kembali ke Menu
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Accents */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none -z-10 opacity-30">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/20 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-red-600/20 blur-[120px] rounded-full" />
      </div>
    </div>
  );
}
