import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, ArrowUpRight, CloudUpload, CloudDownload, RefreshCw, 
  CheckCircle2, AlertCircle, FileText, UserCheck, Loader2, Search, ExternalLink, 
  Database, UserCheck2, Trash2, Calendar, FileSpreadsheet as SheetIcon, Info
} from 'lucide-react';
import { auth, googleAuthProvider, getCachedAccessToken, setCachedAccessToken } from '../lib/firebase';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from 'firebase/auth';
import { Student, Invoice } from '../types';

interface GoogleSheetsCenterProps {
  students: Student[];
  setStudents: React.Dispatch<React.SetStateAction<Student[]>>;
  invoices: Invoice[];
  theme?: string;
}

interface SpreadsheetFile {
  id: string;
  name: string;
  webViewLink: string;
  modifiedTime: string;
}

export default function GoogleSheetsCenter({ 
  students, 
  setStudents, 
  invoices,
  theme 
}: GoogleSheetsCenterProps) {
  // Auth State
  const [googleUser, setGoogleUser] = useState<any>(null);
  const [accessToken, setAccessToken] = useState<string | null>(getCachedAccessToken());
  const [isConnecting, setIsConnecting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Drive Spreadsheet List State
  const [sheetsList, setSheetsList] = useState<SpreadsheetFile[]>([]);
  const [isLoadingSheets, setIsLoadingSheets] = useState(false);
  const [sheetsSearch, setSheetsSearch] = useState('');

  // Export State
  const [exportType, setExportType] = useState<'all' | 'students' | 'financials'>('all');
  const [customTitle, setCustomTitle] = useState(`Nexus Edu AI - Exportação Escolar (${new Date().toLocaleDateString('pt-PT')})`);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState<any>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  // Import State
  const [selectedSheetId, setSelectedSheetId] = useState<string>('');
  const [selectedSheetName, setSelectedSheetName] = useState<string>('Sheet1');
  const [customRange, setCustomRange] = useState<string>('A1:K100');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzedData, setAnalyzedData] = useState<any[][] | null>(null);
  const [importPreviewStudents, setImportPreviewStudents] = useState<Partial<Student>[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccessMessage, setImportSuccessMessage] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Sync Auth State with Firebase Auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (usr) => {
      if (usr) {
        setGoogleUser(usr);
        const tok = getCachedAccessToken();
        if (tok) {
          setAccessToken(tok);
        }
      } else {
        setGoogleUser(null);
        setAccessToken(null);
        setCachedAccessToken(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Fetch recently modified spreadsheets from Google Drive
  const fetchSpreadsheets = async (tokenToUse?: string) => {
    const activeToken = tokenToUse || accessToken;
    if (!activeToken) return;

    setIsLoadingSheets(true);
    try {
      const q = encodeURIComponent("mimeType='application/vnd.google-apps.spreadsheet'");
      const fields = encodeURIComponent("files(id,name,webViewLink,modifiedTime)");
      const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&orderBy=modifiedTime%20desc&pageSize=15`;
      
      const res = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${activeToken}`
        }
      });

      if (!res.ok) {
        if (res.status === 401) {
          // Token expired, clear cache
          setAccessToken(null);
          setCachedAccessToken(null);
          throw new Error("A sessão Google expirou. Por favor, conecte novamente.");
        }
        throw new Error("Não foi possível listar as folhas de cálculo do seu Drive.");
      }

      const data = await res.json();
      setSheetsList(data.files || []);
    } catch (err: any) {
      console.error(err);
      setAuthError(err.message || "Erro de ligação.");
    } finally {
      setIsLoadingSheets(false);
    }
  };

  // Load spreadsheets list when accessToken is set
  useEffect(() => {
    if (accessToken) {
      fetchSpreadsheets(accessToken);
    }
  }, [accessToken]);

  // Handle manual Google sign-in to retrieve a fresh OAuth access token
  const handleConnectGoogle = async () => {
    setIsConnecting(true);
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      const credential = GoogleAuthProvider.credentialFromResult(result);
      const token = credential?.accessToken;

      if (!token) {
        throw new Error("Não foi possível obter o token de acesso Google.");
      }

      setCachedAccessToken(token);
      setAccessToken(token);
      setGoogleUser(result.user);
      setAuthError(null);
      // Fetch sheets immediately
      fetchSpreadsheets(token);
    } catch (err: any) {
      console.error("Sign-in error:", err);
      setAuthError(err.message || "Erro ao conectar conta Google. Certifique-se de que autorizou as permissões.");
    } finally {
      setIsConnecting(false);
    }
  };

  // Handle Sign-Out
  const handleDisconnectGoogle = async () => {
    try {
      await signOut(auth);
      setAccessToken(null);
      setCachedAccessToken(null);
      setGoogleUser(null);
      setSheetsList([]);
      setExportSuccess(null);
      setAnalyzedData(null);
      setImportPreviewStudents([]);
    } catch (err: any) {
      console.error("Sign-out error:", err);
    }
  };

  // Helper: Format cell data
  const formatCell = (val: any) => {
    if (val === undefined || val === null) return "";
    return String(val);
  };

  // Create & Export Google Sheet
  const handleExportData = async () => {
    if (!accessToken) {
      setExportError("Por favor, conecte a sua conta Google primeiro.");
      return;
    }

    setIsExporting(true);
    setExportSuccess(null);
    setExportError(null);

    try {
      // 1. Create Spreadsheet
      const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          properties: {
            title: customTitle
          }
        })
      });

      if (!createRes.ok) {
        throw new Error("Falha ao criar o ficheiro no Google Sheets.");
      }

      const spreadsheet = await createRes.json();
      const spreadsheetId = spreadsheet.spreadsheetId;
      const spreadsheetUrl = spreadsheet.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

      // 2. Prepare Data Packages
      const valueRanges: any[] = [];

      // A. Students sheet values
      if (exportType === 'all' || exportType === 'students') {
        const studentHeaders = [
          'ID Aluno', 'Nome', 'Turma', 'Média de Notas', 'Presenças (%)', 
          'Status', 'Propina em Atraso (€)', 'Encarregado de Educação', 
          'Contacto do Encarregado', 'Comportamento'
        ];

        const studentRows = students.map(s => [
          formatCell(s.id),
          formatCell(s.name),
          formatCell(s.class),
          formatCell(s.averageGrade),
          formatCell(s.attendanceRate),
          formatCell(s.status),
          formatCell(s.outstandingFees),
          formatCell(s.guardiansName),
          formatCell(s.guardiansContact),
          formatCell(s.behaviorDegree)
        ]);

        valueRanges.push({
          range: 'Sheet1!A1', // Write first tab default
          majorDimension: 'ROWS',
          values: [studentHeaders, ...studentRows]
        });
      }

      // B. Invoices sheet values
      if (exportType === 'all' || exportType === 'financials') {
        const invoiceHeaders = [
          'ID Fatura', 'ID Aluno', 'Nome do Aluno', 'Valor (€)', 
          'Data de Vencimento', 'Status de Pagamento', 'Categoria'
        ];

        const invoiceRows = invoices.map(i => [
          formatCell(i.id),
          formatCell(i.studentId),
          formatCell(i.studentName),
          formatCell(i.amount),
          formatCell(i.dueDate),
          formatCell(i.status),
          formatCell(i.category)
        ]);

        // If 'all', write financials on a second sheet/tab.
        // Google Sheets automatically creates 'Sheet1'. If we want another sheet, we have to create it.
        // But to make it simple and reliable in a single batch call without adding sheet creation complexity,
        // we can export to Sheet1 (tab 1) and if exporting both, we can place them in 'Sheet1' side-by-side or stacked,
        // or let's create a sheet! Actually, we can append sheets by doing a quick spreadsheet batchUpdate first to add "Finanças" sheet.
        if (exportType === 'all') {
          // Add second sheet first
          const addSheetRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              requests: [
                {
                  updateSheetProperties: {
                    properties: {
                      sheetId: 0,
                      title: 'Alunos & Matrículas'
                    },
                    fields: 'title'
                  }
                },
                {
                  addSheet: {
                    properties: {
                      title: 'Controlo Financeiro'
                    }
                  }
                }
              ]
            })
          });

          if (addSheetRes.ok) {
            valueRanges[0].range = "'Alunos & Matrículas'!A1";
            valueRanges.push({
              range: "'Controlo Financeiro'!A1",
              majorDimension: 'ROWS',
              values: [invoiceHeaders, ...invoiceRows]
            });
          }
        } else {
          // Single export - rename first sheet to represent content
          await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              requests: [
                {
                  updateSheetProperties: {
                    properties: {
                      sheetId: 0,
                      title: exportType === 'students' ? 'Alunos' : 'Faturas'
                    },
                    fields: 'title'
                  }
                }
              ]
            })
          });

          valueRanges[0].range = exportType === 'students' ? "'Alunos'!A1" : "'Faturas'!A1";
        }
      }

      // 3. Populate Spreadsheet with values
      const populateRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          valueInputOption: 'USER_ENTERED',
          data: valueRanges
        })
      });

      if (!populateRes.ok) {
        throw new Error("Ficheiro criado mas falhou a inserção de dados.");
      }

      setExportSuccess({
        id: spreadsheetId,
        url: spreadsheetUrl,
        title: customTitle,
        itemsCount: (exportType === 'all') 
          ? (students.length + invoices.length) 
          : (exportType === 'students' ? students.length : invoices.length)
      });
      
      // Refresh spreadsheet list to show newly created file
      fetchSpreadsheets();
    } catch (err: any) {
      console.error(err);
      setExportError(err.message || "Ocorreu um erro ao exportar.");
    } finally {
      setIsExporting(false);
    }
  };

  // Create an Import Template Sheet in the user's Drive
  const handleCreateTemplate = async () => {
    if (!accessToken) return;
    setIsExporting(true);
    setExportError(null);
    setExportSuccess(null);

    const templateTitle = `Nexus Edu AI - Modelo de Importação de Alunos`;

    try {
      const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          properties: { title: templateTitle }
        })
      });

      if (!createRes.ok) throw new Error("Falha ao criar folha modelo.");
      const spreadsheet = await createRes.json();
      const spreadsheetId = spreadsheet.spreadsheetId;

      const headers = [
        'Nome Completo', 'Turma', 'Média de Notas (0-10)', 'Taxa de Faltas (%)', 
        'Comportamento (Excelente, Bom, Regular, Atenção)', 'Nome Encarregado', 
        'Contacto Encarregado', 'Propinas em Atraso (€)'
      ];

      const sampleRows = [
        ['Diogo Manuel Martins', '10ºA', '8.5', '95', 'Excelente', 'Maria Martins', '912345678', '0'],
        ['Beatriz Sofia Costa', '11ºB', '7.2', '88', 'Bom', 'António Costa', '931234567', '120.50'],
        ['Gustavo Henrique Pereira', '9ºC', '4.8', '74', 'Atenção', 'José Pereira', '961122334', '350.00']
      ];

      // Format Sheet headers nicely
      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requests: [
            {
              updateSheetProperties: {
                properties: { sheetId: 0, title: 'Modelo Importação' },
                fields: 'title'
              }
            }
          ]
        })
      });

      await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'Modelo Importação'!A1?valueInputOption=USER_ENTERED`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          range: "'Modelo Importação'!A1",
          majorDimension: 'ROWS',
          values: [headers, ...sampleRows]
        })
      });

      setExportSuccess({
        id: spreadsheetId,
        url: spreadsheet.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
        title: templateTitle,
        itemsCount: 3,
        isTemplate: true
      });

      fetchSpreadsheets();
    } catch (err: any) {
      setExportError(err.message || "Erro ao criar modelo.");
    } finally {
      setIsExporting(false);
    }
  };

  // Analyze and Fetch rows from a selected Spreadsheet for Import
  const handleAnalyzeSheet = async () => {
    if (!selectedSheetId) {
      setImportError("Selecione uma folha de cálculo primeiro.");
      return;
    }

    setIsAnalyzing(true);
    setImportError(null);
    setAnalyzedData(null);
    setImportPreviewStudents([]);
    setImportSuccessMessage(null);

    try {
      // Fetch metadata to find the first sheet's real name if needed
      const metadataRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${selectedSheetId}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (!metadataRes.ok) {
        throw new Error("Não foi possível aceder ao ficheiro selecionado. Verifique as permissões de acesso.");
      }

      const metadata = await metadataRes.json();
      const firstSheetTitle = metadata.sheets?.[0]?.properties?.title || "Sheet1";
      setSelectedSheetName(firstSheetTitle);

      // Fetch values of the sheet
      const rangeToFetch = `${firstSheetTitle}!${customRange}`;
      const valuesRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${selectedSheetId}/values/${encodeURIComponent(rangeToFetch)}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });

      if (!valuesRes.ok) {
        throw new Error(`Falha ao ler os dados da folha '${rangeToFetch}'. Certifique-se de que o intervalo existe.`);
      }

      const data = await valuesRes.json();
      const rows: any[][] = data.values || [];

      if (rows.length === 0) {
        throw new Error("A folha de cálculo está vazia.");
      }

      setAnalyzedData(rows);

      // Parse students preview
      const headers = rows[0].map((h: string) => h?.toLowerCase().trim());
      
      // Match columns by title heuristic
      const colIdx = {
        name: headers.findIndex((h: string) => h.includes('nome') || h.includes('name') || h.includes('student')),
        class: headers.findIndex((h: string) => h.includes('turma') || h.includes('class') || h.includes('grade')),
        avgGrade: headers.findIndex((h: string) => h.includes('média') || h.includes('media') || h.includes('grade') || h.includes('nota')),
        attendance: headers.findIndex((h: string) => h.includes('falta') || h.includes('presen') || h.includes('attendance')),
        behavior: headers.findIndex((h: string) => h.includes('comport') || h.includes('behavior')),
        guardian: headers.findIndex((h: string) => h.includes('encarregado') || h.includes('guardian') || h.includes('respons')),
        contact: headers.findIndex((h: string) => h.includes('contact') || h.includes('tlm') || h.includes('telef') || h.includes('fone')),
        fees: headers.findIndex((h: string) => h.includes('propina') || h.includes('fee') || h.includes('atraso') || h.includes('outstanding'))
      };

      const parsedStudents: Partial<Student>[] = [];

      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        if (!row || row.length === 0 || !row[colIdx.name || 0]) continue;

        const name = row[colIdx.name] || `Aluno Desconhecido #${r}`;
        const className = colIdx.class !== -1 ? String(row[colIdx.class] || "10ºA") : "10ºA";
        
        let avgGrade = 7.0;
        if (colIdx.avgGrade !== -1 && row[colIdx.avgGrade]) {
          const parsed = parseFloat(String(row[colIdx.avgGrade]).replace(',', '.'));
          if (!isNaN(parsed)) avgGrade = parsed;
        }

        let attendance = 90;
        if (colIdx.attendance !== -1 && row[colIdx.attendance]) {
          const parsed = parseFloat(String(row[colIdx.attendance]).replace('%', '').trim());
          if (!isNaN(parsed)) attendance = parsed;
        }

        let behavior: any = 'Excelente';
        if (colIdx.behavior !== -1 && row[colIdx.behavior]) {
          const rawBeh = String(row[colIdx.behavior]).toLowerCase();
          if (rawBeh.includes('excelente')) behavior = 'Excelente';
          else if (rawBeh.includes('bom')) behavior = 'Bom';
          else if (rawBeh.includes('regular')) behavior = 'Regular';
          else if (rawBeh.includes('aten') || rawBeh.includes('atencao')) behavior = 'Atenção';
        }

        const guardianName = colIdx.guardian !== -1 ? String(row[colIdx.guardian] || "Encarregado") : "Encarregado";
        const guardianContact = colIdx.contact !== -1 ? String(row[colIdx.contact] || "N/A") : "N/A";
        
        let fees = 0;
        if (colIdx.fees !== -1 && row[colIdx.fees]) {
          const parsed = parseFloat(String(row[colIdx.fees]).replace('€', '').trim());
          if (!isNaN(parsed)) fees = parsed;
        }

        parsedStudents.push({
          id: `ALU-${Math.floor(1000 + Math.random() * 9000)}`,
          name: String(name),
          class: className,
          averageGrade: avgGrade,
          attendanceRate: attendance,
          status: 'active',
          outstandingFees: fees,
          guardiansName: guardianName,
          guardiansContact: guardianContact,
          behaviorDegree: behavior,
          documents: [],
          behaviorHistory: [],
          grades: []
        });
      }

      if (parsedStudents.length === 0) {
        throw new Error("Não foi possível extrair nenhum aluno. Verifique se os cabeçalhos das colunas incluem nomes reconhecíveis como 'Nome' ou 'Nome Completo'.");
      }

      setImportPreviewStudents(parsedStudents);
    } catch (err: any) {
      console.error(err);
      setImportError(err.message || "Erro ao analisar folha.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Perform import of parsed students into state
  const handleImportStudents = () => {
    if (importPreviewStudents.length === 0) return;

    setIsImporting(true);
    try {
      const confirmImport = window.confirm(`Tem a certeza que deseja importar ${importPreviewStudents.length} alunos para a base de dados escolar?`);
      if (!confirmImport) {
        setIsImporting(false);
        return;
      }

      setStudents(prev => {
        // Prevent importing exact duplicates by name
        const filteredNew = importPreviewStudents.filter(
          newSt => !prev.some(oldSt => oldSt.name.toLowerCase() === newSt.name?.toLowerCase())
        ) as Student[];

        return [...filteredNew, ...prev];
      });

      setImportSuccessMessage(`Sucesso! Foram importados e inscritos ${importPreviewStudents.length} novos alunos no Nexus Edu AI.`);
      setImportPreviewStudents([]);
      setAnalyzedData(null);
    } catch (err: any) {
      setImportError(err?.message || "Erro ao sincronizar alunos.");
    } finally {
      setIsImporting(false);
    }
  };

  const filteredSheets = sheetsList.filter(file => 
    file.name.toLowerCase().includes(sheetsSearch.toLowerCase())
  );

  return (
    <div id="google-sheets-center" className="w-full space-y-6">
      
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl">
            <FileSpreadsheet className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
              Sincronização Google Sheets
              <span className="px-2 py-0.5 text-xs font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full">
                Oficial API
              </span>
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              Ferramenta avançada para exportar bases de dados letivas, criar folhas de cálculo e importar alunos em massa.
            </p>
          </div>
        </div>

        {/* GOOGLE PROFILE & AUTH BUTTON */}
        <div>
          {googleUser && accessToken ? (
            <div className="flex items-center gap-3 bg-slate-950 p-2 pl-3 pr-4 border border-slate-800 rounded-full">
              {googleUser.photoURL ? (
                <img 
                  referrerPolicy="no-referrer" 
                  src={googleUser.photoURL} 
                  alt="Google Avatar" 
                  className="w-8 h-8 rounded-full border border-slate-700" 
                />
              ) : (
                <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center text-white text-xs font-semibold">
                  {googleUser.displayName?.[0] || 'G'}
                </div>
              )}
              <div className="text-left hidden sm:block">
                <p className="text-xs font-medium text-slate-200">{googleUser.displayName}</p>
                <p className="text-[10px] text-slate-400 font-mono">{googleUser.email}</p>
              </div>
              <button 
                onClick={handleDisconnectGoogle}
                className="ml-2 text-xs font-mono px-3 py-1 bg-rose-500/10 text-rose-400 hover:bg-rose-500 hover:text-white transition duration-200 border border-rose-500/20 rounded-full cursor-pointer"
              >
                Sair
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnectGoogle}
              disabled={isConnecting}
              className="flex items-center gap-2.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl border border-emerald-500 shadow-lg shadow-emerald-950/20 active:scale-95 transition cursor-pointer disabled:opacity-50"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>A ligar à Google...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
                  </svg>
                  <span>Ativar Google Sheets</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {authError && (
        <div className="flex items-center gap-3 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{authError}</p>
        </div>
      )}

      {/* NOT AUTHENTICATED STATE COMPONENT */}
      {!accessToken ? (
        <div className="flex flex-col items-center justify-center p-12 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-4">
          <div className="p-4 bg-slate-950 border border-slate-800 text-slate-500 rounded-full">
            <FileSpreadsheet className="w-12 h-12" />
          </div>
          <div className="max-w-md">
            <h3 className="text-lg font-medium text-slate-200">Ligue a sua Conta Google</h3>
            <p className="text-sm text-slate-400 mt-2">
              Para aceder às funcionalidades de exportação direta de alunos, pautas de avaliação, faturas e sincronização em tempo real, ligue o Nexus Edu AI de forma segura ao Google Drive.
            </p>
          </div>
          <button 
            onClick={handleConnectGoogle}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl flex items-center gap-2 active:scale-95 transition cursor-pointer"
          >
            <UserCheck className="w-5 h-5" />
            Conectar com Google
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* EXPORT WORKSPACE (LEFT COLUMN) */}
          <div className="lg:col-span-6 space-y-6">
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-6">
              
              <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
                <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
                  <CloudUpload className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-200">Exportar para o Google Sheets</h2>
                  <p className="text-xs text-slate-400">Criar uma nova folha de cálculo no seu Drive com dados em tempo real.</p>
                </div>
              </div>

              {/* Title Form */}
              <div className="space-y-2">
                <label className="text-xs font-mono text-slate-400">Título da Folha de Cálculo</label>
                <input 
                  type="text" 
                  value={customTitle} 
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-slate-200 focus:outline-none focus:border-emerald-500"
                />
              </div>

              {/* Export Type Selector */}
              <div className="space-y-2">
                <label className="text-xs font-mono text-slate-400">Selecione o Conjunto de Dados</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setExportType('all')}
                    className={`p-3 text-xs rounded-xl border text-center transition cursor-pointer font-medium flex flex-col items-center justify-center gap-2 ${
                      exportType === 'all' 
                        ? 'bg-emerald-600/10 border-emerald-500 text-emerald-400' 
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Database className="w-4 h-4" />
                    <span>Tudo (Alunos + Faturas)</span>
                  </button>

                  <button
                    onClick={() => setExportType('students')}
                    className={`p-3 text-xs rounded-xl border text-center transition cursor-pointer font-medium flex flex-col items-center justify-center gap-2 ${
                      exportType === 'students' 
                        ? 'bg-emerald-600/10 border-emerald-500 text-emerald-400' 
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <UserCheck2 className="w-4 h-4" />
                    <span>Apenas Alunos</span>
                  </button>

                  <button
                    onClick={() => setExportType('financials')}
                    className={`p-3 text-xs rounded-xl border text-center transition cursor-pointer font-medium flex flex-col items-center justify-center gap-2 ${
                      exportType === 'financials' 
                        ? 'bg-emerald-600/10 border-emerald-500 text-emerald-400' 
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <FileText className="w-4 h-4" />
                    <span>Apenas Faturas</span>
                  </button>
                </div>
              </div>

              {/* Active data summary */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <h4 className="text-xs font-medium text-slate-300">Resumo dos dados escolares ativos:</h4>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <p className="text-slate-400">Total de Alunos:</p>
                    <p className="text-base font-semibold text-slate-200 mt-0.5">{students.length}</p>
                  </div>
                  <div>
                    <p className="text-slate-400">Total de Faturas:</p>
                    <p className="text-base font-semibold text-slate-200 mt-0.5">{invoices.length}</p>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={handleExportData}
                  disabled={isExporting}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 active:scale-95 transition cursor-pointer disabled:opacity-50"
                >
                  {isExporting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>A Exportar...</span>
                    </>
                  ) : (
                    <>
                      <CloudUpload className="w-4 h-4" />
                      <span>Criar e Exportar Folha</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleCreateTemplate}
                  disabled={isExporting}
                  className="py-3 px-4 bg-slate-950 border border-slate-800 text-slate-300 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 hover:border-slate-700 active:scale-95 transition cursor-pointer disabled:opacity-50"
                  title="Criar folha modelo para preenchimento de alunos"
                >
                  <CloudDownload className="w-4 h-4 text-slate-400" />
                  <span>Gerar Modelo de Importação</span>
                </button>
              </div>

              {/* Success Notification */}
              {exportSuccess && (
                <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 rounded-xl space-y-3">
                  <div className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-semibold text-emerald-300">
                        {exportSuccess.isTemplate ? "Modelo Criado!" : "Exportação Concluída!"}
                      </h4>
                      <p className="text-[11px] text-slate-300 mt-1">
                        O ficheiro <strong className="text-slate-100">"{exportSuccess.title}"</strong> foi gerado no seu Google Drive com {exportSuccess.itemsCount} registos.
                      </p>
                    </div>
                  </div>
                  <a 
                    href={exportSuccess.url} 
                    target="_blank" 
                    rel="noreferrer"
                    className="flex items-center justify-center gap-1.5 w-full py-2 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400 text-xs font-medium rounded-lg transition"
                  >
                    <span>Abrir Folha de Cálculo</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              )}

              {exportError && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p>{exportError}</p>
                </div>
              )}

            </div>
          </div>

          {/* IMPORT WORKSPACE (RIGHT COLUMN) */}
          <div className="lg:col-span-6 space-y-6">
            <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-6">
              
              <div className="flex items-center gap-3 pb-4 border-b border-slate-800">
                <div className="p-2 bg-indigo-500/10 text-indigo-400 rounded-lg">
                  <CloudDownload className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-slate-200">Importar Alunos via Google Sheets</h2>
                  <p className="text-xs text-slate-400">Ler e inscrever alunos a partir de uma folha de cálculo no Drive.</p>
                </div>
              </div>

              {/* SHEET SELECTOR FROM USER DRIVE */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono text-slate-400">Selecionar do Google Drive</label>
                  <button 
                    onClick={() => fetchSpreadsheets()}
                    className="text-[10px] flex items-center gap-1 text-emerald-400 font-mono hover:underline cursor-pointer"
                  >
                    <RefreshCw className="w-2.5 h-2.5" /> Atualizar Drive
                  </button>
                </div>

                {isLoadingSheets ? (
                  <div className="flex items-center justify-center p-6 bg-slate-950 border border-slate-800 rounded-xl">
                    <Loader2 className="w-5 h-5 text-emerald-400 animate-spin" />
                    <span className="text-xs text-slate-400 ml-2">A ler ficheiros do Drive...</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Search filter for Drive files */}
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
                      <input 
                        type="text" 
                        placeholder="Pesquisar folhas de cálculo..." 
                        value={sheetsSearch}
                        onChange={(e) => setSheetsSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                      />
                    </div>

                    <div className="max-h-48 overflow-y-auto bg-slate-950 border border-slate-800 rounded-xl divide-y divide-slate-900 scrollbar-thin">
                      {filteredSheets.length === 0 ? (
                        <div className="p-4 text-center text-xs text-slate-500">
                          Nenhuma folha de cálculo encontrada no Google Drive.
                        </div>
                      ) : (
                        filteredSheets.map(file => (
                          <div 
                            key={file.id}
                            onClick={() => setSelectedSheetId(file.id)}
                            className={`p-3 text-left transition cursor-pointer flex items-center justify-between ${
                              selectedSheetId === file.id 
                                ? 'bg-emerald-600/10 border-l-2 border-emerald-500' 
                                : 'hover:bg-slate-900'
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <SheetIcon className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                              <div className="truncate">
                                <p className="text-xs font-medium text-slate-300 truncate">{file.name}</p>
                                <p className="text-[10px] text-slate-500 mt-0.5">
                                  Modificado: {new Date(file.modifiedTime).toLocaleDateString('pt-PT')}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 ml-2">
                              <a 
                                href={file.webViewLink} 
                                target="_blank" 
                                rel="noreferrer"
                                className="p-1 bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800 rounded hover:bg-slate-850"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Range & Analysis Options */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-slate-400">Intervalo de Leitura</label>
                  <input 
                    type="text" 
                    value={customRange}
                    onChange={(e) => setCustomRange(e.target.value)}
                    placeholder="ex. A1:H100"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={handleAnalyzeSheet}
                    disabled={isAnalyzing || !selectedSheetId}
                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:hover:bg-indigo-600 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition active:scale-95 cursor-pointer"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>A Analisar...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Analisar Folha</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {importError && (
                <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p>{importError}</p>
                </div>
              )}

              {importSuccessMessage && (
                <div className="p-4 bg-emerald-950/20 border border-emerald-500/30 text-emerald-400 text-xs rounded-xl flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                  <p>{importSuccessMessage}</p>
                </div>
              )}

            </div>
          </div>

          {/* VISUAL PREVIEW BLOCK (FULL WIDTH IF ANALYZED DATA EXISTS) */}
          {importPreviewStudents.length > 0 && (
            <div className="col-span-12 p-6 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
                    <Info className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-200">
                      Pré-Visualização de Importação ({importPreviewStudents.length} Alunos Detetados)
                    </h3>
                    <p className="text-xs text-slate-400">Verifique a conformidade das colunas antes de confirmar a importação permanente.</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setImportPreviewStudents([]);
                      setAnalyzedData(null);
                    }}
                    className="px-4 py-2 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-400 text-xs font-semibold rounded-xl transition cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleImportStudents}
                    disabled={isImporting}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition cursor-pointer active:scale-95"
                  >
                    {isImporting ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    )}
                    <span>Importar Alunos para o Sistema</span>
                  </button>
                </div>
              </div>

              {/* Table rendering of the spreadsheet preview */}
              <div className="overflow-x-auto border border-slate-800 rounded-xl">
                <table className="w-full text-left text-xs divide-y divide-slate-800">
                  <thead className="bg-slate-950 text-slate-400">
                    <tr>
                      <th className="px-4 py-3 font-medium">Nome Completo</th>
                      <th className="px-4 py-3 font-medium">Turma</th>
                      <th className="px-4 py-3 font-medium">Média Notas</th>
                      <th className="px-4 py-3 font-medium">Presenças</th>
                      <th className="px-4 py-3 font-medium">Comportamento</th>
                      <th className="px-4 py-3 font-medium">Encarregado</th>
                      <th className="px-4 py-3 font-medium">Contacto</th>
                      <th className="px-4 py-3 font-medium">Propinas em Atraso</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50 bg-slate-950/20">
                    {importPreviewStudents.map((student, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/30">
                        <td className="px-4 py-2.5 font-medium text-slate-200">{student.name}</td>
                        <td className="px-4 py-2.5 text-slate-300 font-mono">{student.class}</td>
                        <td className="px-4 py-2.5">
                          <span className={`px-2 py-0.5 rounded font-mono text-[11px] font-medium ${
                            (student.averageGrade || 0) >= 7 
                              ? 'bg-emerald-500/10 text-emerald-400' 
                              : (student.averageGrade || 0) >= 5 
                              ? 'bg-amber-500/10 text-amber-400' 
                              : 'bg-rose-500/10 text-rose-400'
                          }`}>
                            {student.averageGrade?.toFixed(1)} / 10
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-300 font-mono">{student.attendanceRate}%</td>
                        <td className="px-4 py-2.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                            student.behaviorDegree === 'Excelente' ? 'bg-emerald-500/15 text-emerald-400' :
                            student.behaviorDegree === 'Bom' ? 'bg-indigo-500/15 text-indigo-400' :
                            student.behaviorDegree === 'Regular' ? 'bg-amber-500/15 text-amber-400' :
                            'bg-rose-500/15 text-rose-400'
                          }`}>
                            {student.behaviorDegree}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-slate-400">{student.guardiansName}</td>
                        <td className="px-4 py-2.5 text-slate-400 font-mono">{student.guardiansContact}</td>
                        <td className="px-4 py-2.5 text-rose-400 font-mono font-semibold">
                          {student.outstandingFees ? `€${student.outstandingFees.toFixed(2)}` : '€0.00'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>
          )}

        </div>
      )}

    </div>
  );
}
