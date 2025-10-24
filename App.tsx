import React, { useState, useCallback, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { CutInfo, AiModel, HistoryItem } from './types';
import { generateScenario } from './services/geminiService';
import { PlusIcon, TrashIcon, CopyIcon, CheckIcon, SparklesIcon, RefreshIcon, UploadIcon } from './components/icons';
import { useTranslation } from './i18n/LanguageContext';

interface ParsedScenario {
  meta_data: {
    title: string;
    theme: string;
    total_duration: number;
  };
  cuts: any[];
}

const App: React.FC = () => {
  const { language, setLanguage, t } = useTranslation();

  const getInitialCuts = (): CutInfo[] => ([
    { id: uuidv4(), duration: 0, description: "" },
  ]);

  const [projectTitle, setProjectTitle] = useState<string>("");
  const [mainTheme, setMainTheme] = useState<string>("");
  const [totalDuration, setTotalDuration] = useState<string>(""); // Changed to string to allow empty and fix 0 deletion
  const [cuts, setCuts] = useState<CutInfo[]>(getInitialCuts());
  const [model, setModel] = useState<AiModel>('gemini-2.5-flash');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [generatedJson, setGeneratedJson] = useState<string>("");
  const [parsedScenario, setParsedScenario] = useState<ParsedScenario | null>(null);
  const [error, setError] = useState<string>("");
  const [copiedCut, setCopiedCut] = useState<number | null>(null);
  const [isFullJsonCopied, setIsFullJsonCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'breakdown' | 'json'>('breakdown');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const outputRef = useRef<HTMLDivElement>(null);
  
  // Distribute total duration among cuts when total duration or number of cuts changes
  useEffect(() => {
    const numericTotalDuration = parseInt(totalDuration, 10) || 0;
    if (cuts.length === 0) return;

    const baseDuration = Math.floor(numericTotalDuration / cuts.length);
    const remainder = numericTotalDuration % cuts.length;

    const newCutsWithDurations = cuts.map((cut, index) => ({
        ...cut,
        duration: baseDuration + (index < remainder ? 1 : 0),
    }));
    
    const durationsChanged = cuts.some((cut, index) => cut.duration !== newCutsWithDurations[index].duration);

    if (durationsChanged) {
        setCuts(newCutsWithDurations);
    }
  }, [totalDuration, cuts.length]);

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

  const handleAddCut = () => {
    setCuts([...cuts, { id: uuidv4(), duration: 0, description: mainTheme }]);
  };

  const handleRemoveCut = (id: string) => {
    setCuts(cuts.filter(cut => cut.id !== id));
  };

  const handleCutChange = (id: string, field: 'description', value: string) => {
    setCuts(cuts.map(cut => cut.id === id ? { ...cut, [field]: value } : cut));
  };
  
  const handleReset = () => {
    setProjectTitle("");
    setMainTheme("");
    setTotalDuration("");
    setCuts(getInitialCuts());
    setModel('gemini-2.5-flash');
    setIsLoading(false);
    setGeneratedJson("");
    setParsedScenario(null);
    setError("");
    setCopiedCut(null);
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
    setIsFullJsonCopied(false);
    setActiveTab('breakdown');

    const numericTotalDuration = parseInt(totalDuration, 10) || 0;

    try {
      const result = await generateScenario({
        projectTitle,
        mainTheme,
        totalDuration: numericTotalDuration,
        cuts,
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
        mainTheme,
        totalDuration: numericTotalDuration,
        cuts,
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
  }, [projectTitle, mainTheme, totalDuration, cuts, model, language, t]);
  
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


  const handleLoadHistory = (id: string) => {
    const item = history.find(h => h.id === id);
    if (item) {
        setProjectTitle(item.projectTitle);
        setMainTheme(item.mainTheme);
        setTotalDuration(String(item.totalDuration)); // Convert number to string for state
        setCuts(item.cuts);
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
             <button onClick={() => setLanguage('en')} className={`px-3 py-1 text-sm font-medium rounded-md transition ${language === 'en' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}>EN</button>
             <button onClick={() => setLanguage('ko')} className={`px-3 py-1 text-sm font-medium rounded-md transition ${language === 'ko' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}>KO</button>
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
                                  <button onClick={() => handleLoadHistory(item.id)} className="flex-1 flex items-center justify-center gap-1.5 text-sm py-1 px-2 bg-indigo-600 hover:bg-indigo-700 rounded transition text-white">
                                      <UploadIcon className="w-4 h-4" />
                                      {t('loadButton')}
                                  </button>
                                  <button onClick={() => handleDeleteHistory(item.id)} className="p-2 text-gray-400 hover:text-red-500 transition rounded-md hover:bg-red-500/10">
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
                        <label htmlFor="mainTheme" className="block text-sm font-medium text-gray-300 mb-1">{t('mainBiblicalTheme')}</label>
                        <input type="text" id="mainTheme" value={mainTheme} onChange={(e) => setMainTheme(e.target.value)} disabled={isLoading} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition disabled:opacity-70" />
                      </div>
                      <div>
                        <label htmlFor="totalDuration" className="block text-sm font-medium text-gray-300 mb-1">{t('totalDuration')}</label>
                        <input type="number" id="totalDuration" value={totalDuration} onChange={(e) => setTotalDuration(e.target.value)} disabled={isLoading} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition disabled:opacity-70" />
                      </div>
                    </div>
                  </div>

                  {/* Cuts Section */}
                  <div>
                    <div className="flex justify-between items-center mb-4 border-b-2 border-indigo-500 pb-2">
                        <h2 className="text-2xl font-semibold">{t('sceneCuts')}</h2>
                    </div>
                    <div className="space-y-4">
                      {cuts.map((cut, index) => (
                        <div key={cut.id} className="bg-gray-700 p-4 rounded-lg border border-gray-600 relative">
                          <span className="absolute -top-2 -left-2 bg-indigo-500 text-white text-xs font-bold px-2 py-1 rounded-full">{index + 1}</span>
                          <div className="flex flex-col sm:flex-row gap-4">
                            <div className="flex-1">
                              <label htmlFor={`cut-desc-${cut.id}`} className="block text-sm font-medium text-gray-300 mb-1">{t('descriptionAndKeywords')}</label>
                               <div className="relative">
                                <textarea id={`cut-desc-${cut.id}`} value={cut.description} onChange={(e) => handleCutChange(cut.id, 'description', e.target.value)} rows={2} className="w-full bg-gray-600 border border-gray-500 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition disabled:bg-gray-700 disabled:opacity-70 disabled:cursor-wait" placeholder={t('cutPlaceholder')} disabled={isLoading}></textarea>
                               </div>
                            </div>
                            <div className="w-full sm:w-28">
                              <label htmlFor={`cut-dur-${cut.id}`} className="block text-sm font-medium text-gray-300 mb-1">{t('durationSeconds')}</label>
                              <input type="number" id={`cut-dur-${cut.id}`} value={cut.duration} readOnly className="w-full bg-gray-800 border border-gray-600 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition cursor-default" />
                            </div>
                            {cuts.length > 1 && (
                              <div className="flex items-end">
                                <button type="button" onClick={() => handleRemoveCut(cut.id)} disabled={isLoading} className="p-2 text-gray-400 hover:text-red-500 transition rounded-full hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed">
                                  <TrashIcon className="w-5 h-5"/>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                      <button type="button" onClick={handleAddCut} disabled={isLoading} className="w-full flex items-center justify-center gap-2 py-2 px-4 border-2 border-dashed border-gray-600 rounded-lg text-gray-400 hover:bg-gray-700 hover:border-gray-500 transition disabled:opacity-50 disabled:cursor-not-allowed">
                        <PlusIcon className="w-5 h-5"/> {t('addSceneCut')}
                      </button>
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
                  {parsedScenario && (
                     <button onClick={handleCopyFullJson} className={`flex items-center gap-1.5 py-1.5 px-3 rounded-md text-sm transition ${isFullJsonCopied ? 'bg-green-600 text-white' : 'bg-gray-600 hover:bg-gray-500 text-gray-200'}`}>
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
                {parsedScenario && parsedScenario.cuts && (
                  <>
                    <div className="flex border-b border-gray-700">
                      <button onClick={() => setActiveTab('breakdown')} className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${activeTab === 'breakdown' ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700/50'}`}>
                        {t('breakdownTab')}
                      </button>
                      <button onClick={() => setActiveTab('json')} className={`flex-1 py-2 px-4 text-sm font-medium transition-colors ${activeTab === 'json' ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700/50'}`}>
                        {t('rawJsonTab')}
                      </button>
                    </div>

                    <div className="p-2 space-y-2 overflow-y-auto flex-grow">
                      {activeTab === 'breakdown' && parsedScenario.cuts.map((cut, index) => (
                        <div key={index} className="bg-gray-800 rounded-lg border border-gray-700">
                            <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-t-lg">
                              <h4 className="font-bold text-indigo-300">{t('cutScenarioTitle', { cut_number: cut.cut_number })}</h4>
                              <button onClick={() => handleCopyCut(cut, cut.cut_number)} className={`flex items-center gap-1.5 py-1 px-3 rounded-md text-xs transition ${copiedCut === cut.cut_number ? 'bg-green-600 text-white' : 'bg-gray-600 hover:bg-gray-500 text-gray-200'}`}>
                                {copiedCut === cut.cut_number ? <CheckIcon className="w-4 h-4"/> : <CopyIcon className="w-4 h-4"/>}
                                {copiedCut === cut.cut_number ? t('cutCopiedButton') : t('copyCutButton')}
                              </button>
                            </div>
                            <div className="p-3 text-sm text-gray-300 space-y-2">
                              <p><strong className="font-medium text-gray-100">Visual Prompt:</strong> <span className="text-cyan-300 font-mono break-words whitespace-pre-wrap">{cut.visual_prompt}</span></p>
                              <p><strong className="font-medium text-gray-100">Narration Text:</strong> {cut.narration_text}</p>
                               <div className="grid grid-cols-2 gap-x-4 gap-y-1 pt-1 text-xs">
                                  <p><strong className="text-gray-400">Duration:</strong> {cut.duration}s</p>
                                  <p><strong className="text-gray-400">Shot Type:</strong> {cut.shot_type}</p>
                                  <p><strong className="text-gray-400">Camera:</strong> {cut.camera_movement}</p>
                                  <p><strong className="text-gray-400">Narration Tone:</strong> {cut.narration_tone}</p>
                                  <p><strong className="text-gray-400">BGM Cue:</strong> {cut.bgm_cue}</p>
                              </div>
                            </div>
                        </div>
                      ))}
                      {activeTab === 'json' && parsedScenario.cuts.map((cut, index) => (
                         <div key={index} className="bg-gray-800 rounded-lg border border-gray-700">
                           <div className="flex justify-between items-center p-3 bg-gray-700/50 rounded-t-lg">
                              <h4 className="font-bold text-indigo-300">{t('cutScenarioTitle', { cut_number: cut.cut_number })}</h4>
                              <button onClick={() => handleCopyCut(cut, cut.cut_number)} className={`flex items-center gap-1.5 py-1 px-3 rounded-md text-xs transition ${copiedCut === cut.cut_number ? 'bg-green-600 text-white' : 'bg-gray-600 hover:bg-gray-500 text-gray-200'}`}>
                                {copiedCut === cut.cut_number ? <CheckIcon className="w-4 h-4"/> : <CopyIcon className="w-4 h-4"/>}
                                {copiedCut === cut.cut_number ? t('cutCopiedButton') : t('copyCutJsonButton')}
                              </button>
                            </div>
                            <pre className="p-3 text-sm text-cyan-300 bg-gray-900 rounded-b-lg overflow-x-auto"><code>{JSON.stringify(cut, null, 2)}</code></pre>
                         </div>
                      ))}
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