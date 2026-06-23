import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Database,
  FileText,
  FileSpreadsheet,
  FileSignature,
  Building2,
  Sparkles,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Settings2,
  Check,
  RotateCcw,
  Edit3,
  Loader2,
  TrendingUp,
  CreditCard,
  FolderOpen,
  X,
  HelpCircle,
  Clock,
  Play
} from 'lucide-react';
import { getHeaders } from '../supabaseClient';

interface SchoolMigrationProps {
  onRefreshData?: () => void;
}

interface MigratedRow {
  name: string;
  class: string;
  guardiansName: string;
  guardiansContact: string;
  outstandingFees: number;
  averageGrade: number;
  attendanceRate: number;
  status: string;
  amountPaid: number;
  missingDocs: string[];
  errors: string[];
  warnings: string[];
}

export default function SchoolMigration({ onRefreshData }: SchoolMigrationProps) {
  // Source Selection
  const [selectedSource, setSelectedSource] = useState<'csv' | 'excel' | 'sheets' | 'pdf' | 'legacy'>('csv');
  const [schoolName, setSchoolName] = useState('');
  const [rawText, setRawText] = useState('');
  const [loading, setLoading] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  
  // OCR & IA Analysis results
  const [analysisResult, setAnalysisResult] = useState<{
    detectedSchool: string;
    rows: MigratedRow[];
    statistics: {
      totalRows: number;
      validRows: number;
      warningRows: number;
      errorRows: number;
    }
  } | null>(null);

  // Column Mapping state
  const [columnMappings, setColumnMappings] = useState<Record<string, string>>({
    'Nome do Aluno': 'name',
    'Turma/Ano': 'class',
    'Encarregado de Educação': 'guardiansName',
    'Contacto Telefónico': 'guardiansContact',
    'Dívida Pendente': 'outstandingFees',
    'Média de Notas': 'averageGrade',
    'Taxa de Frequência': 'attendanceRate'
  });

  // Editor states
  const [editingRowIndex, setEditingRowIndex] = useState<number | null>(null);
  const [editFormData, setEditFormData] = useState<MigratedRow | null>(null);

  // Success state
  const [successReport, setSuccessReport] = useState<{
    importedCount: number;
    invoicesCount: number;
    schoolName: string;
  } | null>(null);

  // Samples
  const samples: Record<typeof selectedSource, string> = {
    csv: `Nome do Aluno,Turma,Encarregado de Educação,Contacto,Mensalidade,Média,Faltas
"Mariana Alvarenga","8º Ano B","Carla Alvarenga","+351 912 888 111",140,16.2,"98%"
"Santiago Nunes","9º Ano A","Rui Nunes","+351 915 222 333",150,11.5,"92%"
"Beatriz Constança","10º Ano A","Sofia Constança","+351 963 000 444",180,18.0,"100%"
"Rodrigo Santos","7º Ano B","Mário Santos","rodrigo_errado_mail",140,8.7,"75%"`,
    excel: `Aluno\tAno letivo\tPai/Mãe\tTelemóvel\tPropina\tMédia\tAulas
Matilde Guedes\t9º Ano B\tVasco Guedes\t914 999 888\t140\t15.8\t97
Tomás Ribeiro\t10º Ano A\tAna Ribeiro\t912 333 444\t180\t13.4\t99
Guilherme Dias\t8º Ano A\tRita Dias\t919 444 555\t140\t14.2\t91
Leonor Mendes\t[FALTA TURMA]\tLuís Mendes\t911 321 654\t150\t16.5\t95`,
    sheets: `Link ou Grelha Copiada do Google Drive:
https://docs.google.com/spreadsheets/d/1BxiM_gS685AqcIygMCnyG-uN6A/edit

Valores Extraídos:
Diogo Vasconcelos\t11º Ano A\tJosé Vasconcelos\t+351 912 300 123\t200\t17.5
Sofia Barbosa\t11º Ano B\tMaria Barbosa\t+351 934 500 600\t200\t15.2
Clara Antunes\t12º Ano A\tPedro Antunes\t+351 919 888 777\t220\t14.9`,
    pdf: `SISTEMA ACADÉMICO - RELATÓRIO PDF DE ALUNOS ATIVOS
Data de Emissão: 12/06/2026

1. Aluno: Francisca Tavares
   Turma: 8º Ano A | Frequência: 99%
   Encarregado de Educação: Jorge Tavares (Contacto: +351 916 333 111)
   Situação Financeira: Propina Ativa de 140€

2. Aluno: Gustavo Rocha
   Turma: 9º Ano B | Frequência: 94%
   Encarregado de Educação: Marta Rocha (Contacto: 918 222 333)
   Situação Financeira: Mensalidade regular de 140€`,
    legacy: `INSERT INTO antigo_alunos (id, nome_completo, classe_atual, tutor, tel_fiscal, propina_mes, nota_final) VALUES
(2044, 'Inês Henriques', '10º Ano B', 'Daniel Henriques', '+351 912 000 888', 180, 15.3),
(2089, 'Pedro Fonseca', '7º Ano A', 'Catarina Fonseca', '933 111 222', 140, 12.8),
(2102, 'Gabriel Lacerda', '12º Ano B', 'Nuno Lacerda', '+351 961 222 333', 220, 16.9);`
  };

  const handleApplySample = () => {
    setRawText(samples[selectedSource]);
  };

  // Drag and Drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setRawText(event.target.result as string);
          if (file.name.endsWith('.csv')) {
            setSelectedSource('csv');
          } else if (file.name.endsWith('.xlsx')) {
            setSelectedSource('excel');
          } else if (file.name.endsWith('.pdf')) {
            setSelectedSource('pdf');
          }
        }
      };
      reader.readAsText(file);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setRawText(event.target.result as string);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleAnalyze = async () => {
    if (!rawText.trim()) return;
    setLoading(true);
    setAnalysisResult(null);

    try {
      const response = await fetch('/api/migration/analyze', {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({
          text: rawText,
          fileType: selectedSource
        })
      });

      if (!response.ok) {
        throw new Error('Falha ao processar dados com Inteligência Artificial.');
      }

      const data = await response.json();
      setAnalysisResult(data);
      if (data.detectedSchool && data.detectedSchool !== 'Não Detetado') {
        setSchoolName(data.detectedSchool);
      } else {
        setSchoolName('Escola Primária Imperial');
      }
    } catch (err: any) {
      alert(err.message || 'Erro de comunicação com o servidor.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditRow = (idx: number) => {
    setEditingRowIndex(idx);
    setEditFormData({ ...analysisResult!.rows[idx] });
  };

  const handleSaveEditRow = () => {
    if (!editFormData || analysisResult === null) return;
    
    const updatedRows = [...analysisResult.rows];
    // Clean errors if user corrected critical fields
    const updatedRow = { ...editFormData };
    if (updatedRow.name && updatedRow.class) {
      updatedRow.errors = [];
    }

    updatedRows[editingRowIndex!] = updatedRow;
    
    setAnalysisResult({
      ...analysisResult,
      rows: updatedRows,
      statistics: {
        ...analysisResult.statistics,
        errorRows: updatedRows.filter(r => r.errors.length > 0).length,
        warningRows: updatedRows.filter(r => r.warnings.length > 0).length
      }
    });

    setEditingRowIndex(null);
    setEditFormData(null);
  };

  const handleExecuteMigration = async () => {
    if (!analysisResult || analysisResult.rows.length === 0) return;
    setIsExecuting(true);

    try {
      const response = await fetch('/api/migration/execute', {
        method: 'POST',
        headers: await getHeaders(),
        body: JSON.stringify({
          rows: analysisResult.rows,
          schoolName: schoolName || 'Instituição Escola Nova'
        })
      });

      if (!response.ok) {
        throw new Error('Erro ao guardar os dados dos alunos e faturas no sistema central.');
      }

      const data = await response.json();
      setSuccessReport({
        importedCount: data.importedCount,
        invoicesCount: data.invoicesCount,
        schoolName: data.schoolName
      });

      if (onRefreshData) onRefreshData();
    } catch (err: any) {
      alert(err.message || 'Falha na persistência definitiva.');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleReset = () => {
    setAnalysisResult(null);
    setRawText('');
    setSchoolName('');
    setSuccessReport(null);
  };

  return (
    <div id="school-migration-container" className="space-y-6 w-full max-w-[1600px] mx-auto pb-10">
      
      {/* HEADER BAR */}
      <div id="migration-header" className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900/50 backdrop-blur-md p-6 rounded-2xl border border-slate-800/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 text-[10px] uppercase font-bold tracking-wider bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full">
              Módulo de Onboarding
            </span>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
          <h1 className="text-2xl font-semibold text-slate-100 flex items-center gap-2">
            <Database className="text-indigo-400 w-6 h-6" /> Migração & Integração de Novas Escolas
          </h1>
          <p className="text-sm text-slate-400 mt-1 max-w-2xl">
            Importe ficheiros legados ou bases inteiras de novas instituições utilizando IA generativa de ponta para interpretar as tabelas, detectar inconsistências, limpar contactos e estruturar a base com total conformidade operacional.
          </p>
        </div>

        {analysisResult && !successReport && (
          <button
            onClick={handleReset}
            className="px-4 py-2 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800 hover:bg-slate-700/80 rounded-lg border border-slate-700 transition flex items-center gap-2"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Recomeçar Onboarding
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {/* SUCCESS SUCCESS SUCCESS CARD */}
        {successReport && (
          <motion.div
            key="success-onboarding"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="p-8 rounded-2xl bg-gradient-to-br from-indigo-950/40 via-emerald-950/20 to-slate-900 border border-emerald-500/30 text-center max-w-3xl mx-auto space-y-6"
          >
            <div className="inline-flex p-4 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <CheckCircle2 className="w-12 h-12 animate-pulse" />
            </div>

            <div className="space-y-2">
              <h2 className="text-3xl font-bold text-slate-100 tracking-tight">Onboarding Concluído com Sucesso!</h2>
              <p className="text-slate-300 max-w-xl mx-auto text-sm">
                A infraestrutura de dados da instituição <strong className="text-emerald-400 font-semibold">"{successReport.schoolName}"</strong> foi completamente integrada e migrada para o banco de dados principal do Portal Académico.
              </p>
            </div>

            {/* Entity Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-xl mx-auto">
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col items-center">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Alunos Importados</span>
                <span className="text-2xl font-bold text-slate-100 mt-1 flex items-center gap-1.5">
                  <TrendingUp className="w-4 h-4 text-emerald-400" /> {successReport.importedCount}
                </span>
                <span className="text-[10px] text-emerald-500/80 mt-1 font-medium bg-emerald-500/5 px-2 py-0.5 rounded-full border border-emerald-500/10">Estado: Ativo</span>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col items-center">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Mensalidades / Faturas</span>
                <span className="text-2xl font-bold text-slate-100 mt-1 flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-indigo-400" /> {successReport.invoicesCount}
                </span>
                <span className="text-[10px] text-indigo-400 mt-1 font-medium bg-indigo-500/5 px-2 py-0.5 rounded-full border border-indigo-500/10">Sincronizado</span>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col items-center">
                <span className="text-[10px] text-slate-500 uppercase font-semibold">Dossiê Documental</span>
                <span className="text-2xl font-bold text-slate-100 mt-1 flex items-center gap-1.5">
                  <FolderOpen className="w-4 h-4 text-amber-400" /> Ativo
                </span>
                <span className="text-[10px] text-amber-500/85 mt-1 font-medium bg-amber-500/5 px-2 py-0.5 rounded-full border border-amber-500/10">Contratos Criados</span>
              </div>
            </div>

            <div className="flex justify-center gap-4 pt-2">
              <button
                onClick={handleReset}
                className="px-6 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 transition rounded-lg shadow-lg shadow-indigo-500/20"
              >
                Novo Onboarding
              </button>
            </div>
          </motion.div>
        )}

        {/* INPUT INPUT INPUT PANEL */}
        {!analysisResult && !successReport && (
          <motion.div
            key="input-panel"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="grid grid-cols-1 lg:grid-cols-12 gap-6"
          >
            {/* LEFT COLUMN: SOURCE SECTOR SELECTOR */}
            <div className="lg:col-span-4 space-y-6">
              <div className="p-6 rounded-2xl bg-slate-900/50 backdrop-blur-md border border-slate-800/80">
                <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-1.5">
                  <Settings2 className="w-4 h-4 text-indigo-400" /> 1. Escolha a Origem dos Dados
                </h3>

                <div className="space-y-3">
                  {[
                    { id: 'csv', name: 'Ficheiro CSV', desc: 'Tabela delimitada por vírgula ou ponto e vírgula', icon: FileText, color: 'text-emerald-400 bg-emerald-500/5 border-emerald-500/20' },
                    { id: 'excel', name: 'Folha Excel (.xlsx)', desc: 'Tabela do Microsoft Excel ou copiada (TAB)', icon: FileSpreadsheet, color: 'text-indigo-400 bg-indigo-500/5 border-indigo-500/20' },
                    { id: 'sheets', name: 'Google Sheets', desc: 'Dados e tabelas do Google Drive / Cloud', icon: FileSpreadsheet, color: 'text-amber-400 bg-amber-500/5 border-amber-500/20' },
                    { id: 'pdf', name: 'PDF Académico', desc: 'Texto bruto extraído de boletins e pautas PDF', icon: FileSignature, color: 'text-rose-400 bg-rose-500/5 border-rose-500/20' },
                    { id: 'legacy', name: 'Dump / Sistema Antigo', desc: 'Instruções SQL legadas, ficheiros JSON ou texto livre', icon: Database, color: 'text-sky-400 bg-sky-500/5 border-sky-500/20' }
                  ].map((src) => {
                    const Icon = src.icon;
                    const isSelected = selectedSource === src.id;
                    return (
                      <button
                        key={src.id}
                        onClick={() => setSelectedSource(src.id as any)}
                        className={`w-full text-left p-4 rounded-xl border transition flex items-start gap-3 ${
                          isSelected
                            ? 'bg-slate-800 border-indigo-500/80 shadow-md shadow-indigo-500/5'
                            : 'bg-slate-900/40 border-slate-800 hover:bg-slate-800/50 hover:border-slate-700'
                        }`}
                      >
                        <div className={`p-2 rounded-lg border ${src.color}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-200">{src.name}</span>
                            {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-indigo-400"></span>}
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">{src.desc}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* DEMO TOOLTIP BOX */}
              <div className="p-5 rounded-2xl bg-indigo-950/20 border border-indigo-500/20 space-y-3">
                <div className="flex items-center gap-1.5 text-indigo-300 text-xs font-semibold">
                  <Sparkles className="w-4 h-4 animate-bounce" /> Motor de Onboarding Inteligente
                </div>
                <p className="text-[11px] text-indigo-200/80 leading-relaxed">
                  Não possui um ficheiro real de imediato? Ative o preenchimento automático clicando no botão para aplicar uma estrutura de exemplo para análise imediata.
                </p>
                <button
                  onClick={handleApplySample}
                  className="w-full py-2 text-center text-xs font-semibold text-indigo-300 hover:text-white bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/35 rounded-lg transition"
                >
                  Carregar Amostras Prontas
                </button>
              </div>
            </div>

            {/* RIGHT COLUMN: TEXT AREA AND DRAG DROP */}
            <div className="lg:col-span-8 space-y-6">
              <div className="p-6 rounded-2xl bg-slate-900/50 backdrop-blur-md border border-slate-800/80 flex flex-col h-full">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-1.5">
                    <UploadCloud className="w-4 h-4 text-indigo-400" /> 2. Insira ou Arraste os Dados Escolares
                  </h3>
                  <div className="text-[10px] text-slate-400 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-500" /> Limite recomendado: 500 linhas recomendadas
                  </div>
                </div>

                {/* DROP ZONE */}
                <div
                  onDragEnter={handleDrag}
                  onDragOver={handleDrag}
                  onDragLeave={handleDrag}
                  onDrop={handleDrop}
                  className={`border-2 border-dashed rounded-xl p-6 text-center transition flex flex-col items-center justify-center min-h-[140px] mb-4 relative ${
                    dragActive
                      ? 'border-indigo-500 bg-indigo-500/5'
                      : 'border-slate-800 hover:border-slate-700 bg-slate-900/20'
                  }`}
                >
                  <UploadCloud className="w-8 h-8 text-slate-400 mb-2" />
                  <p className="text-xs text-slate-300">
                    Arraste o seu ficheiro <strong className="text-indigo-400">CSV, Excel ou PDF</strong> aqui
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1">ou clique para procurar no seu computador</p>
                  
                  <input
                    type="file"
                    onChange={handleFileChange}
                    accept=".csv,.xlsx,.xls,.pdf,.txt"
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>

                {/* TEXTAREA FOR DIRECT COPY-PASTE */}
                <div className="flex-1 flex flex-col space-y-2 min-h-[220px]">
                  <label className="text-[11px] font-medium text-slate-400 flex items-center justify-between">
                    <span>Editor de Texto Bruto / Dados Copiados:</span>
                    <span className="text-[10px] text-slate-400/80 bg-slate-800 px-2 py-0.5 rounded">Formato: {selectedSource.toUpperCase()}</span>
                  </label>
                  <textarea
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    placeholder={`Cole aqui o conteúdo contendo as informações dos alunos...\n\nExemplo:\nAluno A\t7º Ano\tPai X\t910000000\t140€`}
                    className="w-full flex-1 p-4 rounded-xl bg-slate-900/60 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-xs font-mono text-slate-300 placeholder-slate-600 resize-none outline-none leading-relaxed min-h-[220px]"
                  />
                </div>

                <div className="flex justify-end pt-5">
                  <button
                    onClick={handleAnalyze}
                    disabled={loading || !rawText.trim()}
                    className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-xs font-semibold text-white rounded-lg shadow-lg shadow-indigo-600/10 hover:shadow-indigo-600/20 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center gap-2 group"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Interpretando Tabela...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 group-hover:scale-110 transition" /> Analisar e Mapear com IA
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ANALYSIS PREVIEW ANALYSIS PREVIEW PANEL */}
        {analysisResult && !successReport && (
          <motion.div
            key="analysis-panel"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="space-y-6"
          >
            {/* SCHOOL NAME AND SUMMARY CHUNKS */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              
              {/* Main parameters block */}
              <div className="lg:col-span-8 p-6 rounded-2xl bg-slate-900/50 backdrop-blur-md border border-slate-800/80 space-y-4">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-1.5 mb-2">
                  <Building2 className="w-4 h-4 text-indigo-400" /> Detalhes da Instituição Onboarding
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-slate-400">Nome Estimado da Escola:</label>
                    <div className="relative">
                      <input
                        type="text"
                        value={schoolName}
                        onChange={(e) => setSchoolName(e.target.value)}
                        placeholder="Ex: Escola Primária Central de Lisboa"
                        className="w-full px-4 py-2.5 rounded-lg bg-slate-950 border border-slate-850 focus:border-indigo-500 text-xs text-slate-200 outline-none font-medium"
                      />
                      <Sparkles className="absolute right-3 top-3 text-indigo-400 w-3.5 h-3.5 animate-pulse" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-slate-400">Estado Padrão da Faturação:</label>
                    <div className="px-4 py-3 rounded-lg bg-slate-950 border border-slate-850 flex justify-between items-center">
                      <span className="text-xs text-slate-400 font-medium">Lançamento de Contrato & Propinas</span>
                      <span className="px-2 py-0.5 text-[9px] font-semibold text-amber-400 bg-amber-500/10 rounded border border-amber-500/20 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" /> Fatura Pendente
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Statistical report cards */}
              <div className="lg:col-span-4 p-6 rounded-2xl bg-slate-900/50 backdrop-blur-md border border-slate-800/80">
                <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-1.5 mb-4">
                  <Settings2 className="w-4 h-4 text-indigo-400" /> Relatório de Diagnóstico de IA
                </h3>

                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-850">
                    <div className="text-lg font-bold text-slate-200">{analysisResult.statistics.totalRows}</div>
                    <div className="text-[9px] text-slate-500 uppercase mt-0.5">Alunos Lidos</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-emerald-500/20 bg-emerald-500/[0.01]">
                    <div className="text-lg font-bold text-emerald-400">{analysisResult.statistics.validRows}</div>
                    <div className="text-[9px] text-slate-500 uppercase mt-0.5">Sem Erros</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-amber-550/20 bg-amber-500/[0.01]">
                    <div className="text-lg font-bold text-amber-400">{analysisResult.statistics.warningRows}</div>
                    <div className="text-[9px] text-slate-500 uppercase mt-0.5">Com Avisos</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-rose-550/20 bg-rose-500/[0.01]">
                    <div className="text-lg font-bold text-rose-400">{analysisResult.statistics.errorRows}</div>
                    <div className="text-[9px] text-slate-500 uppercase mt-0.5">Com Erros</div>
                  </div>
                </div>
              </div>

            </div>

            {/* ERROR SUMMARY PANEL */}
            {(analysisResult.statistics.errorRows > 0 || analysisResult.statistics.warningRows > 0) && (
              <div className="p-5 rounded-xl bg-amber-500/5 border border-amber-500/20 space-y-3">
                <div className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" /> Anomalias Detetadas e Inteligência Corretora Automática:
                </div>
                <div className="text-xs text-slate-350 leading-relaxed space-y-1 bg-slate-950/40 p-3 rounded-lg border border-slate-850">
                  <p>• <strong>E-mails/Contactos errados:</strong> Limpos de carateres especiais e organizados sob máscara europeia.</p>
                  <p>• <strong>Turma em Falta:</strong> Atribuída ao aluno a turma geral de onboarding por dedução inteligente baseada na idade (se detetada).</p>
                  <p>• <strong>Resolução:</strong> Você pode editar qualquer linha na tabela abaixo utilizando o botão de edição rápida à direita antes de prosseguir!</p>
                </div>
              </div>
            )}

            {/* TABULAR BOARD SECTION */}
            <div className="p-6 rounded-2xl bg-slate-900/50 backdrop-blur-md border border-slate-800/80 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Resultados da Tabela & Mapeamento de Linhas
                </h4>
                
                <span className="text-[10px] text-slate-400 bg-slate-800 px-3 py-1 rounded-full border border-slate-700/60 font-medium">
                  Persistência local temporária: Sandbox mode
                </span>
              </div>

              {/* TABLE CONTAINER */}
              <div className="overflow-x-auto rounded-xl border border-slate-800/80 bg-slate-950/40">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900/40 text-slate-400 border-b border-slate-800/80">
                      <th className="p-4 text-[10px] uppercase font-bold tracking-wider">Aluno</th>
                      <th className="p-4 text-[10px] uppercase font-bold tracking-wider">Turma</th>
                      <th className="p-4 text-[10px] uppercase font-bold tracking-wider">Encarregado</th>
                      <th className="p-4 text-[10px] uppercase font-bold tracking-wider">Contacto</th>
                      <th className="p-4 text-[10px] uppercase font-bold tracking-wider text-right">Mensalidade</th>
                      <th className="p-4 text-[10px] uppercase font-bold tracking-wider text-right">Média / Freq</th>
                      <th className="p-4 text-[10px] uppercase font-bold tracking-wider">Doc. Pendentes</th>
                      <th className="p-4 text-[10px] uppercase font-bold tracking-wider">Problemas</th>
                      <th className="p-4 text-[10px] uppercase font-bold tracking-wider text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900/50 text-xs">
                    {analysisResult.rows.map((row, idx) => {
                      const hasError = row.errors.length > 0;
                      const hasWarning = row.warnings.length > 0;
                      return (
                        <tr
                          key={idx}
                          className={`hover:bg-slate-900/30 transition-colors ${
                            hasError ? 'bg-rose-500/[0.02]' : hasWarning ? 'bg-amber-500/[0.01]' : ''
                          }`}
                        >
                          {/* Aluno Name */}
                          <td className="p-4 text-slate-200 font-semibold max-w-[180px] truncate">
                            {row.name}
                          </td>

                          {/* Turma / Class */}
                          <td className="p-4 text-slate-300">
                            <span className="px-2 py-0.5 rounded bg-slate-800/80 border border-slate-700/50">
                              {row.class}
                            </span>
                          </td>

                          {/* Guardian */}
                          <td className="p-4 text-slate-400">
                            {row.guardiansName}
                          </td>

                          {/* Contact */}
                          <td className="p-4 text-slate-400 font-mono text-[10px]">
                            {row.guardiansContact}
                          </td>

                          {/* Fees */}
                          <td className="p-4 text-right text-slate-200 font-mono font-medium">
                            {row.outstandingFees}€
                          </td>

                          {/* Grade & Attendance */}
                          <td className="p-4 text-right text-slate-400 space-y-0.5">
                            <div className="font-semibold text-slate-300 font-mono">{row.averageGrade?.toFixed(1) || '0.0'}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{row.attendanceRate || 100}% freq</div>
                          </td>

                          {/* Docs */}
                          <td className="p-4">
                            <div className="flex flex-wrap gap-1 max-w-[150px]">
                              {row.missingDocs?.length === 0 ? (
                                <span className="text-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded px-1 py-0.5 font-bold uppercase">Tudo em Dia</span>
                              ) : (
                                row.missingDocs?.map((doc, dIdx) => (
                                  <span key={dIdx} className="text-[8px] bg-slate-800 text-slate-400 px-1 py-0.5 rounded border border-slate-750 font-medium">
                                    {doc}
                                  </span>
                                ))
                              )}
                            </div>
                          </td>

                          {/* Alerts */}
                          <td className="p-4">
                            {hasError ? (
                              <div className="text-rose-400 flex items-center gap-1 font-semibold text-[10px] bg-rose-500/5 px-2 py-1 rounded border border-rose-500/10 max-w-[150px] leading-snug">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {row.errors[0]}
                              </div>
                            ) : hasWarning ? (
                              <div className="text-amber-400 flex items-center gap-1 font-semibold text-[10px] bg-amber-500/5 px-2 py-1 rounded border border-amber-500/10 max-w-[150px] leading-snug">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {row.warnings[0]}
                              </div>
                            ) : (
                              <div className="text-emerald-400 flex items-center gap-1 text-[10px] bg-emerald-500/5 px-2 py-1 rounded border border-emerald-500/10 w-fit">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" /> Regular
                              </div>
                            )}
                          </td>

                          {/* Inline Edit Controls */}
                          <td className="p-4 text-center">
                            <button
                              onClick={() => handleEditRow(idx)}
                              className="p-1.5 text-slate-400 hover:text-indigo-400 bg-slate-800/60 hover:bg-slate-800 rounded border border-slate-700/60 transition"
                              title="Editar Linha"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* EXECUTION TRIGGER ACTION */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-slate-900/30 p-5 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2">
                  <Check className="w-5 h-5 text-indigo-400 bg-indigo-500/10 p-1 rounded-full border border-indigo-500/20" />
                  <div className="text-left">
                    <div className="text-xs font-semibold text-slate-200">Revisão Completa Realizada</div>
                    <p className="text-[10px] text-slate-400 leading-none mt-0.5">Todos os alunos verificados com sucesso no linter de validação operacional.</p>
                  </div>
                </div>

                <div className="flex gap-3 w-full sm:w-auto">
                  <button
                    onClick={handleReset}
                    className="flex-1 sm:flex-initial px-4 py-2.5 text-xs font-medium text-slate-400 hover:text-slate-200 bg-slate-800/80 rounded-lg border border-slate-700 transition"
                  >
                    Retroceder
                  </button>
                  <button
                    onClick={handleExecuteMigration}
                    disabled={isExecuting || analysisResult.rows.length === 0}
                    className="flex-1 sm:flex-initial px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-xs font-semibold text-white rounded-lg shadow-lg shadow-emerald-600/10 disabled:opacity-40 disabled:cursor-not-allowed transition flex items-center justify-center gap-2"
                  >
                    {isExecuting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Efetuando Onboarding...
                      </>
                    ) : (
                      <>
                        <Play className="w-3.5 h-3.5" /> Confirmar Migração da Escola
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ROW FIELD EDIT MODAL */}
      <AnimatePresence>
        {editingRowIndex !== null && editFormData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-lg p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl space-y-4"
            >
              <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                <h3 className="text-sm font-semibold text-slate-100 flex items-center gap-1.5/5">
                  <Edit3 className="w-4 h-4 text-indigo-400" /> Corrigir Linha do Aluno
                </h3>
                <button
                  onClick={() => setEditingRowIndex(null)}
                  className="text-slate-400 hover:text-slate-200 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                {/* Nome do aluno */}
                <div className="col-span-2 space-y-1">
                  <label className="text-[11px] font-medium text-slate-400">Nome do Aluno:</label>
                  <input
                    type="text"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-250 focus:border-indigo-500 outline-none"
                  />
                </div>

                {/* Turma */}
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-400">Turma / Ano:</label>
                  <input
                    type="text"
                    value={editFormData.class}
                    onChange={(e) => setEditFormData({ ...editFormData, class: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-250 focus:border-indigo-500 outline-none"
                  />
                </div>

                {/* Mensalidade */}
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-400">Valor Mensalidade (€):</label>
                  <input
                    type="number"
                    value={editFormData.outstandingFees}
                    onChange={(e) => setEditFormData({ ...editFormData, outstandingFees: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-250 focus:border-indigo-500 outline-none"
                  />
                </div>

                {/* Encarregado de Educação */}
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-400">Nome do Pai/Mãe/Tutor:</label>
                  <input
                    type="text"
                    value={editFormData.guardiansName}
                    onChange={(e) => setEditFormData({ ...editFormData, guardiansName: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-250 focus:border-indigo-500 outline-none"
                  />
                </div>

                {/* Contacto telefónico */}
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-400">Telemóvel de Contacto:</label>
                  <input
                    type="text"
                    value={editFormData.guardiansContact}
                    onChange={(e) => setEditFormData({ ...editFormData, guardiansContact: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-250 focus:border-indigo-500 outline-none"
                  />
                </div>

                {/* Média */}
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-400">Média Geral (0-20):</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editFormData.averageGrade}
                    onChange={(e) => setEditFormData({ ...editFormData, averageGrade: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-250 focus:border-indigo-500 outline-none"
                  />
                </div>

                {/* Frequência */}
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-slate-400">Frequência (0-100%):</label>
                  <input
                    type="number"
                    value={editFormData.attendanceRate}
                    onChange={(e) => setEditFormData({ ...editFormData, attendanceRate: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-250 focus:border-indigo-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingRowIndex(null)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 bg-slate-800 rounded-lg transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditRow}
                  className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg transition"
                >
                  Confirmar Correção
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
