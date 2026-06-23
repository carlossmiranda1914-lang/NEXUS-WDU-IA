import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  Award, 
  Zap, 
  Flame, 
  Star, 
  Plus, 
  Users, 
  GraduationCap, 
  CheckCircle2, 
  ChevronRight, 
  Sparkles,
  AlertCircle,
  TrendingUp,
  Sliders
} from 'lucide-react';
import { Student, Teacher } from '../types';

interface GamificationProps {
  students: Student[];
  teachers: Teacher[];
  onBonusPointsToStudent: (id: string, amount: number) => void;
  onBonusPointsToTeacher: (id: string, amount: number) => void;
}

export default function Gamification({ 
  students, 
  teachers, 
  onBonusPointsToStudent, 
  onBonusPointsToTeacher 
}: GamificationProps) {
  const [activeTab, setActiveTab] = styleState('students'); // 'students' | 'teachers' | 'challenges'
  const [bonusAmountStud, setBonusAmountStud] = useState<number>(50);
  const [bonusAmountTeach, setBonusAmountTeach] = useState<number>(100);
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('');
  
  const [toastMessage, setToastMessage] = useState<string>('');

  function styleState(initial: string) {
    return useState<string>(initial);
  }

  // Calculate dynamic XP and rankings based on school data and bonus factors
  // To keep it persistent and dynamic, we will hook into student's averageGrade and attendanceRate as basic points,
  // then add "Points State" which can be updated of course!
  
  const studentGamifiedList = students.map((std, index) => {
    // Generate a reliable base score based on grades & attendance, plus any custom award state
    // Let's store awarded bonus XP in local storage or calculate dynamically
    const savedBonus = localStorage.getItem(`nexus_bonus_xp_stud_${std.id}`);
    const bonusXp = savedBonus ? parseInt(savedBonus, 10) : 0;
    const baseGradXp = Math.floor(std.averageGrade * 200);
    const baseAttendXp = Math.floor(std.attendanceRate * 5);
    const totalPoints = baseGradXp + baseAttendXp + bonusXp;
    
    // Level calculated from points: Level 1 starts at 0, level increases every 400 XP
    const level = Math.floor(totalPoints / 400) + 1;
    const nextLevelXp = level * 400;
    const currentLevelBaseXp = (level - 1) * 400;
    const progressPercent = Math.min(100, Math.round(((totalPoints - currentLevelBaseXp) / (nextLevelXp - currentLevelBaseXp)) * 100));

    // Badge determination
    let badge = 'Saber Inicial';
    if (level >= 5) badge = 'Erudito Imperial';
    else if (level >= 4) badge = 'Doutorado Elite';
    else if (level >= 3) badge = 'Sabedor Supremo';
    else if (level >= 2) badge = 'Cientista Júnior';

    return {
      ...std,
      xp: totalPoints,
      level,
      badge,
      progressPercent,
      nextLevelXp
    };
  }).sort((a, b) => b.xp - a.xp);

  const teacherGamifiedList = teachers.map((tch, index) => {
    // Same for teachers based on productivityScore (e.g. productivityScore is usually 0-100)
    const savedBonus = localStorage.getItem(`nexus_bonus_xp_teach_${tch.id}`);
    const bonusXp = savedBonus ? parseInt(savedBonus, 10) : 0;
    const productivityXp = tch.productivityScore * 10;
    const totalPoints = productivityXp + bonusXp;

    const level = Math.floor(totalPoints / 300) + 1;
    const nextLevelXp = level * 300;
    const currentLevelBaseXp = (level - 1) * 300;
    const progressPercent = Math.min(100, Math.round(((totalPoints - currentLevelBaseXp) / (nextLevelXp - currentLevelBaseXp)) * 100));

    let badge = 'Professor Apoiador';
    if (level >= 5) badge = 'Grão-Mestre Mentor';
    else if (level >= 4) badge = 'Catedrático de Honra';
    else if (level >= 3) badge = 'Inovador Digital';
    else if (level >= 2) badge = 'Educador Avançado';

    return {
      ...tch,
      xp: totalPoints,
      level,
      badge,
      progressPercent,
      nextLevelXp
    };
  }).sort((a, b) => b.xp - a.xp);

  // Challenges list
  const initialStudentChallenges = [
    { id: 'sc_1', title: 'Calculadora Cósmica', desc: 'Obter média de Matemática ou Álgebra superior a 9.0/10.', points: 150, progress: 85, category: 'Notas', complete: false },
    { id: 'sc_2', title: 'Frequência de Platina', desc: 'Manter a taxa de assiduidade escolar acima de 95% no trimestre.', points: 200, progress: 100, category: 'Assiduidade', complete: true },
    { id: 'sc_3', title: 'Líder de Equipa', desc: 'Participar ativamente em 3 ou mais dinâmicas escolares extracurriculares.', points: 100, progress: 66, category: 'Participação', complete: false },
    { id: 'sc_4', title: 'Comportamento Perfeito', desc: 'Registrar grau de comportamento "Excelente" sem qualquer advertência.', points: 250, progress: 100, category: 'Conduta', complete: true }
  ];

  const initialTeacherChallenges = [
    { id: 'tc_1', title: 'Mestre da Automação', desc: 'Disparar ou criar pelo menos 3 fluxos automáticos de comunicação no painel.', points: 300, progress: 100, category: 'Digital', complete: true },
    { id: 'tc_2', title: 'Inovador de Conteúdo AI', desc: 'Gerar 5 ou mais resumos/quizzes utilizando o novo módulo de IA Pedagógica.', points: 250, progress: 40, category: 'Pedagógico', complete: false },
    { id: 'tc_3', title: 'Produtividade Estelar', desc: 'Manter o Score Geral de Produtividade do corpo letivo acima de 90%.', points: 400, progress: 92, category: 'Performance', complete: false }
  ];

  const [studentChallenges, setStudentChallenges] = useState(initialStudentChallenges);
  const [teacherChallenges, setTeacherChallenges] = useState(initialTeacherChallenges);

  const displayToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleApplyStudentBonus = () => {
    if (!selectedStudentId) return;
    const numPoints = Number(bonusAmountStud) || 50;
    
    // Update local storage XP helper
    const currentBonus = localStorage.getItem(`nexus_bonus_xp_stud_${selectedStudentId}`);
    const updatedBonus = (currentBonus ? parseInt(currentBonus, 10) : 0) + numPoints;
    localStorage.setItem(`nexus_bonus_xp_stud_${selectedStudentId}`, String(updatedBonus));
    
    onBonusPointsToStudent(selectedStudentId, numPoints);
    const studName = students.find(s => s.id === selectedStudentId)?.name || 'Aluno';
    displayToast(`Atribuídos +${numPoints} XP para ${studName}! 🎉`);
  };

  const handleApplyTeacherBonus = () => {
    if (!selectedTeacherId) return;
    const numPoints = Number(bonusAmountTeach) || 100;

    const currentBonus = localStorage.getItem(`nexus_bonus_xp_teach_${selectedTeacherId}`);
    const updatedBonus = (currentBonus ? parseInt(currentBonus, 10) : 0) + numPoints;
    localStorage.setItem(`nexus_bonus_xp_teach_${selectedTeacherId}`, String(updatedBonus));

    onBonusPointsToTeacher(selectedTeacherId, numPoints);
    const teachName = teachers.find(t => t.id === selectedTeacherId)?.name || 'Professor';
    displayToast(`Atribuídos +${numPoints} XP para o Prof. ${teachName}! 🏆`);
  };

  const triggerCompleteChallenge = (id: string, type: 'stud' | 'teach') => {
    if (type === 'stud') {
      setStudentChallenges(prev => prev.map(ch => {
        if (ch.id === id) {
          if (!ch.complete) {
            displayToast(`Desafio Aluno "${ch.title}" concluído! +${ch.points} XP distribuídos.`);
            return { ...ch, progress: 100, complete: true };
          }
        }
        return ch;
      }));
    } else {
      setTeacherChallenges(prev => prev.map(ch => {
        if (ch.id === id) {
          if (!ch.complete) {
            displayToast(`Desafio Docente "${ch.title}" concluído! +${ch.points} XP para a equipa.`);
            return { ...ch, progress: 100, complete: true };
          }
        }
        return ch;
      }));
    }
  };

  return (
    <div id="nexus_gamification_module" className="space-y-8">
      {/* Toast Notification Header */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-24 right-10 bg-indigo-550 border border-indigo-400 text-white px-5 py-3 rounded-xl shadow-2xl z-50 flex items-center gap-2.5 font-mono text-xs"
          >
            <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <section className="flex flex-col lg:flex-row lg:items-end justify-between border-b border-white/5 pb-6 gap-4">
        <div>
          <span className="text-[11px] font-bold tracking-[0.2em] text-indigo-400 uppercase font-mono">Gamification Engine</span>
          <h1 className="text-4xl font-bold font-display text-white mt-1">Mérito & Engajamento</h1>
          <p className="text-xs text-zinc-450 mt-1.5 font-mono">
            Tabelas de honra, desafios ativos, pontuação de experiência (XP) acadêmica e incentivos integrados para alunos e docentes.
          </p>
        </div>

        {/* Global Gamification Metrics */}
        <div className="flex gap-6 text-xs font-mono">
          <div className="bg-white/5 border border-white/5 px-4 py-2.5 rounded-xl">
            <span className="text-zinc-500 uppercase block text-[9px] tracking-wider">Desafios Pendentes</span>
            <span className="text-lg font-light text-white font-mono">
              {studentChallenges.filter(c => !c.complete).length + teacherChallenges.filter(c => !c.complete).length} Ativos
            </span>
          </div>
          <div className="bg-white/5 border border-white/5 px-4 py-2.5 rounded-xl">
            <span className="text-zinc-500 uppercase block text-[9px] tracking-wider">Temporada Letiva</span>
            <span className="text-lg font-medium text-indigo-400 font-mono">Fase 2 / 2026</span>
          </div>
        </div>
      </section>

      {/* Navigation Inside module */}
      <div className="flex border-b border-white/5 pb-0.5 gap-2">
        {[
          { id: 'students', label: 'Ranking de Alunos', icon: Users },
          { id: 'teachers', label: 'Estatísticas de Professores', icon: GraduationCap },
          { id: 'challenges', label: 'Missões & Desafios Escolares', icon: AchievementIcon }
        ].map(tab => {
          const isActive = activeTab === tab.id;
          const CompIcon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 px-4 font-display font-semibold text-xs tracking-wide border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                isActive 
                  ? 'border-indigo-505 text-white' 
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <CompIcon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Dynamic Tables for Points & Rank */}
        <div className="lg:col-span-8 space-y-6">
          
          {activeTab === 'students' && (
            <div className="bg-[#111111] border border-white/5 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/5">
                <h3 className="text-xs font-bold tracking-wider text-white uppercase font-mono flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-indigo-400" />
                  Quadro de Honra do Alunado (Leaderboard)
                </h3>
                <span className="text-[10px] text-zinc-500 font-mono">Consolidado em tempo real</span>
              </div>

              {/* Student Ranking List */}
              <div className="space-y-3">
                {studentGamifiedList.map((stud, idx) => {
                  const isTop3 = idx < 3;
                  const medalColors = ['text-amber-400 bg-amber-500/10 border-amber-500/20', 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20', 'text-amber-700 bg-amber-800/10 border-amber-800/20'];
                  
                  return (
                    <div 
                      key={stud.id} 
                      className={`p-4 bg-zinc-950/40 border rounded-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 transition-all hover:border-white/10 ${
                        isTop3 ? 'border-indigo-550/30' : 'border-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        {/* Rank Icon or Number */}
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold font-mono text-sm border ${
                          isTop3 
                            ? medalColors[idx]
                            : 'text-zinc-450 border-white/5 bg-white/5'
                        }`}>
                          {idx + 1}
                        </div>

                        <div>
                          <div className="flex items-center gap-2.5">
                            <span className="text-xs font-semibold text-white font-sans">{stud.name}</span>
                            <span className="text-[9px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/25 px-1.5 py-0.2 rounded font-mono font-medium uppercase">
                              {stud.badge}
                            </span>
                          </div>
                          <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                            Classe: {stud.class} • Média Curricular: {stud.averageGrade}/10 • Assiduidade: {stud.attendanceRate}%
                          </p>
                        </div>
                      </div>

                      {/* XP Progress metrics */}
                      <div className="flex items-center gap-6 min-w-[180px] self-end sm:self-auto">
                        <div className="flex-1 space-y-1 text-right">
                          <div className="text-[10px] font-mono text-zinc-405">
                            Nível {stud.level} <span className="text-zinc-500">• {stud.xp} XP</span>
                          </div>
                          {/* Progress bar to next level */}
                          <div className="w-32 h-1.5 bg-zinc-805 rounded-full overflow-hidden inline-block text-left">
                            <div 
                              style={{ width: `${stud.progressPercent}%` }} 
                              className="h-full bg-indigo-500 rounded-full" 
                            />
                          </div>
                        </div>

                        <div className="shrink-0 flex flex-col items-center justify-center bg-white/5 border border-white/5 rounded-lg px-2 py-1 min-w-[50px]">
                          <Flame className="w-3.5 h-3.5 text-indigo-400" />
                          <span className="text-[11px] font-bold font-mono text-white mt-0.5">{stud.xp} pt</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="p-3 bg-indigo-500/5 rounded-xl border border-indigo-500/10 flex items-start gap-2.5 mt-4">
                <AlertCircle className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <p className="text-[10px] text-zinc-405 leading-relaxed font-sans">
                  <span className="font-semibold text-white">Como funcionam os pontos?</span> Alunos adquirem XP automaticamente através de excelente aproveitamento escolar (XP = Média * 200) e taxas perfeitas de assiduidade diária. Professores podem atribuir bónus de mérito a qualquer momento.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'teachers' && (
            <div className="bg-[#111111] border border-white/5 rounded-2xl p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-white/5">
                <h3 className="text-xs font-bold tracking-wider text-white uppercase font-mono flex items-center gap-2">
                  <Award className="w-4 h-4 text-indigo-400" />
                  Produtividade e Reconhecimento Docente
                </h3>
                <span className="text-[10px] text-zinc-500 font-mono">Consolidado trimestral</span>
              </div>

              {/* Teacher Ranking List */}
              <div className="space-y-3">
                {teacherGamifiedList.map((tch, idx) => {
                  const isTop3 = idx < 3;
                  const medalColors = ['text-amber-400 bg-amber-500/10 border-amber-500/20', 'text-zinc-400 bg-zinc-400/10 border-zinc-400/20', 'text-amber-700 bg-amber-800/10 border-amber-800/20'];

                  return (
                    <div 
                      key={tch.id} 
                      className={`p-4 bg-zinc-950/40 border rounded-xl flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 transition-all hover:border-white/10 ${
                        isTop3 ? 'border-indigo-550/30' : 'border-white/5'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold font-mono text-sm border ${
                          isTop3 
                            ? medalColors[idx]
                            : 'text-zinc-450 border-white/5 bg-white/5'
                        }`}>
                          {idx + 1}
                        </div>

                        <div>
                          <div className="flex items-center gap-2.5">
                            <span className="text-xs font-semibold text-white font-sans">Prof. {tch.name}</span>
                            <span className="text-[9px] bg-amber-550/10 text-amber-500 border border-amber-500/25 px-1.5 py-0.2 rounded font-mono font-medium uppercase">
                              {tch.badge}
                            </span>
                          </div>
                          <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                            Disciplinas: {tch.subjects?.join(', ')} • Produtividade Acumulada: {tch.productivityScore}%
                          </p>
                        </div>
                      </div>

                      {/* XP Progress metrics */}
                      <div className="flex items-center gap-6 min-w-[180px] self-end sm:self-auto">
                        <div className="flex-1 space-y-1 text-right">
                          <div className="text-[10px] font-mono text-zinc-405">
                            Nível Docente {tch.level} <span className="text-zinc-500">• {tch.xp} XP</span>
                          </div>
                          <div className="w-32 h-1.5 bg-zinc-805 rounded-full overflow-hidden inline-block text-left">
                            <div 
                              style={{ width: `${tch.progressPercent}%` }} 
                              className="h-full bg-indigo-500 rounded-full" 
                            />
                          </div>
                        </div>

                        <div className="shrink-0 flex flex-col items-center justify-center bg-white/5 border border-white/5 rounded-lg px-2 py-1 min-w-[50px]">
                          <Star className="w-3.5 h-3.5 text-amber-400" />
                          <span className="text-[11px] font-bold font-mono text-white mt-0.5">{tch.xp} pt</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'challenges' && (
            <div className="space-y-6">
              
              {/* Student Challenges */}
              <div className="bg-[#111111] border border-white/5 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-white/5">
                  <h3 className="text-xs font-bold tracking-wider text-white uppercase font-mono">
                    Desafios de Engajamento para Alunos
                  </h3>
                  <span className="text-[9px] font-bold tracking-wider bg-indigo-500/15 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded font-mono">
                    Novos Desafios Semanais
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {studentChallenges.map(chall => (
                    <div 
                      key={chall.id}
                      className={`p-4 rounded-xl border flex flex-col justify-between space-y-4 ${
                        chall.complete 
                          ? 'bg-emerald-500/[0.02] border-emerald-500/20' 
                          : 'bg-zinc-950/40 border-white/5 hover:border-white/10'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[8px] tracking-widest font-bold uppercase font-mono text-zinc-500">
                            Foco: {chall.category}
                          </span>
                          
                          {chall.complete ? (
                            <span className="text-[9px] text-emerald-400 font-mono flex items-center gap-1 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/25 font-bold">
                              ✓ Concluído
                            </span>
                          ) : (
                            <span className="text-[9px] text-indigo-400 font-mono font-bold">
                              +{chall.points} XP
                            </span>
                          )}
                        </div>

                        <h4 className="text-xs font-bold text-white font-display leading-tight">{chall.title}</h4>
                        <p className="text-[10px] text-zinc-405 leading-relaxed font-sans">{chall.desc}</p>
                      </div>

                      {/* Progress representation */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="text-zinc-500">Progresso</span>
                          <span className={chall.complete ? 'text-emerald-400 font-semibold' : 'text-zinc-300'}>{chall.progress}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-zinc-850 rounded-full overflow-hidden">
                          <div 
                            style={{ width: `${chall.progress}%` }}
                            className={`h-full ${chall.complete ? 'bg-emerald-500' : 'bg-indigo-500'}`}
                          />
                        </div>

                        {!chall.complete && (
                          <button
                            onClick={() => triggerCompleteChallenge(chall.id, 'stud')}
                            className="w-full py-1.5 bg-white/5 hover:bg-white/10 text-white font-mono text-[9px] font-bold rounded-lg border border-white/10 transition-colors uppercase tracking-wider cursor-pointer"
                          >
                            Simular Conclusão
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Teacher Challenges */}
              <div className="bg-[#111111] border border-white/5 rounded-2xl p-6 space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-white/5">
                  <h3 className="text-xs font-bold tracking-wider text-white uppercase font-mono">
                    Desafios de Engajamento Docente
                  </h3>
                  <span className="text-[9px] font-bold tracking-wider bg-amber-500/15 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded font-mono">
                    Missões Administrativas
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {teacherChallenges.map(chall => (
                    <div 
                      key={chall.id}
                      className={`p-4 rounded-xl border flex flex-col justify-between space-y-4 ${
                        chall.complete 
                          ? 'bg-emerald-500/[0.02] border-emerald-500/20' 
                          : 'bg-zinc-950/40 border-white/5 hover:border-white/10'
                      }`}
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[8px] tracking-widest font-bold uppercase font-mono text-zinc-500">
                            Foco: {chall.category}
                          </span>

                          {chall.complete ? (
                            <span className="text-[9px] text-emerald-400 font-mono flex items-center gap-1 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/25 font-bold">
                              ✓ Concluído
                            </span>
                          ) : (
                            <span className="text-[9px] text-indigo-400 font-mono font-bold">
                              +{chall.points} XP
                            </span>
                          )}
                        </div>

                        <h4 className="text-xs font-bold text-white font-display leading-tight">{chall.title}</h4>
                        <p className="text-[10px] text-zinc-405 leading-relaxed font-sans">{chall.desc}</p>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="text-zinc-500">Progresso</span>
                          <span className={chall.complete ? 'text-emerald-400 font-semibold' : 'text-zinc-300'}>{chall.progress}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-zinc-850 rounded-full overflow-hidden">
                          <div 
                            style={{ width: `${chall.progress}%` }}
                            className={`h-full ${chall.complete ? 'bg-emerald-500' : 'bg-indigo-505'}`}
                          />
                        </div>

                        {!chall.complete && (
                          <button
                            onClick={() => triggerCompleteChallenge(chall.id, 'teach')}
                            className="w-full py-1.5 bg-white/5 hover:bg-white/10 text-white font-mono text-[9px] font-bold rounded-lg border border-white/10 transition-colors uppercase tracking-wider cursor-pointer"
                          >
                            Simular Conclusão
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

        </div>

        {/* Right Side: Bonus Point Awards Form */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Awards Form Student */}
          <div className="bg-[#111111] border border-white/5 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-white/5">
              <Zap className="w-4 h-5 text-indigo-400" />
              <h3 className="text-xs font-bold tracking-[0.1em] uppercase font-mono text-white">Prémio de Mérito Aluno</h3>
            </div>
            
            <p className="text-[11px] text-zinc-450 leading-relaxed font-sans">
              Atribuir pontos de bónus a um aluno devido a excepcional dedicação letiva, ajuda em sala de aula ou participação olímpica.
            </p>

            <div className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold tracking-widest text-white/40 uppercase block font-mono">Selecionar Aluno</label>
                <select
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-indigo-405 outline-none"
                >
                  <option value="">-- Seleccione --</option>
                  {students.map(std => (
                    <option key={std.id} value={std.id}>{std.name} ({std.class})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold tracking-widest text-white/40 uppercase block font-mono">Quantidade de XP de Bónus</label>
                <select
                  value={bonusAmountStud}
                  onChange={(e) => setBonusAmountStud(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-indigo-405 outline-none font-mono"
                >
                  <option value={25}>+25 XP (Ajuda Colega)</option>
                  <option value={50}>+50 XP (Destaque do Dia)</option>
                  <option value={100}>+100 XP (Trabalho Incrível)</option>
                  <option value={200}>+200 XP (Altamente Excecional)</option>
                </select>
              </div>

              <button
                onClick={handleApplyStudentBonus}
                disabled={!selectedStudentId}
                className={`w-full py-2.5 rounded-xl font-display font-medium text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  !selectedStudentId 
                    ? 'bg-zinc-800 text-zinc-500 border border-zinc-850 cursor-not-allowed'
                    : 'bg-indigo-500 hover:bg-indigo-400 text-white shadow-md'
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>Atribuir Mérito</span>
              </button>
            </div>
          </div>

          {/* Awards Form Teacher */}
          <div className="bg-[#111111] border border-white/5 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2 pb-3 border-b border-white/5">
              <Star className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs font-bold tracking-[0.1em] uppercase font-mono text-white">Incentivo Docente</h3>
            </div>

            <p className="text-[11px] text-zinc-450 leading-relaxed font-sans">
              Reconhecer professores exemplares com XP adicional de bónus para impulsionar a sua escala corporativa.
            </p>

            <div className="space-y-4 pt-1">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold tracking-widest text-white/40 uppercase block font-mono">Selecionar Professor</label>
                <select
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-indigo-405 outline-none"
                >
                  <option value="">-- Seleccione --</option>
                  {teachers.map(tch => (
                    <option key={tch.id} value={tch.id}>Prof. {tch.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold tracking-widest text-white/40 uppercase block font-mono">Incentivo Docente</label>
                <select
                  value={bonusAmountTeach}
                  onChange={(e) => setBonusAmountTeach(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:border-indigo-405 outline-none font-mono"
                >
                  <option value={50}>+50 XP (Pontualidade Pauta)</option>
                  <option value={100}>+100 XP (Suporte Pedagógico)</option>
                  <option value={200}>+200 XP (Produção Didática AI)</option>
                  <option value={300}>+300 XP (Grau de Honra Anual)</option>
                </select>
              </div>

              <button
                onClick={handleApplyTeacherBonus}
                disabled={!selectedTeacherId}
                className={`w-full py-2.5 rounded-xl font-display font-medium text-xs flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  !selectedTeacherId 
                    ? 'bg-zinc-800 text-zinc-500 border border-zinc-850 cursor-not-allowed'
                    : 'bg-indigo-500 hover:bg-indigo-400 text-white shadow-md'
                }`}
              >
                <Plus className="w-4 h-4" />
                <span>Aplicar Reconhecimento</span>
              </button>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}

// Internal achievement icon indicator placeholder
function AchievementIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4 text-indigo-400"
    >
      <circle cx="12" cy="8" r="7" />
      <polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" />
    </svg>
  );
}
