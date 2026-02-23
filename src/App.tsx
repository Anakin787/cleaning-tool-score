import React, { useState, useMemo, useRef } from 'react';
import html2canvas from 'html2canvas';
import { 
  User, 
  Download, 
  Upload,
  Users,
  ChevronRight,
  TrendingUp,
  ListOrdered,
  Info,
  Image
} from 'lucide-react';

const App = () => {
  const participantsNames = [
    '지운', '대성', '준호', '하운', '병주', '형진', '태욱', '승재', '현우', 
    '태현', '상혁', '승희', '가람', '효민', '웅', '준이형', '한을'
  ];

  const jiunInitialScores: Record<string, number> = {
    '대성': 100, '준호': 95, '하운': 90, '병주': 80, '형진': 70, 
    '태욱': 65, '승재': 40, '현우': 30, '태현': 0, '상혁': 0, 
    '승희': 0, '가람': 0, '효민': 0, '웅': 0, '준이형': 0, '한을': 0
  };

  const [allEvaluations, setAllEvaluations] = useState<Record<string, Record<string, number>>>(() => {
    const initialMatrix: Record<string, Record<string, number>> = {};
    participantsNames.forEach(scorer => {
      initialMatrix[scorer] = {};
      participantsNames.forEach(subject => {
        if (scorer === subject) return;
        if (scorer === '지운' && jiunInitialScores[subject] !== undefined) {
          initialMatrix[scorer][subject] = jiunInitialScores[subject];
        } else {
          initialMatrix[scorer][subject] = 0;
        }
      });
    });
    return initialMatrix;
  });

  const [currentScorer, setCurrentScorer] = useState('지운');
  const [axisLabel, setAxisLabel] = useState('식 점수');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const graphBlockRef = useRef<HTMLDivElement>(null);

  const saveGraphAsImage = async () => {
    if (!graphBlockRef.current) return;
    try {
      const canvas = await html2canvas(graphBlockRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
      });
      const link = document.createElement('a');
      link.download = `${currentScorer}_${axisLabel}_분포_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('이미지 저장 실패:', err);
      alert('이미지 저장에 실패했습니다.');
    }
  };

  const currentScores = useMemo(() => {
    const scores = allEvaluations[currentScorer] || {};
    return Object.entries(scores).map(([name, score], idx) => ({
      name,
      score,
      color: `hsl(${(idx * 360) / 16}, 70%, 50%)`
    }));
  }, [allEvaluations, currentScorer]);

  const averageScores = useMemo(() => {
    const totals: Record<string, number> = {};
    const counts: Record<string, number> = {};
    Object.entries(allEvaluations).forEach(([, evals]) => {
      const sumGiven = Object.values(evals).reduce((a, b) => a + b, 0);
      const hasEvaluated = sumGiven > 0; // 아직 입력 안 한 사람(전부 0) 제외
      Object.entries(evals).forEach(([name, score]) => {
        totals[name] = (totals[name] || 0) + score;
        if (hasEvaluated) counts[name] = (counts[name] || 0) + 1;
      });
    });
    return Object.entries(totals).map(([name, total]) => ({
      name,
      score: Math.round(total / (counts[name] || 1))
    })).sort((a, b) => b.score - a.score);
  }, [allEvaluations]);

  const updateScore = (subjectName: string, newScore: number) => {
    setAllEvaluations(prev => ({
      ...prev,
      [currentScorer]: {
        ...prev[currentScorer],
        [subjectName]: newScore
      }
    }));
  };

  const exportToJson = () => {
    const data = {
      axisLabel,
      allEvaluations,
      exportedAt: new Date().toISOString()
    };
    const jsonString = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ideal_type_matrix_${new Date().toLocaleDateString()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const importFromJson = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (json.allEvaluations) {
          setAllEvaluations(json.allEvaluations);
          if (json.axisLabel) setAxisLabel(json.axisLabel);
        } else {
          throw new Error('올바르지 않은 데이터 형식입니다.');
        }
      } catch (error) {
        alert('파일을 불러오는 중 오류가 발생했습니다: ' + (error as Error).message);
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="bg-emerald-600 p-2 rounded-lg text-white">
                <Users size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800">16인 상호 평가 시스템</h1>
                <p className="text-slate-500 text-sm">지운님과 친구들이 서로를 어떻게 생각하는지 관리하세요.</p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 flex items-center gap-2 shadow-sm"
            >
              <Upload size={16} /> 전체 불러오기
            </button>
            <input type="file" ref={fileInputRef} onChange={importFromJson} className="hidden" accept=".json" />
            <button 
              onClick={exportToJson}
              className="px-4 py-2 bg-slate-800 text-white rounded-lg text-sm font-semibold hover:bg-slate-700 flex items-center gap-2"
            >
              <Download size={16} /> 전체 내보내기 (JSON)
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <User size={14} /> 누가 평가하나요?
              </h2>
              <div className="space-y-1 overflow-y-auto max-h-[600px] pr-1">
                {participantsNames.map((name) => (
                  <button
                    key={name}
                    onClick={() => setCurrentScorer(name)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                      currentScorer === name 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 border shadow-sm font-bold' 
                      : 'hover:bg-slate-50 text-slate-600 border-transparent border'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${currentScorer === name ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                      {name} {currentScorer === name && <span className="text-[10px] bg-emerald-100 px-1 rounded text-emerald-600 ml-1">ME</span>}
                    </span>
                    <ChevronRight size={14} className={currentScorer === name ? 'opacity-100' : 'opacity-0'} />
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-emerald-900 text-white p-5 rounded-2xl shadow-lg relative overflow-hidden">
               <TrendingUp className="absolute -right-4 -bottom-4 w-24 h-24 opacity-10" />
               <h3 className="text-emerald-300 text-xs font-bold uppercase mb-2">현재 리더보드 (평균)</h3>
               <div className="space-y-2">
                 {averageScores.slice(0, 5).map((item, i) => (
                   <div key={item.name} className="flex justify-between items-center border-b border-white/10 pb-1">
                     <span className="text-sm font-bold">{i+1}. {item.name}</span>
                     <span className="text-xs font-mono bg-white/20 px-1.5 py-0.5 rounded">{item.score}점</span>
                   </div>
                 ))}
               </div>
            </div>
          </div>

          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
                <h2 className="font-bold text-slate-700">
                  <span className="text-emerald-600">{currentScorer}</span>님의 평가판
                </h2>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={axisLabel}
                    onChange={(e) => setAxisLabel(e.target.value)}
                    className="text-[10px] bg-white border border-slate-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-emerald-500 w-24"
                    title="기준 이름 변경"
                  />
                </div>
              </div>
              <div className="max-h-[600px] overflow-y-auto p-4 space-y-4">
                {currentScores.map((person) => (
                  <div key={person.name} className="group">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-bold text-slate-700">{person.name}</span>
                      <span className="text-xs font-mono font-bold text-emerald-600">{person.score}점</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" max="100" 
                      value={person.score}
                      onChange={(e) => updateScore(person.name, parseInt(e.target.value))}
                      className="w-full h-1.5 accent-emerald-500 bg-slate-100 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-5">
            <div ref={graphBlockRef} className="bg-white p-6 rounded-3xl shadow-lg border border-slate-200 sticky top-8">
              <div className="flex items-center justify-between mb-8">
                <h3 className="flex-1 text-center font-bold text-slate-400 tracking-widest uppercase">
                  {currentScorer}의 {axisLabel} 분포
                </h3>
                <button
                  onClick={saveGraphAsImage}
                  className="shrink-0 p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-emerald-500 hover:text-emerald-600 transition-all"
                  title="이미지로 저장"
                >
                  <Image size={18} />
                </button>
              </div>
              
              <div className="relative h-64 mt-10 mb-6 mx-4">
                <div className="absolute bottom-0 left-0 w-full h-1 bg-slate-100 rounded-full"></div>
                
                <div className="relative w-full h-full">
                  {currentScores.map((person, idx) => (
                    <div 
                      key={person.name}
                      className="absolute bottom-0 transition-all duration-500 ease-in-out group"
                      style={{ 
                        left: `${person.score}%`, 
                        zIndex: person.score 
                      }}
                    >
                      <div 
                        className="absolute bottom-full mb-2 flex flex-col items-center -translate-x-1/2"
                        style={{ height: `${30 + (idx % 6) * 32}px` }}
                      >
                        <div className="bg-white px-2 py-1 rounded shadow-md border border-slate-200 text-[10px] font-black whitespace-nowrap group-hover:scale-110 group-hover:border-emerald-500 transition-all">
                          {person.name}
                        </div>
                        <div 
                          className="w-0.5 flex-1 opacity-20 group-hover:opacity-60 transition-opacity" 
                          style={{ backgroundColor: person.color }}
                        ></div>
                      </div>
                      
                      <div 
                        className="w-4 h-4 rounded-full border-2 border-white shadow-md -translate-x-1/2 translate-y-1.5 transition-transform group-hover:scale-125"
                        style={{ backgroundColor: person.color }}
                      ></div>
                    </div>
                  ))}
                </div>

                <div className="absolute top-full mt-4 left-0 w-full flex justify-between text-[10px] font-mono text-slate-400 font-bold px-0">
                  <div className="flex flex-col items-center">
                    <div className="h-2 w-0.5 bg-slate-200 mb-1"></div>
                    <span>0</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="h-2 w-0.5 bg-slate-200 mb-1"></div>
                    <span>25</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="h-2 w-0.5 bg-slate-200 mb-1"></div>
                    <span>50</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="h-2 w-0.5 bg-slate-200 mb-1"></div>
                    <span>75</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="h-2 w-0.5 bg-slate-200 mb-1"></div>
                    <span>100</span>
                  </div>
                </div>
              </div>

              <div className="mt-16 space-y-4 pt-6 border-t border-slate-50">
                <div className="bg-slate-50 p-4 rounded-2xl">
                  <h4 className="text-xs font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
                    <ListOrdered size={14} /> 현재 평가자 기준 TOP 3
                  </h4>
                  <div className="grid grid-cols-3 gap-3">
                    {[...currentScores].sort((a,b) => b.score - a.score).slice(0, 3).map((p, i) => (
                      <div key={p.name} className="text-center p-2 bg-white rounded-xl shadow-sm border border-slate-100">
                        <div className="text-xs font-black text-emerald-600 mb-1">{i+1}위</div>
                        <div className="text-sm font-bold truncate">{p.name}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{p.score}점</div>
                      </div>
                    ))}
                </div>
              </div>

                <div className="flex items-start gap-2 text-slate-400 text-[10px] bg-emerald-50/50 p-3 rounded-xl border border-dashed border-emerald-200">
                  <Info size={14} className="shrink-0 text-emerald-500" />
                  <p className="text-emerald-800">
                    <strong>지운님!</strong> 그래프의 점이 0점부터 100점까지의 가로축상 위치에 정확히 오도록 수정했습니다. 
                    이름표는 점수가 겹치더라도 서로 잘 보이게끔 자동으로 높낮이가 조절됩니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
