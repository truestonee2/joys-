import React, { useState, useCallback, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { CutInfo, AiModel, HistoryItem } from './types';
import { generateScenario } from './services/geminiService';
import { PlusIcon, TrashIcon, CopyIcon, CheckIcon, SparklesIcon, RefreshIcon, UploadIcon } from './components/icons';
import { useTranslation } from './i18n/LanguageContext';

interface ParsedCut {
  cut_number: number;
  duration: number;
  scene_details: {
    shot_type: string;
    visual_prompt: string;
    camera_movement: string;
  };
  audio_details: {
    narration_text: string;
    narration_tone: string;
    bgm_cue: string;
  };
}

interface ParsedScenario {
  meta_data: {
    title: string;
    theme: string;
    total_duration: number;
  };
  cuts: ParsedCut[];
}

const App: React.FC = () => {
  const { language, setLanguage, t } = useTranslation();

  const [projectTitle, setProjectTitle] = useState<string>("");
  const [bibleVerse, setBibleVerse] = useState<string>("");
  const [totalDuration, setTotalDuration] = useState<string>("");
  const [cutDuration, setCutDuration] = useState<string>("");
  const [model, setModel] = useState<AiModel>('gemini-2.5-flash');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [generatedJson, setGeneratedJson] = useState<string>("");
  const [parsedScenario, setParsedScenario] = useState<ParsedScenario | null>(null);
  const [error, setError] = useState<string>("");
  const [copiedCut, setCopiedCut] = useState<number | null>(null);
  const [copiedJsonCut, setCopiedJsonCut] = useState<number | null>(null);
  const [isMetaCopied, setIsMetaCopied] = useState(false);
  const [isFullJsonCopied, setIsFullJsonCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'breakdown' | 'json'>('breakdown');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const outputRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    try {
        const savedHistory = localStorage.getItem('scenarioHistory');
        if (savedHistory) {
            setHistory(JSON.parse(savedHistory));
        }
    } catch (e) {
        console.error("Failed to parse history from localStorage", e);
        localStorage.removeItem('scenarioHistory');
    }
  }, []);

  const handleReset = () => {
    setProjectTitle("");
    setBibleVerse("");
    setTotalDuration("");
    setCutDuration("");
    setModel('gemini-2.5-flash');
    setIsLoading(false);
    setGeneratedJson("");
    setParsedScenario(null);
    setError("");
    setCopiedCut(null);
    setCopiedJsonCut(null);
    setIsMetaCopied(false);
    setIsFullJsonCopied(false);
    setActiveTab('breakdown');
  };

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setGeneratedJson("");
    setParsedScenario(null);
    setCopiedCut(null);
    setCopiedJsonCut(null);
    setIsMetaCopied(false);
    setIsFullJsonCopied(false);
    setActiveTab('breakdown');

    const numericTotalDuration = parseInt(totalDuration, 10) || 0;
    const numericCutDuration = parseInt(cutDuration, 10) || 0;

    if (numericTotalDuration <= 0 || numericCutDuration <= 0) {
        setError(t('durationError'));
        setIsLoading(false);
        return;
    }

    const numberOfCuts = Math.floor(numericTotalDuration / numericCutDuration);
    const remainder = numericTotalDuration % numericCutDuration;

    const generatedCuts: CutInfo[] = [];
    for (let i = 0; i < numberOfCuts; i++) {
        generatedCuts.push({ id: uuidv4(), duration: numericCutDuration, description: bibleVerse });
    }
    if (remainder > 0) {
        generatedCuts.push({ id: uuidv4(), duration: remainder, description: bibleVerse });
    }
    
    if (generatedCuts.length === 0) {
        setError(t('noCutsError'));
        setIsLoading(false);
        return;
    }

    try {
      const result = await generateScenario({
        projectTitle,
        bibleVerse,
        totalDuration: numericTotalDuration,
        cuts: generatedCuts,
        model,
        language,
      });

      setGeneratedJson(result);
      const parsed = JSON.parse(result);
      setParsedScenario(parsed);
      
      const newHistoryItem: HistoryItem = {
        id: uuidv4(),
        timestamp: Date.now(),
        projectTitle,
        mainTheme: bibleVerse,
        totalDuration: numericTotalDuration,
        cutDuration: numericCutDuration,
        model,
        language,
        generatedJson: result,
      };
      setHistory(prevHistory => {
        const newHistory = [newHistoryItem, ...prevHistory].sort((a,b) => b.timestamp - a.timestamp);
        localStorage.setItem('scenarioHistory', JSON.stringify(newHistory));
        return newHistory;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t('clientSideError'));
      console.error(err);
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        outputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [projectTitle, bibleVerse, totalDuration, cutDuration, model, language, t]);
  
  const handleCopyCut = (cutData: any, cutNumber: number) => {
      const jsonString = JSON.stringify(cutData, null, 2);
      navigator.clipboard.writeText(jsonString);
      setCopiedCut(cutNumber);
      setTimeout(() => setCopiedCut(null), 2000);
  };
  
  const handleCopyFullJson = () => {
    if (!generatedJson) return;
    navigator.clipboard.writeText(generatedJson);
    setIsFullJsonCopied(true);
    setTimeout(() => setIsFullJsonCopied(false), 2000);
  };
  
  const handleCopyCutJson = (cutData: any, cutNumber: number) => {
    const jsonString = JSON.stringify(cutData, null, 2);
    navigator.clipboard.writeText(jsonString);
    setCopiedJsonCut(cutNumber);
    setTimeout(() => setCopiedJsonCut(null), 2000);
  };

  const handleCopyMeta = () => {
    if (!parsedScenario) return;
    navigator.clipboard.writeText(JSON.stringify(parsedScenario.meta_data, null, 2));
    setIsMetaCopied(true);
    setTimeout(() => setIsMetaCopied(false), 2000);
  };


  const handleLoadHistory = (id: string) => {
    const item = history.find(h => h.id === id);
    if (item) {
        setProjectTitle(item.projectTitle);
        setBibleVerse(item.mainTheme);
        setTotalDuration(String(item.totalDuration));
        setCutDuration(String(item.cutDuration));
        setModel(item.model);
        setLanguage(item.language);
        setGeneratedJson(item.generatedJson);
        try {
            const parsed = JSON.parse(item.generatedJson);
            setParsedScenario(parsed);
        } catch {
            setParsedScenario(null);
        }
        setError("");
        setCopiedCut(null);
        setCopiedJsonCut(null);
        setIsMetaCopied(false);
        setIsFullJsonCopied(false);
        setActiveTab('breakdown');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleDeleteHistory = (id: string) => {
      setHistory(prevHistory => {
        const newHistory = prevHistory.filter(h => h.id !== id);
        localStorage.setItem('scenarioHistory', JSON.stringify(newHistory));
        return newHistory;
      });
  };

  const handleClearHistory = () => {
      if (window.confirm(t('confirmClearHistory'))) {
          setHistory([]);
          localStorage.setItem('scenarioHistory', '[]');
      }
  };


  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans p-4 sm:p-6 lg:p-8">
      <div className="max-w-screen-2xl mx-auto">
        <header className="text-center mb-8 relative">
          <h1 className="text-4xl sm:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-indigo-600">{t('headerTitle')}</h1>
          <p className="text-lg text-gray-400 mt-2">{t('headerSubtitle')}</p>
           <div className="absolute top-0 right-0 flex space-x-1 bg-gray-800 p-1 rounded-lg border border-gray-700">
             <button type="button" onClick={() => setLanguage('en')} className={`px-3 py-1 text-sm font-medium rounded-md transition ${language === 'en' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}>EN</button>
             <button type="button" onClick={() => setLanguage('ko')} className={`px-3 py-1 text-sm font-medium rounded-md transition ${language === 'ko' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}>KO</button>
          </div>
        </header>

        <main className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* History Section */}
          <div className="lg:col-span-3 bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-700 flex flex-col h-fit max-h-[calc(100vh-12rem)]">
              <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-semibold">
                      {t('historyTitle')}
                  </h2>
                  {history.length > 0 && (
                      <button 
                        type="button"
                        onClick={handleClearHistory} 
                        className="p-2 text-gray-400 hover:text-red-500 transition rounded-md hover:bg-red-500/10"
                        aria-label={t('clearHistoryButton')}
                        title={t('clearHistoryButton')}
                      >
                          <TrashIcon className="w-5 h-5" />
                      </button>
                  )}
              </div>
              <div className="flex-grow overflow-y-auto space-y-3 pr-2 -mr-2">
                  {history.length === 0 ? (
                      <div className="flex items-center justify-center h-full text-gray-500 text-center py-10">
                          <p>{t('noHistoryMessage')}</p>
                      </div>
                  ) : (
                      history.map(item => (
                          <div key={item.id} className="bg-gray-700 p-3 rounded-lg border border-gray-600 transition hover:bg-gray-600/50">
                              <p className="font-bold text-white truncate" title={item.projectTitle}>{item.projectTitle}</p>
                              <p className="text-xs text-gray-400 mb-2">
                                  {new Date(item.timestamp).toLocaleString(language === 'ko' ? 'ko-KR' : 'en-US')}
                              </p>
                              <div className="flex gap-2">
                                  <button type="button" onClick={() => handleLoadHistory(item.id)} className="flex-1 flex items-center justify-center gap-1.5 text-sm py-1 px-2 bg-indigo-600 hover:bg-indigo-700 rounded transition text-white">
                                      <UploadIcon className="w-4 h-4" />
                                      {t('loadButton')}
                                  </button>
                                  <button type="button" onClick={() => handleDeleteHistory(item.id)} className="p-2 text-gray-400 hover:text-red-500 transition rounded-md hover:bg-red-500/10">
                                      <TrashIcon className="w-4 h-4" />
                                  </button>
                              </div>
                          </div>
                      ))
                  )}
              </div>
          </div>
          
          {/* Main Content */}
          <div className="lg:col-span-9 grid grid-cols-1 xl:grid-cols-2 gap-8">
            {/* Input Form Section */}
            <div className="bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-700">
              <form onSubmit={handleSubmit}>
                <div className="space-y-6">
                  {/* Project Info */}
                  <div>
                    <h2 className="text-2xl font-semibold mb-4 border-b-2 border-indigo-500 pb-2">{t('projectDetails')}</h2>
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="projectTitle" className="block text-sm font-medium text-gray-300 mb-1">{t('projectTitle')}</label>
                        <input type="text" id="projectTitle" value={projectTitle} onChange={(e) => setProjectTitle(e.target.value)} disabled={isLoading} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition disabled:opacity-70" />
                      </div>
                      <div>
                        <label htmlFor="bibleVerse" className="block text-sm font-medium text-gray-300 mb-1">{t('bibleVerse')}</label>
                        <input type="text" id="bibleVerse" value={bibleVerse} onChange={(e) => setBibleVerse(e.target.value)} disabled={isLoading} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition disabled:opacity-70" />
                      </div>
                      <div>
                        <label htmlFor="totalDuration" className="block text-sm font-medium text-gray-300 mb-1">{t('totalDuration')}</label>
                        <input type="number" id="totalDuration" value={totalDuration} onChange={(e) => setTotalDuration(e.target.value)} disabled={isLoading} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition disabled:opacity-70" />
                      </div>
                       <div>
                        <label htmlFor="cutDuration" className="block text-sm font-medium text-gray-300 mb-1">{t('durationPerCut')}</label>
                        <input type="number" id="cutDuration" value={cutDuration} onChange={(e) => setCutDuration(e.target.value)} disabled={isLoading} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition disabled:opacity-70" />
                      </div>
                    </div>
                  </div>

                  {/* Model & Action */}
                  <div>
                      <h2 className="text-2xl font-semibold mb-4 border-b-2 border-indigo-500 pb-2">{t('configuration')}</h2>
                      <div>
                          <label htmlFor="model-select" className="block text-sm font-medium text-gray-300 mb-1">{t('aiModel')}</label>
                          <select id="model-select" value={model} onChange={(e) => setModel(e.target.value as AiModel)} disabled={isLoading} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition disabled:opacity-70">
                              <option value="gemini-2.5-flash">{t('modelFlash')}</option>
                              <option value="gemini-2.5-pro">{t('modelPro')}</option>
                          </select>
                      </div>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-4">
                      <button type="submit" disabled={isLoading} className="flex-grow w-full flex items-center justify-center gap-3 text-lg font-semibold py-3 px-6 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg shadow-lg hover:from-purple-700 hover:to-indigo-700 transition-transform transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed">
                        {isLoading ? (
                          <>
                            <div className="w-5 h-5 border-2 border-t-transparent border-white rounded-full animate-spin"></div>
                            {t('generatingButton')}
                          </>
                        ) : (
                          <>
                            <SparklesIcon className="w-6 h-6" />
                            {t('generateButton')}
                          </>
                        )}
                      </button>
                      <button type="button" onClick={handleReset} disabled={isLoading} className="flex items-center justify-center gap-2 py-3 px-4 bg-gray-700 text-gray-200 rounded-lg hover:bg-gray-600 transition disabled:opacity-50 disabled:cursor-not-allowed">
                          <RefreshIcon className="w-5 h-5" />
                          {t('resetButton')}
                      </button>
                  </div>
                </div>
              </form>
            </div>

            {/* Output Section */}
            <div ref={outputRef} className="bg-gray-800 p-6 rounded-2xl shadow-lg border border-gray-700 flex flex-col h-full">
              <div className="flex justify-between items-center mb-4">
                  <h2 className="text-2xl font-semibold">{t('outputTitle')}</h2>
                  {generatedJson && (
                     <button type="button" onClick={handleCopyFullJson} className={`flex items-center gap-1.5 py-1.5 px-3 rounded-md text-sm transition ${isFullJsonCopied ? 'bg-green-600 text-white' : 'bg-gray-600 hover:bg-gray-500 text-gray-200'}`}>
                        {isFullJsonCopied ? <CheckIcon className="w-4 h-4"/> : <CopyIcon className="w-4 h-4"/>}
                        {isFullJsonCopied ? t('copiedButton') : t('copyFullJsonButton')}
                      </button>
                  )}
              </div>
              <div className="flex-grow bg-gray-900 rounded-md overflow-hidden relative border border-gray-700 min-h-[400px] flex flex-col">
                {isLoading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/80 backdrop-blur-sm z-10">
                      <div className="w-10 h-10 border-4 border-t-transparent border-indigo-400 rounded-full animate-spin"></div>
                      <p className="mt-4 text-gray-300">{t('generatingMessage')}</p>
                  </div>
                )}
                {error && (
                  <div className="p-4 text-red-400 whitespace-pre-wrap">
                    <p className="font-bold">{t('errorOccurred')}</p>
                    <p>{error}</p>
                  </div>
                )}
                {!isLoading && !error && !parsedScenario && (
                  <div className="flex items-center justify-center h-full text-gray-500 p-4 text-center">
                    <p>{t('outputPlaceholder')}</p>
                  </div>
                )}
                {parsedScenario && (
                  <>
                    <div className="flex border-b border-gray-700">
                      <button type="button" onClick={() => setActiveTab('breakdown')} className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${activeTab === 'breakdown' ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700/50'}`}>
                        {t('breakdownTab')}
                      </button>
                      <button type="button" onClick={() => setActiveTab('json')} className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${activeTab === 'json' ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700/50'}`}>
                        {t('rawJsonTab')}
                      </button>
                    </div>

                    <div className="flex-grow overflow-y-auto">
                      {activeTab === 'breakdown' && (
                        <div className="p-2 space-y-2">
                          {parsedScenario.cuts.map((cut, index) => (
                            <div key={index} className="bg-gray-800 rounded-lg border border-gray-700">
                                <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-t-lg">
                                  <h4 className="font-bold text-indigo-300">{t('cutScenarioTitle', { cut_number: cut.cut_number })}</h4>
                                  <button type="button" onClick={() => handleCopyCut(cut, cut.cut_number)} className={`flex items-center gap-1.5 py-1 px-3 rounded-md text-xs transition ${copiedCut === cut.cut_number ? 'bg-green-600 text-white' : 'bg-gray-600 hover:bg-gray-500 text-gray-200'}`}>
                                    {copiedCut === cut.cut_number ? <CheckIcon className="w-4 h-4"/> : <CopyIcon className="w-4 h-4"/>}
                                    {copiedCut === cut.cut_number ? t('cutCopiedButton') : t('copyCutButton')}
                                  </button>
                                </div>
                                <div className="p-3 text-sm text-gray-300 space-y-2">
                                  <p><strong className="font-medium text-gray-100">Visual Prompt:</strong> <span className="text-cyan-300 font-mono break-words whitespace-pre-wrap">{cut.scene_details?.visual_prompt}</span></p>
                                  <p><strong className="font-medium text-gray-100">Narration Text:</strong> {cut.audio_details?.narration_text}</p>
                                   <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1 text-xs">
                                      <p><strong className="text-gray-400">Duration:</strong> {cut.duration}s</p>
                                      <p><strong className="text-gray-400">Shot Type:</strong> {cut.scene_details?.shot_type}</p>
                                      <p><strong className="text-gray-400">Camera:</strong> {cut.scene_details?.camera_movement}</p>
                                      <p><strong className="text-gray-400">Narration Tone:</strong> {cut.audio_details?.narration_tone}</p>
                                      <p><strong className="text-gray-400">BGM Cue:</strong> {cut.audio_details?.bgm_cue}</p>
                                  </div>
                                </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {activeTab === 'json' && (
                         <div className="p-2 space-y-2">
                            <div className="bg-gray-800 rounded-lg border border-gray-700">
                                <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-t-lg">
                                <h4 className="font-bold text-indigo-300">{t('metaDataTitle')}</h4>
                                <button type="button" onClick={handleCopyMeta} className={`flex items-center gap-1.5 py-1 px-3 rounded-md text-xs transition ${isMetaCopied ? 'bg-green-600 text-white' : 'bg-gray-600 hover:bg-gray-500 text-gray-200'}`}>
                                    {isMetaCopied ? <CheckIcon className="w-4 h-4"/> : <CopyIcon className="w-4 h-4"/>}
                                    {isMetaCopied ? t('copiedButton') : t('copyButton')}
                                </button>
                                </div>
                                <pre className="p-4 text-sm text-cyan-300 bg-transparent rounded-b-lg overflow-x-auto">
                                <code>{JSON.stringify(parsedScenario.meta_data, null, 2)}</code>
                                </pre>
                            </div>

                            {parsedScenario.cuts.map((cut, index) => (
                                <div key={index} className="bg-gray-800 rounded-lg border border-gray-700">
                                <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-t-lg">
                                    <h4 className="font-bold text-indigo-300">{t('cutScenarioTitle', { cut_number: cut.cut_number })} JSON</h4>
                                    <button type="button" onClick={() => handleCopyCutJson(cut, cut.cut_number)} className={`flex items-center gap-1.5 py-1 px-3 rounded-md text-xs transition ${copiedJsonCut === cut.cut_number ? 'bg-green-600 text-white' : 'bg-gray-600 hover:bg-gray-500 text-gray-200'}`}>
                                    {copiedJsonCut === cut.cut_number ? <CheckIcon className="w-4 h-4"/> : <CopyIcon className="w-4 h-4"/>}
                                    {copiedJsonCut === cut.cut_number ? t('cutCopiedButton') : t('copyCutJsonButton')}
                                    </button>
                                </div>
                                <pre className="p-4 text-sm text-cyan-300 bg-transparent rounded-b-lg overflow-x-auto">
                                    <code>{JSON.stringify(cut, null, 2)}</code>
                                </pre>
                                </div>
                            ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
