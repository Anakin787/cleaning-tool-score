import React, { useState, useMemo, useRef, useEffect } from 'react';
import { toPng } from 'html-to-image';
import { 
  User, 
  Download, 
  Upload,
  Users,
  ChevronRight,
  TrendingUp,
  ListOrdered,
  Info,
  Check
} from 'lucide-react';

const STORAGE_KEY = 'score-graph-evaluations';

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

  const getInitialData = () => {
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
  };

  const [allEvaluations, setAllEvaluations] = useState<Record<string, Record<string, number>>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.allEvaluations) return parsed.allEvaluations;
      }
    } catch {
      // 저장된 데이터가 깨진 경우 무시
    }
    return getInitialData();
  });

  const [currentScorer, setCurrentScorer] = useState('지운');
  const [axisLabel, setAxisLabel] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.axisLabel) return parsed.axisLabel;
      }
    } catch {
      // 무시
    }
    return '식 점수';
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ allEvaluations, axisLabel }));
    } catch {
      setToast({ message: '저장 공간이 부족합니다.', type: 'error' });
    }
  }, [allEvaluations, axisLabel]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(t);
  }, [toast]);
  const graphBlockRef = useRef<HTMLDivElement>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  };

  const saveGraphAsImage = async () => {
    if (!graphBlockRef.current) return;
    try {
      const dataUrl = await toPng(graphBlockRef.current, {
        backgroundColor: '#ffffff',
        pixelRatio: 2,
        cacheBust: true,
      });
      const link = document.createElement('a');
      link.download = `${currentScorer}_${axisLabel}_분포_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
      showToast('이미지가 저장되었습니다.');
    } catch (err) {
      console.error('이미지 저장 실패:', err);
      showToast('이미지 저장에 실패했습니다.', 'error');
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

  // 4번: 세로 칩 나열 - 가로 겹침 방지 (넓은 band로 그룹화 + 단일 항목 세로 스태거)
  const graphDisplayItems = useMemo(() => {
    const SCORE_BAND = 12; // 라벨 약 70px ≈ 12~15% → 가로 겹침 시 그룹화
    const STAGGER_THRESHOLD = 18; // 단일 항목이 이 거리 안이면 세로로 번갈아 배치
    const sorted = [...currentScores].sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));

    const groups: (typeof currentScores)[] = [];
    let currentGroup: (typeof currentScores)[0][] = [];

    for (const person of sorted) {
      const inRange = currentGroup.length > 0 && Math.abs(person.score - currentGroup[currentGroup.length - 1].score) <= SCORE_BAND;
      if (inRange) {
        currentGroup.push(person);
      } else {
        if (currentGroup.length > 0) groups.push(currentGroup);
        currentGroup = [person];
      }
    }
    if (currentGroup.length > 0) groups.push(currentGroup);

    let items = groups.map((members) => {
      const centerScore = members.reduce((s, p) => s + p.score, 0) / members.length;
      const centerX = Math.min(97, Math.max(3, centerScore));
      if (members.length === 1) {
        return { type: 'single' as const, person: members[0], centerX };
      }
      return { type: 'cluster' as const, centerX, members };
    });

    // 단일 항목끼리 가까우면 세로로 번갈아 배치 (스태거)
    const VERTICAL_OFFSET = 26;
    const singleIndices = items
      .map((item, idx) => (item.type === 'single' ? { idx, x: item.centerX, name: item.person.name } : null))
      .filter((x): x is NonNullable<typeof x> => x !== null);
    const yOffsets = new Map<number, number>();
    for (let i = 0; i < singleIndices.length; i++) {
      const { idx, x, name } = singleIndices[i];
      const nearby = singleIndices.filter((s) => Math.abs(s.x - x) < STAGGER_THRESHOLD).sort((a, b) => a.x - b.x);
      if (nearby.length < 2) continue;
      const myPos = nearby.findIndex((n) => n.name === name);
      if (myPos >= 0) yOffsets.set(idx, myPos % 2 === 0 ? VERTICAL_OFFSET : -VERTICAL_OFFSET);
    }
    items = items.map((item, idx) =>
      item.type === 'single' && yOffsets.has(idx) ? { ...item, yOffset: yOffsets.get(idx)! } : item
    );

    return items.sort((a, b) => {
      const xA = a.type === 'single' ? a.centerX : a.centerX;
      const xB = b.type === 'single' ? b.centerX : b.centerX;
      return xA - xB;
    });
  }, [currentScores]);

  const hasEvaluated = useMemo(() => {
    const result: Record<string, boolean> = {};
    participantsNames.forEach(name => {
      const evals = allEvaluations[name] || {};
      const sum = Object.values(evals).reduce((a, b) => a + b, 0);
      result[name] = sum > 0;
    });
    return result;
  }, [allEvaluations]);

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
    showToast('JSON 파일이 다운로드되었습니다.');
  };

  const importFromJson = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (json.allEvaluations) {
          if (Object.keys(allEvaluations).some(s => Object.values(allEvaluations[s] || {}).some(v => v > 0))) {
            if (!confirm('현재 데이터가 있습니다. 불러온 데이터로 덮어쓰시겠습니까?')) {
              event.target.value = '';
              return;
            }
          }
          setAllEvaluations(json.allEvaluations);
          if (json.axisLabel) setAxisLabel(json.axisLabel);
          showToast('파일을 성공적으로 불러왔습니다.');
        } else {
          throw new Error('올바르지 않은 데이터 형식입니다.');
        }
      } catch (error) {
        showToast('파일 불러오기 실패: ' + (error as Error).message, 'error');
      }
      event.target.value = ''; // 같은 파일 재선택 가능하도록 초기화
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900 relative">
      {toast && (
        <div 
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white ${
            toast.type === 'success' ? 'bg-emerald-600' : 'bg-red-500'
          }`}
        >
          {toast.message}
        </div>
      )}
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="bg-emerald-600 p-2 rounded-lg text-white">
                <Users size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800">16인 상호 평가 시스템</h1>
                <p className="text-slate-500 text-sm">지운님과 친구들이 서로를 어떻게 생각하는지 관리하세요. <span className="text-emerald-500/80">· 자동 저장</span></p>
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
                    <span className="flex items-center gap-2 min-w-0">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${currentScorer === name ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                      <span className="truncate">{name}</span>
                      {currentScorer === name && <span className="text-[10px] bg-emerald-100 px-1 rounded text-emerald-600 shrink-0">ME</span>}
                      {hasEvaluated[name] && (
                        <span title="평가 완료"><Check size={12} className="shrink-0 text-emerald-500" /></span>
                      )}
                    </span>
                    <ChevronRight size={14} className={`shrink-0 ${currentScorer === name ? 'opacity-100' : 'opacity-0'}`} />
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-emerald-900 text-white p-5 rounded-2xl shadow-lg relative overflow-hidden">
               <TrendingUp className="absolute -right-4 -bottom-4 w-24 h-24 opacity-10" />
               <h3 className="text-emerald-300 text-xs font-bold uppercase mb-2">현재 리더보드 (평균)</h3>
               <div className="space-y-2">
                 {Object.values(hasEvaluated).some(Boolean) ? (
                   averageScores.slice(0, 5).map((item, i) => (
                     <div key={item.name} className="flex justify-between items-center border-b border-white/10 pb-1">
                       <span className="text-sm font-bold">{i+1}. {item.name}</span>
                       <span className="text-xs font-mono bg-white/20 px-1.5 py-0.5 rounded">{item.score}점</span>
                     </div>
                   ))
                 ) : (
                   <p className="text-emerald-200/80 text-xs leading-relaxed">아직 평가가 없습니다.<br />왼쪽에서 평가자를 선택한 뒤<br />점수를 입력해 보세요.</p>
                 )}
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
                    placeholder="예: 식 점수"
                    className="text-[10px] bg-white border border-slate-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-emerald-500 w-24 placeholder:text-slate-300"
                    title="평가 기준 이름 (예: 식 점수, 매력도)"
                  />
                </div>
              </div>
              <div className="max-h-[600px] overflow-y-auto p-4 space-y-4">
                {currentScores.map((person) => (
                  <div key={person.name} className="group">
                    <div className="flex justify-between items-center mb-1 gap-2">
                      <span className="text-sm font-bold text-slate-700">{person.name}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <input 
                          type="number" 
                          min={0} max={100} 
                          value={person.score}
                          onChange={(e) => {
                            const v = parseInt(e.target.value, 10);
                            if (!isNaN(v)) updateScore(person.name, Math.min(100, Math.max(0, v)));
                          }}
                          onBlur={(e) => {
                            const v = parseInt(e.target.value, 10);
                            if (isNaN(v) || e.target.value === '') updateScore(person.name, 0);
                          }}
                          className="w-12 text-right text-xs font-mono font-bold text-emerald-600 border border-slate-200 rounded px-1.5 py-0.5 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                        <span className="text-xs text-slate-400">점</span>
                      </div>
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
            <div ref={graphBlockRef} className="bg-white p-6 rounded-3xl shadow-lg border border-slate-200 sticky top-8 overflow-hidden">
              <div className="flex items-center justify-between mb-6">
                <h3 className="flex-1 text-center font-bold text-slate-400 tracking-widest uppercase">
                  {currentScorer}의 {axisLabel} 분포
                </h3>
                <button
                  onClick={saveGraphAsImage}
                  className="shrink-0 p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-emerald-500 hover:text-emerald-600 transition-all"
                  title="이미지로 저장"
                  aria-label="그래프 이미지로 저장"
                >
                  <Download size={18} />
                </button>
              </div>
              
              <div className="relative h-56 pt-16 pb-2 mx-4 overflow-visible">
                <div className="absolute bottom-2 left-0 right-0 h-px bg-slate-100"></div>
                
                <div className="absolute inset-0 bottom-2">
                  {/* 라벨들: 단일/클러스터 스택 */}
                  {graphDisplayItems.map((item, idx) =>
                    item.type === 'single' ? (
                      <div
                        key={`label-${item.person.name}`}
                        className="absolute bottom-0 transition-all duration-500 ease-in-out group"
                        style={{ left: `${item.centerX ?? item.person.score}%`, zIndex: item.person.score }}
                      >
                        <div className="absolute bottom-full mb-3 flex flex-col items-center -translate-x-1/2" style={{ height: `${42 + ('yOffset' in item ? (item as { yOffset: number }).yOffset : 0)}px` }}>
                          <div className="bg-white px-2 py-1 rounded-lg shadow-md border border-slate-200 text-[10px] font-black whitespace-nowrap group-hover:border-emerald-500 transition-all flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: item.person.color }}></span>
                            {item.person.name}
                            <span className="text-slate-400 font-normal">{item.person.score}점</span>
                          </div>
                          <div className="w-0.5 flex-1 opacity-20" style={{ backgroundColor: item.person.color }}></div>
                        </div>
                      </div>
                    ) : (
                      <div
                        key={`cluster-${idx}-${item.members.map(m => m.name).join('-')}`}
                        className="absolute bottom-0 transition-all duration-500 ease-in-out group pointer-events-none"
                        style={{ left: `${item.centerX}%`, zIndex: Math.max(...item.members.map(m => m.score)) }}
                      >
                        <div className="absolute bottom-full mb-3 flex flex-col-reverse items-center gap-1 -translate-x-1/2">
                          {item.members.map((p) => (
                            <div
                              key={p.name}
                              className="bg-white px-2 py-1 rounded-lg shadow-md border border-slate-200 text-[10px] font-bold whitespace-nowrap group-hover:border-emerald-500 transition-all flex items-center gap-1.5 pointer-events-auto"
                            >
                              <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: p.color }}></span>
                              <span>{p.name}</span>
                              <span className="text-slate-400 font-normal text-[9px]">{p.score}점</span>
                            </div>
                          ))}
                          <div className="w-0.5 h-4 opacity-30 bg-slate-300 rounded-full" />
                        </div>
                      </div>
                    )
                  )}
                  {/* 점: 항상 정확한 점수 위치에 배치 */}
                  {currentScores.map((person) => (
                    <div
                      key={`dot-${person.name}`}
                      className="absolute bottom-0 w-2.5 h-2.5 -translate-x-1/2 translate-y-1.5 rounded-full border-2 border-white shadow-md transition-all duration-500 group-hover:scale-125"
                      style={{ left: `${person.score}%`, zIndex: person.score, backgroundColor: person.color }}
                    />
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
                    <strong>Tip</strong> 슬라이더나 숫자 칸으로 점수를 입력하면 그래프에 바로 반영됩니다. 
                    점이 겹쳐도 이름표가 알아서 위아래로 배치돼요.
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
