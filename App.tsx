import React, { useState, useRef, useEffect } from 'react';
import { Upload, Camera, Sparkles, Shirt, User, ArrowRight, RefreshCw, Wand2, History, Trash2, Download, Eye, Layers, ChevronLeft, ChevronRight, Maximize2 } from 'lucide-react';
import TiltCard from './components/TiltCard';
import FullscreenViewer from './components/FullscreenViewer';
import { generateImageAsset, generateBatchTryOn } from './services/geminiService';
import { ImageAsset, AppState, ViewAngle } from './types';

// Preset prompts for generation (mocking "presets")
const PRESET_FACE_PROMPTS = [
  "A professional full body studio shot of a beautiful young asian woman model, wearing simple neutral clothing, white background",
  "A cool asian street fashion male model, full body, standing pose, neutral background",
];

const PRESET_CLOTHES_PROMPTS = [
  "A trendy oversized beige trench coat, fashion photography, white background, ghost mannequin style",
  "A red floral summer dress, elegant style, white background, flat lay",
];

const VIEW_ANGLES: { id: ViewAngle; label: string }[] = [
  { id: 'front', label: '正视图' },
  { id: 'left45', label: '左侧45°' },
  { id: 'right45', label: '右侧45°' },
  { id: 'left90', label: '左侧90°' },
  { id: 'right90', label: '右侧90°' },
  { id: 'back', label: '背视图' },
];

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    selectedPerson: null,
    selectedGarment: null,
    tryOnResults: null,
    isGenerating: false,
    step: 1,
    viewAngle: 'front'
  });
  
  const [gallery, setGallery] = useState<ImageAsset[]>([]);
  const [clothesPrompt, setClothesPrompt] = useState("");
  const [isLoadingPreset, setIsLoadingPreset] = useState(false);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // --- Handlers ---

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'person' | 'garment') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const asset: ImageAsset = {
        id: Date.now().toString(),
        url: reader.result as string,
        type
      };
      if (type === 'person') setState(s => ({ ...s, selectedPerson: asset }));
      else setState(s => ({ ...s, selectedGarment: asset }));
    };
    reader.readAsDataURL(file);
  };

  const handleGeneratePreset = async (type: 'person' | 'garment') => {
    setIsLoadingPreset(true);
    try {
      const prompt = type === 'person' 
        ? PRESET_FACE_PROMPTS[Math.floor(Math.random() * PRESET_FACE_PROMPTS.length)]
        : (clothesPrompt || PRESET_CLOTHES_PROMPTS[Math.floor(Math.random() * PRESET_CLOTHES_PROMPTS.length)]);
      
      const base64 = await generateImageAsset(prompt);
      const asset: ImageAsset = {
        id: Date.now().toString(),
        url: base64,
        type,
        prompt
      };

      if (type === 'person') setState(s => ({ ...s, selectedPerson: asset }));
      else setState(s => ({ ...s, selectedGarment: asset }));
    } catch (err) {
      alert("生成失败，请重试");
    } finally {
      setIsLoadingPreset(false);
      // Don't clear clothes prompt immediately so we can use it for try-on context
    }
  };

  const handleTryOn = async () => {
    if (!state.selectedPerson || !state.selectedGarment) return;
    
    setState(s => ({ ...s, isGenerating: true, step: 3 }));
    try {
      // Generate all angles at once
      const angles = VIEW_ANGLES.map(v => v.id);
      
      // Use the prompt if available, or a generic context
      const context = clothesPrompt || state.selectedGarment.prompt || "";

      const resultsMap = await generateBatchTryOn(
        state.selectedPerson.url, 
        state.selectedGarment.url,
        angles,
        context
      );

      const newResults: Record<ViewAngle, ImageAsset> = {} as any;
      const galleryAdditions: ImageAsset[] = [];

      angles.forEach(angle => {
        const asset: ImageAsset = {
            id: `${Date.now()}-${angle}`,
            url: resultsMap[angle],
            type: 'result'
        };
        newResults[angle] = asset;
        if (angle === 'front') galleryAdditions.push(asset);
      });
      
      setState(s => ({ 
          ...s, 
          tryOnResults: newResults, 
          isGenerating: false,
          viewAngle: 'front' // Default view
      }));
      setGallery(prev => [...galleryAdditions, ...prev]);

    } catch (err) {
      console.error(err);
      alert("试穿生成失败，请稍后重试");
      setState(s => ({ ...s, isGenerating: false }));
    }
  };

  const reset = () => {
    setState({
        selectedPerson: null,
        selectedGarment: null,
        tryOnResults: null,
        isGenerating: false,
        step: 1,
        viewAngle: 'front'
    });
  };

  const scrollAngles = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
        const scrollAmount = 80; // approximate width of one item + gap
        scrollContainerRef.current.scrollBy({
            left: direction === 'left' ? -scrollAmount : scrollAmount,
            behavior: 'smooth'
        });
    }
  };

  const openFullscreen = (e: React.MouseEvent, url: string) => {
    e.stopPropagation(); // Prevent card click
    setFullscreenImage(url);
  };

  // Determine if we are currently viewing the result set in fullscreen
  const isViewingResults = state.tryOnResults && fullscreenImage && Object.values(state.tryOnResults).some(asset => asset.url === fullscreenImage);

  const handleFullscreenNav = (direction: 'left' | 'right') => {
    if (!isViewingResults || !state.tryOnResults) return;

    // Find current index based on fullscreenImage
    const currentIndex = VIEW_ANGLES.findIndex(angle => state.tryOnResults![angle.id].url === fullscreenImage);
    if (currentIndex === -1) return;

    let nextIndex;
    if (direction === 'left') {
        nextIndex = (currentIndex - 1 + VIEW_ANGLES.length) % VIEW_ANGLES.length;
    } else {
        nextIndex = (currentIndex + 1) % VIEW_ANGLES.length;
    }

    const nextAngleId = VIEW_ANGLES[nextIndex].id;
    const nextUrl = state.tryOnResults[nextAngleId].url;

    // Update both App State (for background UI sync) and Fullscreen Image
    setState(s => ({ ...s, viewAngle: nextAngleId }));
    setFullscreenImage(nextUrl);
  };

  const currentResultImage = state.tryOnResults ? state.tryOnResults[state.viewAngle] : null;

  // --- Render Helpers ---

  const renderPlaceholder = (icon: React.ReactNode, text: string) => (
    <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-4">
        <div className="p-4 rounded-full bg-slate-800/50 border border-slate-700/50">
            {icon}
        </div>
        <p className="text-sm font-medium">{text}</p>
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-slate-950 font-sans text-slate-200">
      
      <FullscreenViewer 
        isOpen={!!fullscreenImage}
        imageUrl={fullscreenImage}
        onClose={() => setFullscreenImage(null)}
        onNext={isViewingResults ? () => handleFullscreenNav('right') : undefined}
        onPrev={isViewingResults ? () => handleFullscreenNav('left') : undefined}
      />

      {/* Header */}
      <header className="h-20 px-8 flex items-center justify-between border-b border-slate-900 bg-slate-950/80 backdrop-blur-md z-40">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Sparkles className="text-white w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
                AI 虚拟试衣镜
            </h1>
        </div>
        <div className="flex gap-4">
             <button onClick={reset} className="flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 hover:bg-slate-800 border border-slate-800 transition-all text-sm">
                <RefreshCw size={14} /> 重置
             </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-hidden relative flex flex-col">
        
        {/* Top Cards Section */}
        <div className="flex-1 flex items-center justify-center gap-8 px-8 py-4 overflow-x-auto overflow-y-hidden">
            
            {/* CARD 1: MODEL */}
            <TiltCard 
                stepNumber="01" 
                title="选择模特" 
                isActive={state.step === 1}
                onClick={() => setState(s => ({...s, step: 1}))}
                className="w-[350px] shrink-0"
            >
                {state.selectedPerson ? (
                    <div className="relative w-full h-full group cursor-pointer" onClick={(e) => openFullscreen(e, state.selectedPerson!.url)}>
                         <img src={state.selectedPerson.url} alt="Model" className="w-full h-full object-cover" />
                         
                         {/* Controls Overlay */}
                         <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-4">
                             <div className="flex gap-3">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setState(s => ({...s, selectedPerson: null})); }} 
                                    className="bg-red-500/80 text-white px-4 py-2 rounded-full backdrop-blur hover:bg-red-500 transition-colors flex items-center gap-2"
                                >
                                    <Trash2 size={16} /> 移除
                                </button>
                                <a 
                                   href={state.selectedPerson.url} 
                                   download="model-image.png"
                                   onClick={(e) => e.stopPropagation()}
                                   className="bg-slate-700/80 text-white px-4 py-2 rounded-full backdrop-blur hover:bg-slate-600 transition-colors flex items-center gap-2"
                                 >
                                    <Download size={16} /> 下载
                                 </a>
                             </div>
                             <div className="text-white/80 text-sm flex items-center gap-1">
                                <Maximize2 size={14} /> 点击全屏
                             </div>
                         </div>
                         
                         <div className="absolute bottom-4 left-4 right-4 text-xs bg-black/50 backdrop-blur p-2 rounded text-center text-white/80 pointer-events-none">
                             {state.selectedPerson.prompt ? "AI 生成模特 (亚洲面孔)" : "用户上传图片"}
                         </div>
                    </div>
                ) : (
                    <div className="flex flex-col h-full p-6 pt-20">
                        {isLoadingPreset && state.step === 1 && !state.selectedPerson ? (
                             <div className="flex-1 flex flex-col items-center justify-center animate-pulse">
                                 <Wand2 className="w-10 h-10 text-indigo-500 mb-4 animate-spin" />
                                 <p className="text-indigo-400">正在生成模特...</p>
                             </div>
                        ) : (
                            <div className="flex flex-col gap-4 mt-auto">
                                {renderPlaceholder(<User size={32} />, "请选择或生成一位模特")}
                                <div className="space-y-3 mt-8">
                                    <label className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 cursor-pointer transition-all border border-slate-700 hover:border-indigo-500/50">
                                        <Upload size={16} />
                                        <span className="text-sm">上传照片</span>
                                        <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'person')} />
                                    </label>
                                    <button 
                                        onClick={() => handleGeneratePreset('person')}
                                        className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 transition-all text-white shadow-lg shadow-indigo-900/20"
                                    >
                                        <Wand2 size={16} />
                                        <span className="text-sm">AI 生成亚洲模特</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </TiltCard>

            {/* Arrow */}
            <div className="text-slate-700">
                <ArrowRight size={32} className={`transition-all duration-500 ${state.selectedPerson ? 'text-indigo-500 opacity-100' : 'opacity-20'}`} />
            </div>

            {/* CARD 2: GARMENT */}
            <TiltCard 
                stepNumber="02" 
                title="挑选服装" 
                isActive={state.step === 2}
                onClick={() => state.selectedPerson && setState(s => ({...s, step: 2}))}
                className={`w-[350px] shrink-0 ${!state.selectedPerson ? 'opacity-50 pointer-events-none grayscale' : ''}`}
            >
               {state.selectedGarment ? (
                    <div className="relative w-full h-full group cursor-pointer" onClick={(e) => openFullscreen(e, state.selectedGarment!.url)}>
                         <img src={state.selectedGarment.url} alt="Garment" className="w-full h-full object-cover" />
                         <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-4">
                             <div className="flex gap-3">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setState(s => ({...s, selectedGarment: null})); }}
                                    className="bg-red-500/80 text-white px-4 py-2 rounded-full backdrop-blur hover:bg-red-500 transition-colors flex items-center gap-2"
                                >
                                    <Trash2 size={16} /> 移除
                                </button>
                                <a 
                                   href={state.selectedGarment.url} 
                                   download="garment-image.png"
                                   onClick={(e) => e.stopPropagation()}
                                   className="bg-slate-700/80 text-white px-4 py-2 rounded-full backdrop-blur hover:bg-slate-600 transition-colors flex items-center gap-2"
                                 >
                                    <Download size={16} /> 下载
                                 </a>
                             </div>
                             <div className="text-white/80 text-sm flex items-center gap-1">
                                <Maximize2 size={14} /> 点击全屏
                             </div>
                         </div>
                    </div>
                ) : (
                    <div className="flex flex-col h-full p-6 pt-20">
                         {isLoadingPreset && state.step === 2 && !state.selectedGarment ? (
                             <div className="flex-1 flex flex-col items-center justify-center animate-pulse">
                                 <Shirt className="w-10 h-10 text-indigo-500 mb-4 animate-bounce" />
                                 <p className="text-indigo-400">正在设计服装...</p>
                             </div>
                        ) : (
                            <div className="flex flex-col gap-4 mt-auto">
                                {renderPlaceholder(<Shirt size={32} />, "上传或生成服装")}
                                <div className="mt-4">
                                     <input 
                                        type="text" 
                                        value={clothesPrompt}
                                        onChange={(e) => setClothesPrompt(e.target.value)}
                                        placeholder="描述你想穿的衣服 (例如: 红色长裙)"
                                        className="w-full bg-slate-950/50 border border-slate-700 rounded-lg px-3 py-2 text-xs mb-3 focus:outline-none focus:border-indigo-500"
                                     />
                                     <div className="grid grid-cols-2 gap-3">
                                        <label className="flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 cursor-pointer transition-all border border-slate-700">
                                            <Upload size={16} />
                                            <span className="text-xs">上传</span>
                                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'garment')} />
                                        </label>
                                        <button 
                                            onClick={() => handleGeneratePreset('garment')}
                                            className="flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 transition-all text-white"
                                        >
                                            <Wand2 size={16} />
                                            <span className="text-xs">生成</span>
                                        </button>
                                     </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </TiltCard>

            {/* Arrow */}
            <div className="text-slate-700">
                <ArrowRight size={32} className={`transition-all duration-500 ${state.selectedGarment ? 'text-indigo-500 opacity-100' : 'opacity-20'}`} />
            </div>

            {/* CARD 3: RESULT */}
            <TiltCard 
                stepNumber="03" 
                title="试穿效果" 
                isActive={state.step === 3}
                className={`w-[350px] shrink-0 ${!state.selectedGarment ? 'opacity-50 pointer-events-none grayscale' : ''}`}
            >
                {currentResultImage ? (
                    <div className="relative w-full h-full flex flex-col">
                        <div 
                            className="flex-1 relative overflow-hidden group cursor-pointer"
                            onClick={(e) => openFullscreen(e, currentResultImage.url)}
                        >
                             <img src={currentResultImage.url} alt="Result" className="w-full h-full object-cover transition-all duration-300" />
                             
                             {/* Hover Overlay with Save Button */}
                             <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-4">
                                <div className="flex gap-3">
                                    <a 
                                       href={currentResultImage.url} 
                                       download={`try-on-${state.viewAngle}.png`}
                                       onClick={(e) => e.stopPropagation()}
                                       className="bg-white/20 backdrop-blur text-white px-4 py-2 rounded-full font-bold hover:bg-white/40 transition-colors flex items-center gap-2"
                                     >
                                        <Download size={18} /> 下载
                                     </a>
                                </div>
                                <div className="text-white/80 text-sm flex items-center gap-1">
                                    <Maximize2 size={14} /> 点击全屏
                                </div>
                             </div>

                             {/* Redo Button (Top Right) */}
                             <button 
                                onClick={(e) => { e.stopPropagation(); setState(s => ({...s, tryOnResults: null})); }}
                                className="absolute top-2 right-2 p-2 bg-black/50 hover:bg-black/70 rounded-full text-white backdrop-blur transition-all pointer-events-auto z-10"
                                title="重新试穿"
                             >
                                <RefreshCw size={16} />
                             </button>
                        </div>

                        {/* View Angle Switcher at Bottom */}
                        <div className="h-[90px] bg-slate-900 border-t border-slate-800 relative">
                            {/* Scroll Button Left */}
                            <button 
                                onClick={() => scrollAngles('left')}
                                className="absolute left-0 top-0 bottom-0 z-10 w-8 bg-gradient-to-r from-slate-900 to-transparent flex items-center justify-center text-white hover:text-indigo-400"
                            >
                                <ChevronLeft size={20} />
                            </button>

                            {/* Scrollable List */}
                            <div 
                                ref={scrollContainerRef}
                                className="h-full overflow-x-auto scrollbar-hide flex items-center gap-2 px-8"
                            >
                                {VIEW_ANGLES.map((angle) => {
                                    const isSelected = state.viewAngle === angle.id;
                                    const resultForAngle = state.tryOnResults?.[angle.id];
                                    
                                    return (
                                        <button
                                            key={angle.id}
                                            onClick={() => setState(s => ({...s, viewAngle: angle.id}))}
                                            className={`
                                                flex flex-col items-center justify-center shrink-0 w-[60px] h-[70px] rounded-lg border transition-all
                                                ${isSelected 
                                                    ? 'bg-indigo-900/50 border-indigo-500 text-white' 
                                                    : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-750'}
                                            `}
                                        >
                                            {/* Thumbnail (Miniature) or Icon */}
                                            {resultForAngle ? (
                                                <div className="w-8 h-8 rounded mb-1 overflow-hidden bg-slate-950">
                                                    <img src={resultForAngle.url} className="w-full h-full object-cover" alt={angle.label} />
                                                </div>
                                            ) : (
                                                <Layers size={16} className="mb-1 opacity-50" />
                                            )}
                                            <span className="text-[10px] scale-90 whitespace-nowrap">{angle.label}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Scroll Button Right */}
                            <button 
                                onClick={() => scrollAngles('right')}
                                className="absolute right-0 top-0 bottom-0 z-10 w-8 bg-gradient-to-l from-slate-900 to-transparent flex items-center justify-center text-white hover:text-indigo-400"
                            >
                                <ChevronRight size={20} />
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col h-full items-center justify-center p-6 text-center">
                        {state.isGenerating ? (
                            <div>
                                <div className="relative w-20 h-20 mx-auto mb-6">
                                    <div className="absolute inset-0 border-4 border-slate-800 rounded-full"></div>
                                    <div className="absolute inset-0 border-4 border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
                                    <Sparkles className="absolute inset-0 m-auto text-indigo-400 animate-pulse" />
                                </div>
                                <h3 className="text-lg font-medium text-white mb-2">正在全方位生成中...</h3>
                                <p className="text-slate-400 text-sm">正在并行计算 6 个不同视角</p>
                            </div>
                        ) : (
                            <>
                                {renderPlaceholder(<Eye size={32} />, "准备试穿")}
                                <div className="mt-8 w-full">
                                    <p className="text-xs text-slate-500 mb-4 px-4">
                                        点击开始后，AI 将一次性为您生成 正面、侧面、背面 等全套展示图，并自动匹配场景。
                                    </p>
                                    <button 
                                        onClick={handleTryOn}
                                        disabled={!state.selectedPerson || !state.selectedGarment}
                                        className="group relative w-full px-8 py-4 bg-white text-slate-950 rounded-2xl font-bold text-lg hover:scale-105 transition-all shadow-[0_0_40px_rgba(255,255,255,0.3)] disabled:opacity-50 disabled:hover:scale-100 disabled:shadow-none"
                                    >
                                        <span className="flex items-center justify-center gap-2">
                                            <Sparkles className="group-hover:rotate-12 transition-transform" />
                                            一键全览试穿
                                        </span>
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                )}
            </TiltCard>
        </div>

        {/* Bottom Gallery */}
        <div className="h-40 bg-slate-900 border-t border-slate-800 p-4">
             <div className="flex items-center gap-2 mb-3 text-slate-400 text-sm font-medium uppercase tracking-wider px-2">
                <History size={14} />
                历史记录
             </div>
             <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide h-full items-center">
                {gallery.length === 0 && (
                    <div className="text-slate-600 text-xs italic px-4">生成的图片将显示在这里...</div>
                )}
                {gallery.map((img) => (
                    <div key={img.id} className="h-24 w-24 shrink-0 rounded-lg overflow-hidden border border-slate-700 hover:border-indigo-500 cursor-pointer transition-all hover:scale-105 relative group" onClick={() => setFullscreenImage(img.url)}>
                        <img src={img.url} className="w-full h-full object-cover" alt="History" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                             <a 
                                href={img.url} 
                                download={`history-${img.id}.png`} 
                                className="text-white hover:text-indigo-400"
                                onClick={(e) => e.stopPropagation()}
                             >
                                <Download size={16} />
                             </a>
                             <Maximize2 size={16} className="text-white hover:text-indigo-400" />
                        </div>
                    </div>
                ))}
             </div>
        </div>
      </main>
    </div>
  );
};

export default App;