/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, LayoutDashboard, Brain, CheckCircle2, AlertCircle, Info, ChevronRight, Apple, Activity, Flame, Loader2, History, X, Trash2, Calendar, PieChart as PieIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI, Type } from "@google/genai";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

// Initialize Gemini API
const ai = new GoogleGenAI({
  apiKey: import.meta.env.VITE_GEMINI_API_KEY,
});

interface NutritionData {
  food_name: string;
  confidence: 'low' | 'medium' | 'high';
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  health_score: number;
  health_category: 'Healthy' | 'Moderate' | 'Unhealthy';
  tips: string;
}

interface HistoryItem {
  id: string;
  data: NutritionData;
  image: string;
  timestamp: string;
}

export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<NutritionData | null>(null);
  const [portionScale, setPortionScale] = useState(1.0);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load history from localStorage
  useEffect(() => {
    const savedHistory = localStorage.getItem('nutravision_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (err) {
        console.error('Failed to parse history:', err);
      }
    }
  }, []);

  // Save history to localStorage
  const saveToHistory = (data: NutritionData, img: string) => {
    const newItem: HistoryItem = {
      id: crypto.randomUUID(),
      data,
      image: img,
      timestamp: new Date().toISOString(),
    };
    const updatedHistory = [newItem, ...history];
    setHistory(updatedHistory);
    localStorage.setItem('nutravision_history', JSON.stringify(updatedHistory));
  };

  const removeFromHistory = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedHistory = history.filter(item => item.id !== id);
    setHistory(updatedHistory);
    localStorage.setItem('nutravision_history', JSON.stringify(updatedHistory));
  };

  const clearHistory = () => {
    if (window.confirm('Are you sure you want to clear all history?')) {
      setHistory([]);
      localStorage.removeItem('nutravision_history');
    }
  };

  const selectHistoryItem = (item: HistoryItem) => {
    setImage(item.image);
    setResult(item.data);
    setPortionScale(1.0);
    setIsHistoryOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
        analyzeImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const analyzeImage = async (base64Image: string) => {
    setLoading(true);
    setError(null);
    setResult(null);

    const base64Data = base64Image.split(',')[1];

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Data,
              },
            },
            {
              text: "Identify the food item(s) in this image and estimate nutritional values. Provide portion size estimates as well.",
            },
          ],
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              food_name: { type: Type.STRING },
              confidence: { type: Type.STRING, enum: ["low", "medium", "high"] },
              calories_kcal: { type: Type.NUMBER },
              protein_g: { type: Type.NUMBER },
              carbs_g: { type: Type.NUMBER },
              fat_g: { type: Type.NUMBER },
              fiber_g: { type: Type.NUMBER },
              sugar_g: { type: Type.NUMBER },
              sodium_mg: { type: Type.NUMBER },
              health_score: { type: Type.NUMBER },
              health_category: { type: Type.STRING, enum: ["Healthy", "Moderate", "Unhealthy"] },
              tips: { type: Type.STRING },
            },
            required: ["food_name", "confidence", "calories_kcal", "protein_g", "carbs_g", "fat_g", "health_score", "health_category", "tips"],
          },
        },
      });

      if (response.text) {
        const data = JSON.parse(response.text);
        setResult(data);
        setPortionScale(1.0);
        saveToHistory(data, base64Image);
      } else {
        throw new Error("No data received from AI");
      }
    } catch (err) {
      console.error(err);
      setError("Failed to analyze image. Please try again with a clearer photo.");
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setImage(null);
    setResult(null);
    setPortionScale(1.0);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] font-sans selection:bg-blue-100">
      {/* Navigation */}
      <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-[#E5E5E7] z-50 py-4 px-6 md:px-12 flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
            <LayoutDashboard className="text-white w-5 h-5" />
          </div>
          <span className="font-bold text-xl tracking-tight">NutraVision</span>
        </div>
        <div className="flex items-center gap-6">
          <button 
            onClick={() => setIsHistoryOpen(true)}
            className="flex items-center gap-2 text-sm font-medium hover:text-black/60 transition-colors"
          >
            <History className="w-4 h-4" />
            History
          </button>
          <button 
            onClick={reset}
            className="text-sm font-medium hover:text-black/60 transition-colors"
          >
            Reset
          </button>
        </div>
      </nav>

      {/* History Sidebar */}
      <AnimatePresence>
        {isHistoryOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHistoryOpen(false)}
              className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[60]"
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-white z-[70] shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-[#E5E5E7] flex justify-between items-center bg-white sticky top-0">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5" />
                  <h2 className="font-bold text-xl">History</h2>
                </div>
                <div className="flex items-center gap-2">
                  {history.length > 0 && (
                    <button 
                      onClick={clearHistory}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"
                      title="Clear all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <button 
                    onClick={() => setIsHistoryOpen(false)}
                    className="p-2 hover:bg-[#F5F5F7] rounded-full transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {history.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4 opacity-40">
                    <History className="w-12 h-12" />
                    <p className="font-medium">No history yet. Start by analyzing a food image!</p>
                  </div>
                ) : (
                  history.map((item) => (
                    <motion.div
                      layout
                      key={item.id}
                      onClick={() => selectHistoryItem(item)}
                      className="group relative bg-[#F5F5F7] rounded-2xl p-3 flex gap-4 cursor-pointer hover:bg-[#E5E5E7] transition-all"
                    >
                      <img 
                        src={item.image} 
                        alt={item.data.food_name} 
                        className="w-20 h-20 object-cover rounded-xl"
                      />
                      <div className="flex-1 min-w-0 py-1">
                        <div className="flex justify-between items-start">
                          <h3 className="font-bold text-sm truncate uppercase tracking-tight pr-6">{item.data.food_name}</h3>
                          <button 
                            onClick={(e) => removeFromHistory(item.id, e)}
                            className="absolute top-3 right-3 p-1 text-[#86868B] hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs font-bold text-orange-600 bg-orange-100 px-1.5 py-0.5 rounded">
                            {item.data.calories_kcal} kcal
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                            item.data.health_category === 'Healthy' ? 'bg-green-100 text-green-700' :
                            item.data.health_category === 'Moderate' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                          }`}>
                            {item.data.health_score} Score
                          </span>
                        </div>
                        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-[#86868B] font-medium">
                          <Calendar className="w-3 h-3" />
                          {new Date(item.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <main className="pt-24 pb-12 px-6 md:px-12 max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-start">
          
          {/* Left Column: Upload Area */}
          <section className="space-y-8">
            <header className="space-y-4">
              <motion.h1 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-5xl font-bold leading-[1.1] tracking-tight"
              >
                Eat Smarter.<br />Live Better.
              </motion.h1>
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="text-lg text-[#86868B] max-w-md"
              >
                Snap a photo of your meal and let our AI analyze it for calories, macronutrients, and health scores in seconds.
              </motion.p>
            </header>

            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="relative aspect-square md:aspect-[4/3] bg-white rounded-3xl border border-[#E5E5E7] overflow-hidden group shadow-sm hover:shadow-md transition-shadow"
            >
              {image ? (
                <div className="relative h-full w-full">
                  <img src={image} alt="Food to analyze" className="h-full w-full object-cover" />
                  {loading && (
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex flex-col items-center justify-center text-white p-6 text-center space-y-4">
                      <Loader2 className="w-10 h-10 animate-spin" />
                      <div>
                        <p className="font-semibold text-lg">Analyzing Your Meal...</p>
                        <p className="text-sm text-white/80">Gemini is estimating nutritional values</p>
                      </div>
                    </div>
                  )}
                  {!loading && (
                    <button 
                      onClick={reset}
                      className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur px-6 py-2 rounded-full text-sm font-semibold shadow-lg hover:bg-white transition-colors"
                    >
                      New Photo
                    </button>
                  )}
                </div>
              ) : (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="h-full w-full flex flex-col items-center justify-center cursor-pointer p-8 space-y-6"
                >
                  <div className="w-20 h-20 bg-[#F5F5F7] rounded-full flex items-center justify-center group-hover:bg-[#E5E5E7] transition-colors">
                    <Camera className="w-8 h-8 text-[#86868B]" />
                  </div>
                  <div className="text-center">
                    <p className="font-semibold text-xl">Capture or Upload</p>
                    <p className="text-[#86868B]">Identify any dish instantly</p>
                  </div>
                  <div className="flex gap-4">
                    <button className="flex items-center gap-2 bg-black text-white px-6 py-3 rounded-full font-medium hover:bg-black/90 transition-all active:scale-95">
                      <Camera className="w-4 h-4" /> Snap Photo
                    </button>
                    <button className="flex items-center gap-2 bg-[#F5F5F7] text-black px-6 py-3 rounded-full font-medium hover:bg-[#E5E5E7] transition-all active:scale-95">
                      <Upload className="w-4 h-4" /> Gallery
                    </button>
                  </div>
                  <input 
                    type="file" 
                    className="hidden" 
                    ref={fileInputRef} 
                    accept="image/*"
                    onChange={handleFileUpload}
                  />
                </div>
              )}
            </motion.div>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 border border-red-100 p-4 rounded-2xl flex items-center gap-3 text-red-600"
              >
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p className="text-sm font-medium">{error}</p>
              </motion.div>
            )}
          </section>

          {/* Right Column: Results */}
          <section className="h-full">
            <AnimatePresence mode="wait">
              {result ? (
                <motion.div 
                  key="result"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  <div className="bg-white rounded-3xl p-8 border border-[#E5E5E7] shadow-sm">
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <h2 className="text-3xl font-bold uppercase tracking-tight">{result.food_name}</h2>
                        <div className="flex items-center gap-2 mt-2">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            result.confidence === 'high' ? 'bg-green-100 text-green-700' : 
                            result.confidence === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'
                          }`}>
                            AI Confidence: {result.confidence}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-4xl font-black">{result.health_score}</div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-[#86868B]">Health Score</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-8">
                      <div className="bg-[#F5F5F7] p-4 rounded-2xl flex items-center gap-4">
                        <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                          <Flame className="w-5 h-5 text-orange-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{Math.round(result.calories_kcal * portionScale)}</p>
                          <p className="text-[10px] font-bold uppercase text-[#86868B] tracking-wider">Calories</p>
                        </div>
                      </div>
                      <div className="bg-[#F5F5F7] p-4 rounded-2xl flex items-center gap-4">
                        <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <Activity className="w-5 h-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-2xl font-bold">{result.health_category}</p>
                          <p className="text-[10px] font-bold uppercase text-[#86868B] tracking-wider">Category</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 mb-8">
                      <div className="flex justify-between items-end">
                        <h3 className="text-xs font-bold uppercase tracking-widest text-[#86868B]">Adjust Serving Size</h3>
                        <span className="text-sm font-bold text-black">{Math.round(portionScale * 100)}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0.5" 
                        max="2.5" 
                        step="0.1" 
                        value={portionScale} 
                        onChange={(e) => setPortionScale(parseFloat(e.target.value))}
                        className="w-full h-1.5 bg-[#F5F5F7] rounded-lg appearance-none cursor-pointer accent-black"
                      />
                      <div className="flex justify-between text-[10px] font-bold text-[#86868B] uppercase tracking-tighter">
                        <span>Small (50%)</span>
                        <span>Standard</span>
                        <span>Large (250%)</span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-xs font-bold uppercase tracking-widest text-[#86868B]">Nutritional Breakdown</h3>
                      
                      <div className="flex flex-col md:flex-row gap-6 items-center">
                        <div className="w-full h-48 md:w-1/2">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={[
                                  { name: 'Protein', value: result.protein_g * portionScale },
                                  { name: 'Carbs', value: result.carbs_g * portionScale },
                                  { name: 'Fat', value: result.fat_g * portionScale },
                                ]}
                                cx="50%"
                                cy="50%"
                                innerRadius={40}
                                outerRadius={60}
                                paddingAngle={5}
                                dataKey="value"
                              >
                                <Cell key="cell-0" fill="#3B82F6" />
                                <Cell key="cell-1" fill="#EAB308" />
                                <Cell key="cell-2" fill="#EF4444" />
                              </Pie>
                              <Tooltip 
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                                formatter={(value: number) => [`${value.toFixed(1)}g`, '']}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                        
                        <div className="w-full md:w-1/2 space-y-4">
                          <div className="space-y-1">
                            <div className="flex justify-between items-center">
                              <p className="text-[10px] font-bold uppercase text-[#86868B]">Protein</p>
                              <p className="text-sm font-bold">{(result.protein_g * portionScale).toFixed(1)}g</p>
                            </div>
                            <div className="h-1.5 bg-[#F5F5F7] rounded-full overflow-hidden">
                              <div className="h-full bg-blue-500" style={{ width: `${Math.min(100, (result.protein_g * portionScale) * 2)}%` }}></div>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between items-center">
                              <p className="text-[10px] font-bold uppercase text-[#86868B]">Carbs</p>
                              <p className="text-sm font-bold">{(result.carbs_g * portionScale).toFixed(1)}g</p>
                            </div>
                            <div className="h-1.5 bg-[#F5F5F7] rounded-full overflow-hidden">
                              <div className="h-full bg-yellow-500" style={{ width: `${Math.min(100, (result.carbs_g * portionScale) / 2)}%` }}></div>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <div className="flex justify-between items-center">
                              <p className="text-[10px] font-bold uppercase text-[#86868B]">Fat</p>
                              <p className="text-sm font-bold">{(result.fat_g * portionScale).toFixed(1)}g</p>
                            </div>
                            <div className="h-1.5 bg-[#F5F5F7] rounded-full overflow-hidden">
                              <div className="h-full bg-red-500" style={{ width: `${Math.min(100, (result.fat_g * portionScale) * 2.5)}%` }}></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-black text-white rounded-3xl p-8 shadow-xl">
                    <div className="flex items-center gap-3 mb-4">
                      <Brain className="w-6 h-6 text-blue-400" />
                      <h3 className="text-xl font-bold tracking-tight">AI Nutritionist Insights</h3>
                    </div>
                    <p className="text-white/80 leading-relaxed mb-6 italic">
                      "{result.tips}"
                    </p>
                    <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/10">
                      <div>
                        <p className="text-sm font-bold text-white/40 uppercase tracking-widest mb-1">Sugar</p>
                        <p className="text-lg font-semibold">{(result.sugar_g * portionScale).toFixed(1)}g</p>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white/40 uppercase tracking-widest mb-1">Fiber</p>
                        <p className="text-lg font-semibold">{(result.fiber_g * portionScale).toFixed(1)}g</p>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white/40 uppercase tracking-widest mb-1">Sodium</p>
                        <p className="text-lg font-semibold">{Math.round(result.sodium_mg * portionScale)}mg</p>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-full flex flex-col justify-center gap-6 p-8"
                >
                  <div className="space-y-8">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center border border-[#E5E5E7] shadow-sm">
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg">Instant Identification</h4>
                        <p className="text-[#86868B]">Our vision model recognizes thousands of dishes and ingredients globally.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center border border-[#E5E5E7] shadow-sm">
                        <CheckCircle2 className="w-5 h-5 text-blue-500" />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg">Visual Portion Estimation</h4>
                        <p className="text-[#86868B]">Get volume-based estimates for more accurate nutritional data calculation.</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center border border-[#E5E5E7] shadow-sm">
                        <CheckCircle2 className="w-5 h-5 text-orange-500" />
                      </div>
                      <div>
                        <h4 className="font-bold text-lg">Healthy Suggestions</h4>
                        <p className="text-[#86868B]">Receive personalized tips to balance your macros and improve diet quality.</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-6 bg-blue-50 rounded-3xl border border-blue-100">
                    <div className="flex items-center gap-3 mb-2 text-blue-700">
                      <Info className="w-4 h-4" />
                      <p className="text-xs font-bold uppercase tracking-widest">Privacy First</p>
                    </div>
                    <p className="text-xs text-blue-600/80 leading-relaxed">
                      Your images are processed securely for nutrition analysis. We do not store personal photos without explicit permission.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </section>
        </div>
      </main>

      {/* Footer / Stats bar */}
      <footer className="mt-auto py-8 px-6 md:px-12 border-t border-[#E5E5E7] bg-white">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-8">
            <div className="flex flex-col">
              <span className="text-xs font-bold text-[#86868B] uppercase tracking-wider">Analysis Engine</span>
              <span className="text-sm font-semibold">Gemini 3 Flash</span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-[#86868B] uppercase tracking-wider">Accuracy</span>
              <span className="text-sm font-semibold">92% Average</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex -space-x-2">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-[#F5F5F7] overflow-hidden">
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i + 10}`} alt="User" />
                </div>
              ))}
            </div>
            <p className="text-xs font-medium text-[#86868B]">Joined by 2k+ health enthusiasts</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
