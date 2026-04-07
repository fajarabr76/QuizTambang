
import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Settings, Plus, Trash2, Save, X, Database, List } from 'lucide-react';
import { QuizQuestion, GameConfig } from '../types';

const AdminPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [configs, setConfigs] = useState<GameConfig[]>([]);
  const [newQuestion, setNewQuestion] = useState({
    question_text: '',
    option_a: '',
    option_b: '',
    option_c: '',
    option_d: '',
    correct_option: 'A' as 'A' | 'B' | 'C' | 'D',
    difficulty_level: 1
  });

  useEffect(() => {
    fetchQuestions();
    fetchConfigs();
  }, []);

  const fetchQuestions = async () => {
    const res = await fetch('/api/v1/admin/questions');
    const data = await res.json();
    setQuestions(data);
  };

  const fetchConfigs = async () => {
    const res = await fetch('/api/v1/admin/configs');
    const data = await res.json();
    setConfigs(data);
  };

  const handleAddQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/v1/admin/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newQuestion)
    });
    setNewQuestion({
      question_text: '',
      option_a: '',
      option_b: '',
      option_c: '',
      option_d: '',
      correct_option: 'A',
      difficulty_level: 1
    });
    fetchQuestions();
  };

  const handleDeleteQuestion = async (id: string) => {
    await fetch(`/api/v1/admin/questions/${id}`, { method: 'DELETE' });
    fetchQuestions();
  };

  const handleUpdateConfig = async (key: string, value: number) => {
    await fetch('/api/v1/admin/configs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value })
    });
    fetchConfigs();
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md overflow-y-auto p-8"
    >
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-12">
          <div className="flex items-center space-x-4">
            <Settings className="text-blue-500" size={40} />
            <h1 className="text-4xl font-black uppercase tracking-tighter">Game Master Panel</h1>
          </div>
          <button 
            onClick={onClose}
            className="p-3 bg-white/10 rounded-full hover:bg-white/20 transition-all"
          >
            <X size={24} />
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* Game Settings */}
          <div className="lg:col-span-1 space-y-8">
            <div className="bg-white/5 p-6 rounded-3xl border border-white/10">
              <div className="flex items-center space-x-3 mb-6">
                <Database className="text-yellow-500" size={24} />
                <h2 className="text-xl font-bold uppercase">Game Configs</h2>
              </div>
              <div className="space-y-6">
                {configs.map(config => (
                  <div key={config.id} className="space-y-2">
                    <label className="text-xs text-gray-400 uppercase font-bold tracking-widest">
                      {config.config_key.replace('_', ' ')}
                    </label>
                    <div className="flex space-x-2">
                      <input 
                        type="number" 
                        defaultValue={config.config_value}
                        onBlur={(e) => handleUpdateConfig(config.config_key, parseInt(e.target.value))}
                        className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 focus:border-blue-500 outline-none transition-all"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Question Management */}
          <div className="lg:col-span-2 space-y-8">
            {/* Add Question Form */}
            <form onSubmit={handleAddQuestion} className="bg-white/5 p-8 rounded-3xl border border-white/10 space-y-6">
              <div className="flex items-center space-x-3 mb-2">
                <Plus className="text-green-500" size={24} />
                <h2 className="text-xl font-bold uppercase">Add New Question</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2">
                  <label className="text-xs text-gray-400 uppercase font-bold mb-2 block">Question Text</label>
                  <textarea 
                    required
                    value={newQuestion.question_text}
                    onChange={e => setNewQuestion({...newQuestion, question_text: e.target.value})}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 focus:border-blue-500 outline-none transition-all h-24"
                  />
                </div>
                {['a', 'b', 'c', 'd'].map(opt => (
                  <div key={opt}>
                    <label className="text-xs text-gray-400 uppercase font-bold mb-2 block">Option {opt.toUpperCase()}</label>
                    <input 
                      required
                      type="text"
                      value={(newQuestion as any)[`option_${opt}`]}
                      onChange={e => setNewQuestion({...newQuestion, [`option_${opt}`]: e.target.value})}
                      className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 focus:border-blue-500 outline-none transition-all"
                    />
                  </div>
                ))}
                <div>
                  <label className="text-xs text-gray-400 uppercase font-bold mb-2 block">Correct Option</label>
                  <select 
                    value={newQuestion.correct_option}
                    onChange={e => setNewQuestion({...newQuestion, correct_option: e.target.value as any})}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 focus:border-blue-500 outline-none transition-all"
                  >
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs text-gray-400 uppercase font-bold mb-2 block">Difficulty</label>
                  <input 
                    type="number"
                    value={newQuestion.difficulty_level}
                    onChange={e => setNewQuestion({...newQuestion, difficulty_level: parseInt(e.target.value)})}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-2 focus:border-blue-500 outline-none transition-all"
                  />
                </div>
              </div>
              <button 
                type="submit"
                className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold uppercase tracking-widest transition-all flex items-center justify-center space-x-2"
              >
                <Save size={20} />
                <span>Save Question</span>
              </button>
            </form>

            {/* Question List */}
            <div className="bg-white/5 p-8 rounded-3xl border border-white/10">
              <div className="flex items-center space-x-3 mb-6">
                <List className="text-purple-500" size={24} />
                <h2 className="text-xl font-bold uppercase">Question Bank ({questions.length})</h2>
              </div>
              <div className="space-y-4">
                {questions.map(q => (
                  <div key={q.id} className="bg-black/40 p-4 rounded-2xl border border-white/5 flex justify-between items-start group">
                    <div className="space-y-2">
                      <p className="font-bold text-white">{q.question_text}</p>
                      <div className="flex flex-wrap gap-2">
                        {['A', 'B', 'C', 'D'].map(opt => (
                          <span key={opt} className={`text-[10px] px-2 py-1 rounded-md font-bold ${q.correct_option === opt ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-white/5 text-gray-500'}`}>
                            {opt}: {(q as any)[`option_${opt.toLowerCase()}`]}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button 
                      onClick={() => handleDeleteQuestion(q.id)}
                      className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default AdminPanel;
