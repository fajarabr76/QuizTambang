
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, Timer, Swords } from 'lucide-react';

interface QuizOverlayProps {
  question: {
    text: string;
    options: string[];
    localTimeLimit: number;
  } | null;
  onAnswer: (answer: string) => void;
  tugOfWarPos: number;
  globalTimeRemaining: number;
  side: 'left' | 'right';
  p1Name: string;
  p2Name: string;
  isGM: boolean;
  lastResult: {
    p1Answer: string | null;
    p2Answer: string | null;
    correctAnswer: string;
    actionState: string;
  } | null;
  children?: React.ReactNode;
}

const QuizOverlay: React.FC<QuizOverlayProps> = ({
  question,
  onAnswer,
  tugOfWarPos,
  globalTimeRemaining,
  side,
  p1Name,
  p2Name,
  isGM,
  lastResult,
  children
}) => {
  const [selected, setSelected] = React.useState<string | null>(null);
  const [timeLeft, setTimeLeft] = React.useState<number>(0);

  React.useEffect(() => {
    setSelected(null);
    if (question) {
      setTimeLeft(question.localTimeLimit);
      const timer = setInterval(() => {
        setTimeLeft(prev => Math.max(0, prev - 1));
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [question]);

  const handleSelect = (ans: string) => {
    if (selected || isGM) return;
    setSelected(ans);
    onAnswer(ans);
  };

  const getOptionLabel = (index: number) => ['A', 'B', 'C', 'D'][index];

  return (
    <div className="w-full flex flex-col gap-4 sm:gap-6">
      {/* Top Section: Canvas + HUD */}
      <div className="relative w-full aspect-[4/3] sm:aspect-[21/9] rounded-2xl overflow-hidden border-2 sm:border-4 border-gray-800 shadow-2xl bg-black">
        {/* The Game Canvas */}
        <div className="absolute inset-0">
          {children}
        </div>
        
        {/* HUD Overlay */}
        <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-2 sm:p-6">
          {/* Top Bar: Tug of War and Global Timer */}
          <div className="flex flex-col items-center w-full space-y-2 sm:space-y-4">

        <div className="flex justify-between items-center w-full max-w-4xl px-2">
          {/* P1 Info */}
          <div className="flex items-center space-x-1 sm:space-x-2 bg-black/40 px-2 sm:px-3 py-1 rounded-lg sm:rounded-xl border border-blue-500/30 backdrop-blur-sm">
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-500 animate-pulse" />
            <span className="text-[10px] sm:text-xs text-white font-black uppercase tracking-widest truncate max-w-[60px] sm:max-w-[120px]">{p1Name}</span>
          </div>

          {/* Global Timer */}
          <div className="bg-black/60 px-3 sm:px-4 py-1 rounded-full border border-yellow-500/50 flex items-center space-x-1 sm:space-x-2 shadow-xl backdrop-blur-md">
            <Timer className="text-yellow-500 w-3.5 h-3.5 sm:w-[18px] sm:h-[18px]" />
            <span className="text-sm sm:text-lg font-black text-white font-mono">{globalTimeRemaining}s</span>
          </div>

          {/* P2 Info */}
          <div className="flex items-center space-x-1 sm:space-x-2 bg-black/40 px-2 sm:px-3 py-1 rounded-lg sm:rounded-xl border border-red-500/30 backdrop-blur-sm">
            <span className="text-[10px] sm:text-xs text-white font-black uppercase tracking-widest truncate max-w-[60px] sm:max-w-[120px]">{p2Name}</span>
            <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-red-500 animate-pulse" />
          </div>
        </div>

        {/* Tug of War Bar */}
        <div className="w-full max-w-2xl relative h-4 sm:h-6 bg-gray-900/80 rounded-full border border-white/10 overflow-hidden shadow-inner mx-2">
          {/* Center Line */}
          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-white/20 z-10" />
          
          {/* Progress Indicator */}
          <motion.div 
            className="absolute top-0 bottom-0 left-1/2 bg-gradient-to-r from-blue-500 to-red-500 opacity-40"
            initial={{ width: 0 }}
            animate={{ 
              width: `${Math.abs(tugOfWarPos)}%`,
              left: tugOfWarPos < 0 ? `${50 + tugOfWarPos}%` : '50%'
            }}
            transition={{ type: 'spring', stiffness: 100 }}
          />

          {/* Tug Marker */}
          <motion.div 
            className="absolute top-0 bottom-0 w-1 bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.8)] z-20"
            initial={{ left: '50%' }}
            animate={{ left: `${50 + tugOfWarPos}%` }}
            transition={{ type: 'spring', stiffness: 100 }}
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-yellow-400 rounded-full border-2 border-black shadow-lg" />
          </motion.div>

          {/* Win Zones */}
          <div className="absolute left-0 top-0 bottom-0 w-2 bg-blue-600/30" />
          <div className="absolute right-0 top-0 bottom-0 w-2 bg-red-600/30" />
        </div>
      </div>

      {/* Center: Last Result Info */}
      <AnimatePresence>
        {lastResult && !question && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.5, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 1.5 }}
            className="self-center bg-black/60 p-4 rounded-2xl border border-white/10 backdrop-blur-sm text-center shadow-2xl mt-12"
          >
            <h2 className="text-lg sm:text-xl font-black text-yellow-400 mb-1 uppercase tracking-widest">
              {lastResult.actionState === 'ENVIRONMENT_PUNISHMENT' ? 'AZAB!!' : lastResult.actionState.replace('_', ' ')}
            </h2>
            <p className="text-white text-sm mb-2">
              Jawaban Benar: <span className="text-green-400 font-bold">{lastResult.correctAnswer}</span>
            </p>
            <div className="flex justify-center space-x-6">
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-gray-400 uppercase">P1</span>
                <span className={`text-sm font-bold ${lastResult.p1Answer === lastResult.correctAnswer ? 'text-green-400' : 'text-red-400'}`}>
                  {lastResult.p1Answer || '---'}
                </span>
              </div>
              <div className="flex flex-col items-center">
                <span className="text-[10px] text-gray-400 uppercase">P2</span>
                <span className={`text-sm font-bold ${lastResult.p2Answer === lastResult.correctAnswer ? 'text-green-400' : 'text-red-400'}`}>
                  {lastResult.p2Answer || '---'}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
        </div>
      </div>

      {/* Bottom: Question and Options */}
      <div className="w-full max-w-4xl mx-auto min-h-[200px] sm:min-h-[250px]">
        <AnimatePresence mode="wait">
          {question && (
            <motion.div 
              key={question.text}
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -20, opacity: 0 }}
              className="bg-black/80 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border-2 border-white/10 backdrop-blur-xl shadow-2xl"
            >
              <div className="mb-4 sm:mb-6 text-center relative">
                <div className="absolute -top-2 right-0 flex items-center space-x-1 sm:space-x-2 bg-blue-500/20 px-2 sm:px-3 py-0.5 sm:py-1 rounded-full border border-blue-500/30">
                  <Timer className="text-blue-400 w-3 h-3 sm:w-3.5 sm:h-3.5" />
                  <span className={`text-xs sm:text-sm font-bold font-mono ${timeLeft <= 3 ? 'text-red-400 animate-pulse' : 'text-blue-400'}`}>
                    {timeLeft}s
                  </span>
                </div>
                <span className="text-[10px] sm:text-xs font-bold text-blue-400 uppercase tracking-[0.2em] sm:tracking-[0.3em] mb-1 sm:mb-2 block">Pertanyaan Baru</span>
                <h3 className="text-lg sm:text-2xl font-bold text-white leading-tight">{question.text}</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
                {question.options.map((opt, i) => {
                  const label = getOptionLabel(i);
                  const isSelected = selected === label;
                  return (
                    <motion.button
                      key={i}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      onClick={() => handleSelect(label)}
                      disabled={!!selected}
                      className={`
                        p-3 sm:p-4 rounded-xl text-left flex items-center space-x-3 sm:space-x-4 border-2 transition-all duration-200
                        ${isSelected 
                          ? 'bg-blue-600 border-blue-400 text-white shadow-lg shadow-blue-500/40' 
                          : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10 hover:border-white/30'}
                        ${selected && !isSelected ? 'opacity-50 grayscale' : ''}
                      `}
                    >
                      <span className={`
                        w-6 h-6 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center font-bold text-xs sm:text-sm
                        ${isSelected ? 'bg-white text-blue-600' : 'bg-white/10 text-white'}
                      `}>
                        {label}
                      </span>
                      <span className="font-medium text-sm sm:text-base">{opt}</span>
                    </motion.button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default QuizOverlay;
