import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Brain, 
  Sparkles, 
  Copy, 
  Check, 
  Send, 
  BookOpen, 
  FileText, 
  HelpCircle, 
  UserCheck, 
  Loader2, 
  Cpu, 
  GraduationCap
} from 'lucide-react';
import { Student, Teacher } from '../types';
import { getHeaders } from '../supabaseClient';

interface TeacherAIProps {
  students: Student[];
  teachers: Teacher[];
}

export default function TeacherAI({ students, teachers }: TeacherAIProps) {
  const [selectedType, setSelectedType] = useState<'summary' | 'quiz' | 'study_plan'>('summary');
  const [selectedEngine, setSelectedEngine] = useState<'openai' | 'claude' | 'gemini'>('gemini');
  const [topic, setTopic] = useState<string>('');
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium');
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [promptAddon, setPromptAddon] = useState<string>('');
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [generatedOutput, setGeneratedOutput] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);

  // Suggested quick topics based on selection type
  const promptSuggestions = {
    summary: [
      'Introdução à Termodinâmica e Transferência de Calor',
      'A Revolução Liberal de 1820 em Portugal',
      'Sintaxe e Estrutura de Orações Complexas',
      'Fotossíntese e Respiração Celular de Plantas C3'
    ],
    quiz: [
      'Álgebra Linear elementar e Sistemas de Equações',
      'Vocabulário Avançado de Inglês C1',
      'Geometria Analítica no R3 plano',
      'Estruturas Geológicas de Portugal Continental'
    ],
    study_plan: [
      'Reforço Intensivo de Álgebra',
      'Melhoria Curricular em Ciências Físico-Química',
      'Apoio à Escrita e Interpretação Escrita',
      'Plano de Preparação para Exames Finais'
    ]
  };

  const selectedStudent = students.find(s => s.id === selectedStudentId);

  const handleCopy = () => {
    if (!generatedOutput) return;
    navigator.clipboard.writeText(generatedOutput);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleGenerate = async () => {
    if (!topic.trim()) return;

    setIsLoading(true);
    setGeneratedOutput('');

    try {
      const response = await fetch('/api/teacher-ai', {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({
          type: selectedType,
          engine: selectedEngine,
          topic: topic,
          difficulty: difficulty,
          studentData: selectedStudent ? {
            name: selectedStudent.name,
            class: selectedStudent.class,
            averageGrade: selectedStudent.averageGrade,
            attendanceRate: selectedStudent.attendanceRate,
            behavior: selectedStudent.behaviorDegree,
            grades: selectedStudent.grades
          } : null,
          promptAddon: promptAddon
        })
      });

      const data = await response.json();
      if (data.error) {
        setGeneratedOutput(`**Erro na Geração:** ${data.error}\n\n${data.details || ''}`);
      } else {
        setGeneratedOutput(data.result);
      }
    } catch (err: any) {
      console.error(err);
      setGeneratedOutput(`**Incidência Escolar:** Não foi possível contactar o servidor analítico.\n\nDetalhes: ${err.message || 'Erro de rede'}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div id="teacher_ai_module" className="space-y-8">
      {/* Header */}
      <section className="flex flex-col md:flex-row justify-between border-b border-white/5 pb-6 gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold tracking-[0.2em] text-indigo-400 uppercase font-mono">Academic Core Integration</span>
            <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]"></span>
          </div>
          <h1 className="text-4xl font-bold font-display tracking-tight mt-1 text-white">Consola de IA Pedagógica</h1>
          <p className="text-xs text-zinc-450 mt-1.5 font-mono">
            Geração hiper-personalizada de recursos, questionários e planos de estudo sob os motores líderes OpenAI, Claude e Gemini.
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Painel de Controlo / Inputs */}
        <div className="lg:col-span-5 bg-[#111111] border border-white/5 rounded-2xl p-6 h-fit space-y-6">
          <div className="flex items-center gap-2.5 pb-4 border-b border-white/5">
            <Brain className="w-5 h-5 text-indigo-400" />
            <h2 className="text-sm font-bold tracking-[0.05em] uppercase font-mono text-white">Configurações Didáticas</h2>
          </div>

          {/* AI Engines selection with branding details */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold tracking-widest text-white/40 uppercase font-mono block">Motor Inteligente (AI Model)</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'openai', name: 'OpenAI GPT-4', color: 'text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10' },
                { id: 'claude', name: 'Claude 3.5', color: 'text-orange-400 bg-orange-500/5 hover:bg-orange-500/10' },
                { id: 'gemini', name: 'Gemini 3.5', color: 'text-indigo-400 bg-indigo-500/5 hover:bg-indigo-500/10' }
              ].map(engine => {
                const isActive = selectedEngine === engine.id;
                return (
                  <button
                    key={engine.id}
                    onClick={() => setSelectedEngine(engine.id as any)}
                    className={`p-3 rounded-xl border text-[11px] font-semibold text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                      isActive 
                        ? 'border-indigo-500 bg-indigo-500/10 text-white shadow-lg' 
                        : 'border-white/5 text-zinc-405'
                    }`}
                  >
                    <Cpu className={`w-3.5 h-3.5 ${isActive ? 'text-indigo-400' : 'text-zinc-500'}`} />
                    <span className="font-mono text-[10px] leading-none">{engine.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Formatos de Geração */}
          <div className="space-y-2">
            <label className="text-[10px] font-bold tracking-widest text-white/40 uppercase font-mono block">Formato Pedagógico</label>
            <div className="grid grid-cols-1 gap-2">
              {[
                { id: 'summary', title: 'Resumo Científico da Aula', desc: 'Sintetiza tópicos, metodologias e glossários escolares essenciais.', icon: FileText },
                { id: 'quiz', title: 'Quiz com Perguntas Interativas', desc: 'Produz testes de múltipla escolha com gabaritos detalhados.', icon: HelpCircle },
                { id: 'study_plan', title: 'Plano de Estudo Individual', desc: 'Estruturação baseada no rendimento e comportamento do aluno selecionado.', icon: BookOpen }
              ].map(item => {
                const isActive = selectedType === item.id;
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setSelectedType(item.id as any);
                      // Auto-select student if study plan is clicked
                      if (item.id === 'study_plan' && students.length > 0 && !selectedStudentId) {
                        setSelectedStudentId(students[0].id);
                      }
                    }}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-start gap-3.5 ${
                      isActive 
                        ? 'border-indigo-500 bg-indigo-500/10 text-white' 
                        : 'border-white/5 hover:bg-white/[0.02] text-zinc-405'
                    }`}
                  >
                    <span className={`p-2 rounded-lg mt-0.5 ${isActive ? 'bg-indigo-500/20 text-white' : 'bg-white/5 text-zinc-405'}`}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <div>
                      <h4 className="text-xs font-semibold leading-none text-white">{item.title}</h4>
                      <p className="text-[10px] text-zinc-450 mt-1 leading-normal">{item.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dynamic input filters */}
          <div className="space-y-4 pt-2 border-t border-white/5">
            
            {/* Conditional Student Selector for Study Plan */}
            {selectedType === 'study_plan' && (
              <div className="space-y-1.5 animate-fadeIn">
                <label className="text-[10px] font-bold tracking-widest text-white/40 uppercase font-mono block">Selecionar Aluno Beneficiário</label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-zinc-205 focus:border-indigo-505 focus:ring-opacity-0 outline-none"
                >
                  <option value="">-- Selecione o Aluno --</option>
                  {students.map(std => (
                    <option key={std.id} value={std.id}>
                      {std.name} ({std.class}) — Média: {std.averageGrade}/10
                    </option>
                  ))}
                </select>

                {selectedStudent && (
                  <div className="p-3 bg-zinc-950/60 border border-white/5 rounded-xl text-[10px] space-y-1 text-zinc-405 font-mono">
                    <p className="font-semibold text-zinc-300">Sumário de Rendimento:</p>
                    <p>• Assiduidade: <span className="text-white font-semibold">{selectedStudent.attendanceRate}%</span></p>
                    <p>• Grau Comportamento: <span className="text-white font-semibold">{selectedStudent.behaviorDegree}</span></p>
                    <p>• Média Teórica: <span className="text-emerald-400 font-semibold">{selectedStudent.averageGrade} / 10</span></p>
                  </div>
                )}
              </div>
            )}

            {/* Tema ou Conteúdo da Aula */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold tracking-widest text-white/40 uppercase font-mono block">Tema / Matéria de Foco</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Ex. Equações de Segundo Grau, Revolução Industrial, etc."
                className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-indigo-505 outline-none"
              />
              
              {/* Sugestões rápidas */}
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {promptSuggestions[selectedType].map((sug, i) => (
                  <button
                    key={i}
                    onClick={() => setTopic(sug)}
                    className="text-[9px] font-medium bg-white/5 hover:bg-white/10 text-zinc-405 px-2 py-1 rounded transition-colors cursor-pointer font-mono"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>

            {/* Nível de Dificuldade */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold tracking-widest text-white/40 uppercase font-mono block">Nível de Complexidade Teórica</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'easy', name: 'Fundamental' },
                  { id: 'medium', name: 'Médio / Secundário' },
                  { id: 'hard', name: 'Avançado / Superior' }
                ].map(lvl => {
                  const isActive = difficulty === lvl.id;
                  return (
                    <button
                      key={lvl.id}
                      onClick={() => setDifficulty(lvl.id as any)}
                      className={`p-2 border rounded-lg text-center font-semibold text-[10px] tracking-wide transition-all cursor-pointer ${
                        isActive 
                          ? 'border-indigo-500/50 bg-indigo-500/10 text-white' 
                          : 'border-white/5 text-zinc-405'
                      }`}
                    >
                      {lvl.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notas Adicionais Opcionais */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold tracking-widest text-white/40 uppercase font-mono block">Foco Pedagógico Extra (Opcional)</label>
              <textarea
                value={promptAddon}
                onChange={(e) => setPromptAddon(e.target.value)}
                placeholder="Ex: Focar em exemplos práticos do cotidiano, incluir termos em Inglês, criar 5 perguntas..."
                rows={2}
                className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-indigo-505 outline-none resize-none font-sans"
              />
            </div>
          </div>

          {/* Trigger button */}
          <button
            onClick={handleGenerate}
            disabled={isLoading || !topic.trim() || (selectedType === 'study_plan' && !selectedStudentId)}
            className={`w-full py-3.5 rounded-xl font-display font-bold text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
              isLoading || !topic.trim() || (selectedType === 'study_plan' && !selectedStudentId)
                ? 'bg-zinc-800 text-zinc-500 border border-zinc-850 cursor-not-allowed'
                : 'bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg active:scale-95'
            }`}
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span>Processando nos Chips AI...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Gerar Conteúdo Escolar</span>
              </>
            )}
          </button>
        </div>

        {/* Visor de Resultado (Aero Consola de Saída) */}
        <div className="lg:col-span-7 flex flex-col justify-between bg-[#111111] border border-white/5 rounded-2xl p-6 min-h-[500px]">
          <div className="flex-1 flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-400"></span>
                <h3 className="text-xs font-bold tracking-widest text-white uppercase font-mono">Consola de Saída</h3>
              </div>
              
              {generatedOutput && (
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 text-[10px] font-semibold text-indigo-400 bg-indigo-500/5 hover:bg-indigo-500/10 border border-indigo-500/10 px-2.5 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-400">Copiado!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copiar Conteúdo</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Generated document view */}
            <div className="flex-1 overflow-y-auto max-h-[460px] pr-2 scrollbar">
              {isLoading ? (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
                  <div className="space-y-1">
                    <p className="text-xs text-white font-semibold font-mono">A compilar métricas e inteligência didática...</p>
                    <p className="text-[10px] text-zinc-500 font-mono">Isto pode demorar 5-15 segundos no motor {selectedEngine.toUpperCase()}</p>
                  </div>
                </div>
              ) : generatedOutput ? (
                <div className="text-zinc-200 text-xs sm:text-xs leading-relaxed whitespace-pre-line font-sans p-3 bg-zinc-950/40 rounded-xl border border-white/5 space-y-4">
                  {/* Clean styling layout for generated output */}
                  {generatedOutput.split('\n\n').map((paragraph, pIdx) => {
                    const trimmed = paragraph.trim();
                    if (trimmed.startsWith('###') || trimmed.startsWith('##') || trimmed.startsWith('#')) {
                      const cleanHeader = trimmed.replace(/[#]+/g, '').trim();
                      return (
                        <h3 key={pIdx} className="text-sm font-bold font-display text-white border-b border-white/5 pb-1 mt-4 first:mt-0">
                          {cleanHeader}
                        </h3>
                      );
                    }
                    if (trimmed.startsWith('-') || trimmed.startsWith('*')) {
                      return (
                        <ul key={pIdx} className="list-disc pl-4 space-y-1 text-zinc-300">
                          {trimmed.split('\n').map((li, lIdx) => (
                            <li key={lIdx}>{li.replace(/^[\s-*]+/, '')}</li>
                          ))}
                        </ul>
                      );
                    }
                    return (
                      <p key={pIdx} className="text-zinc-300 leading-relaxed font-mono text-[11px]">
                        {paragraph}
                      </p>
                    );
                  })}
                </div>
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-3 py-20 text-zinc-550 select-none">
                  <Brain className="w-12 h-12 stroke-[1] text-zinc-700 animate-pulse" />
                  <div className="space-y-1 max-w-sm">
                    <h4 className="text-xs font-bold text-zinc-305 uppercase tracking-wider font-mono">Pronto para Geração</h4>
                    <p className="text-[10px] leading-normal text-zinc-500">
                      Escolha o motor, defina o tema principal e clique em "Gerar Conteúdo Escolar" para ver a mágica pedagógica.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-white/5 mt-4 text-[9px] text-zinc-500 leading-normal flex items-center justify-between font-mono">
            <span>Protocolo de Inteligência Artificial Institucional</span>
            <span className="text-indigo-400">Processamento Seguro Integrado</span>
          </div>
        </div>

      </div>

      {/* Guide Card below */}
      <section className="bg-white/[0.01] border border-white/5 rounded-2xl p-5 md:p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 bg-indigo-500/10 text-indigo-400 rounded-lg flex items-center justify-center font-bold text-xs">1</span>
            <h4 className="text-xs font-semibold text-white">Conteúdos Robustos</h4>
          </div>
          <p className="text-[10px] text-zinc-405 leading-relaxed font-sans">
            Gere resumos, roteiros conceituais inteiros estruturados com introduções, tópicos chave de debate e termos específicos do plano curricular nacional.
          </p>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 bg-indigo-500/10 text-indigo-400 rounded-lg flex items-center justify-center font-bold text-xs">2</span>
            <h4 className="text-xs font-semibold text-white">Quizzes Interativos</h4>
          </div>
          <p className="text-[10px] text-zinc-405 leading-relaxed font-sans">
            Elabore avaliações completas contendo enunciados, alternativas estruturadas (A, B, C, D) e explicações minuciosas do porquê cada gabarito está correto.
          </p>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="w-5 h-5 bg-indigo-500/10 text-indigo-400 rounded-lg flex items-center justify-center font-bold text-xs">3</span>
            <h4 className="text-xs font-semibold text-white">Planos de Estudo</h4>
          </div>
          <p className="text-[10px] text-zinc-405 leading-relaxed font-sans">
            Com base em notas reais do aluno, comportamento e frequência na plataforma, a IA desenhará um cronograma exato de disciplinas, focos e links sugeridos.
          </p>
        </div>
      </section>

    </div>
  );
}
