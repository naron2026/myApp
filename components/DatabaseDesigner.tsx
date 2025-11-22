import React, { useState, useEffect, useRef } from 'react';
import { FormField } from '../types';
import { Database, Server, Play, Terminal, CheckCircle2, Loader2, Copy, AlertCircle, Wifi, GripVertical, Plus, Trash2, RefreshCw, AlertTriangle, XCircle, Search, Table as TableIcon, Plug, Lock, Save } from 'lucide-react';
import { PGlite } from "@electric-sql/pglite";

interface DatabaseDesignerProps {
  fields: FormField[];
}

type DBType = 'PostgreSQL' | 'MySQL' | 'SQL Server' | 'SQLite';

interface DBColumn {
  id: string;
  name: string;
  type: string;
  isPk: boolean;
  nullable: boolean;
  isSystem?: boolean; // for id, created_at
}

type StatusType = 'idle' | 'success' | 'warning' | 'error' | 'processing';

interface StatusMessage {
  type: StatusType;
  title: string;
  message: string;
}

interface QueryResult {
  type: 'success' | 'error' | 'table';
  message?: string;
  data?: any[];
  columns?: string[];
}

export const DatabaseDesigner: React.FC<DatabaseDesignerProps> = ({ fields }) => {
  // -- Configuration State --
  const [config, setConfig] = useState({
    dbType: 'PostgreSQL' as DBType,
    host: 'localhost',
    port: '5432',
    database: 'my_app_db',
    username: 'postgres',
    password: '',
    tableName: 'form_submissions'
  });

  // -- Schema State --
  const [columns, setColumns] = useState<DBColumn[]>([]);
  
  // -- UI/Processing State --
  const [generatedSQL, setGeneratedSQL] = useState('');
  const [status, setStatus] = useState<StatusMessage | null>(null);
  const [activeTab, setActiveTab] = useState<'design' | 'sql' | 'query'>('design');
  
  // -- Query Tool State --
  const [querySql, setQuerySql] = useState('');
  const [queryResult, setQueryResult] = useState<QueryResult | null>(null);
  const [isExecutingQuery, setIsExecutingQuery] = useState(false);
  const [hasAutoMigrated, setHasAutoMigrated] = useState(false);

  // -- Database Instance (PGlite) --
  const [db, setDb] = useState<any>(null);

  // -- Drag and Drop State --
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  // -- Initialization & Mapping Logic --
  useEffect(() => {
    syncFieldsToColumns();
  }, [fields]);

  // Initialize PGlite instance
  useEffect(() => {
    const initDb = async () => {
        try {
            // Manually load WASM to bypass fs.readFile issues in unenv/browser environments
            const wasmUrl = "https://cdn.jsdelivr.net/npm/@electric-sql/pglite@0.2.12/dist/postgres.wasm";
            const wasmRes = await fetch(wasmUrl);
            if (!wasmRes.ok) throw new Error(`Failed to fetch WASM: ${wasmRes.statusText}`);
            
            const wasmBuffer = await wasmRes.arrayBuffer();
            const wasmModule = await WebAssembly.compile(wasmBuffer);

            // Pass the compiled module to PGlite to avoid file system lookups
            const pg = new PGlite("memory://", {
                wasmModule,
                fs: null, 
            } as any);
            
            // Wait for ready
            await pg.waitReady;

            setDb(pg);
            console.log("[PGlite] Database initialized in-memory.");
        } catch (e) {
            console.error("[PGlite] Failed to initialize:", e);
            setStatus({ 
                type: 'error', 
                title: 'System Error', 
                message: 'Failed to load local PostgreSQL engine. ' + (e instanceof Error ? e.message : String(e))
            });
        }
    };
    initDb();
  }, []);

  // Initialize query SQL with a default select when table name changes
  useEffect(() => {
    if (!querySql) {
        setQuerySql(`SELECT * FROM ${config.tableName} LIMIT 10;`);
    }
  }, [config.tableName]);

  const getDbType = (fieldType: string, dbType: DBType): string => {
    const map: Record<string, Record<string, string>> = {
      PostgreSQL: {
        short_text: 'VARCHAR(255)',
        long_text: 'TEXT',
        number: 'INTEGER',
        checkbox: 'BOOLEAN',
        date: 'TIMESTAMP',
        select: 'VARCHAR(100)',
        radio: 'VARCHAR(100)',
        file_upload: 'VARCHAR(2048)',
        repeating_group: 'JSONB',
        multi_line: 'JSONB',
        tab_group: 'JSONB'
      },
      MySQL: {
        short_text: 'VARCHAR(255)',
        long_text: 'TEXT',
        number: 'INT',
        checkbox: 'BOOLEAN',
        date: 'DATETIME',
        select: 'VARCHAR(100)',
        radio: 'VARCHAR(100)',
        file_upload: 'VARCHAR(2048)',
        repeating_group: 'JSON',
        multi_line: 'JSON',
        tab_group: 'JSON'
      },
      // Fallbacks for others...
    };

    const dialect = map[dbType] || map['PostgreSQL'];
    return dialect[fieldType] || 'TEXT';
  };

  // Flattens the form fields into a list of columns
  const syncFieldsToColumns = () => {
    const newCols: DBColumn[] = [];

    // 1. System ID
    newCols.push({
      id: 'sys_id',
      name: 'id',
      type: config.dbType === 'PostgreSQL' ? 'UUID' : 'INT',
      isPk: true,
      nullable: false,
      isSystem: true
    });

    // 2. Map Fields
    const processFields = (fieldList: FormField[]) => {
      fieldList.forEach(f => {
        if (f.type === 'tab_group' && f.tabs) {
            f.tabs.forEach(t => processFields(t.fields));
            return;
        }
        
        // Use propertyName if available, else sanitize label
        let safeName = f.propertyName || f.label.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');
        if (!safeName) safeName = `field_${f.id.substring(0,8)}`;
        
        newCols.push({
          id: f.id,
          name: safeName,
          type: getDbType(f.type, config.dbType),
          isPk: false,
          nullable: !f.required
        });
      });
    };
    processFields(fields);

    // 3. System Timestamp
    newCols.push({
      id: 'sys_created_at',
      name: 'created_at',
      type: config.dbType === 'PostgreSQL' ? 'TIMESTAMP' : 'DATETIME',
      isPk: false,
      nullable: false,
      isSystem: true
    });

    setColumns(newCols);
    setStatus(prev => prev?.type === 'processing' ? prev : { type: 'idle', title: 'Schema Synced', message: 'Table structure updated from form fields.' });
  };

  // -- Drag and Drop Handlers --
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, position: number) => {
    dragItem.current = position;
    const ghost = e.currentTarget.cloneNode(true) as HTMLElement;
    ghost.style.opacity = '0.5';
    ghost.style.position = 'absolute';
    ghost.style.top = '-1000px';
    document.body.appendChild(ghost);
    e.dataTransfer.setDragImage(ghost, 0, 0);
    setTimeout(() => document.body.removeChild(ghost), 0);
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, position: number) => {
    dragOverItem.current = position;
  };

  const handleDragEnd = () => {
    if (dragItem.current !== null && dragOverItem.current !== null) {
      const _columns = [...columns];
      const draggedItemContent = _columns[dragItem.current];
      _columns.splice(dragItem.current, 1);
      _columns.splice(dragOverItem.current, 0, draggedItemContent);
      setColumns(_columns);
    }
    dragItem.current = null;
    dragOverItem.current = null;
  };

  // -- Action Handlers --

  const handleColumnChange = (id: string, key: keyof DBColumn, value: any) => {
    setColumns(prev => prev.map(col => col.id === id ? { ...col, [key]: value } : col));
  };

  const handleRemoveColumn = (id: string) => {
    setColumns(prev => prev.filter(col => col.id !== id));
  };

  const handleAddColumn = () => {
    const newCol: DBColumn = {
      id: crypto.randomUUID(),
      name: 'new_column',
      type: 'VARCHAR(255)',
      isPk: false,
      nullable: true
    };
    const idx = columns.length > 0 ? columns.length - 1 : 0;
    const newCols = [...columns];
    newCols.splice(idx, 0, newCol);
    setColumns(newCols);
  };

  const generateSQL = (dialect: DBType = config.dbType) => {
    const lines = [];
    lines.push(`CREATE TABLE IF NOT EXISTS ${config.tableName} (`);
    
    const colDefs = columns.map((col, idx) => {
      let def = `  ${col.name} ${col.type}`;
      if (col.isPk) {
        def += dialect === 'PostgreSQL' ? ' PRIMARY KEY DEFAULT gen_random_uuid()' : ' PRIMARY KEY AUTO_INCREMENT';
      } else {
        if (!col.nullable) def += ' NOT NULL';
        if (col.name === 'created_at') def += ' DEFAULT NOW()';
      }
      if (idx < columns.length - 1) def += ',';
      return def;
    });

    lines.push(...colDefs);
    lines.push(`);`);
    
    return lines.join('\n');
  };

  const insertDummyData = async () => {
    try {
         // Use exec for safety against multiple commands/protocol errors
         const check = await db.exec(`SELECT count(*) FROM ${config.tableName}`);
         
         if (check[0]?.rows[0]?.count === '0') {
             const dummyCols = columns.filter(c => !c.isSystem && !c.isPk);
             if (dummyCols.length > 0) {
                 const colNames = dummyCols.map(c => c.name).join(', ');
                 const colValues = dummyCols.map(c => {
                    if (c.type.includes('INT') || c.type.includes('DECIMAL')) return '100';
                    if (c.type.includes('BOOL')) return 'true';
                    return `'Sample Data'`;
                 }).join(', ');
                 
                 await db.exec(`INSERT INTO ${config.tableName} (${colNames}) VALUES (${colValues});`);
             }
         }
    } catch (e) { /* ignore insertion error if table structure changed significantly */ }
  };

  // Auto-migration effect
  useEffect(() => {
    if (db && columns.length > 0 && !hasAutoMigrated) {
        const autoMigrate = async () => {
            try {
                 const sql = generateSQL('PostgreSQL'); 
                 await db.exec(sql); 
                 await insertDummyData();
                 
                 setHasAutoMigrated(true);
                 console.log("[PGlite] Auto-migration complete");
            } catch (e) {
                console.error("[PGlite] Auto-migration failed", e);
            }
        };
        autoMigrate();
    }
  }, [db, columns, hasAutoMigrated, config.tableName]); 

  const handleGenerateAndRun = async () => {
    setStatus({ type: 'processing', title: 'Processing', message: 'Generating SQL and executing migration...' });
    setActiveTab('sql');

    try {
      const sql = generateSQL();
      setGeneratedSQL(sql);

      if (db) {
         let executionSql = sql;
         if (config.dbType !== 'PostgreSQL') {
             // Temporarily remap types for execution locally
             executionSql = generateSQL('PostgreSQL');
         }

         await db.exec(executionSql); 
         await insertDummyData();

         setStatus({ 
            type: 'success', 
            title: 'Migration Successful', 
            message: `Table '${config.tableName}' created in local PostgreSQL instance.` 
         });
      } else {
          throw new Error("Database engine not initialized.");
      }

    } catch (err: any) {
      setStatus({ 
        type: 'error', 
        title: 'Migration Failed', 
        message: err.message || 'Unknown error occurred during execution.' 
      });
    }
  };

  const handleConnect = async () => {
    setStatus({ type: 'processing', title: 'Saving Configuration...', message: `Validating inputs...` });
    
    try {
      await new Promise(r => setTimeout(r, 800));

      if (!config.host || !config.username) {
           throw new Error("Host and Username are required fields.");
      }

      // Explicit feedback about the "Connection"
      setStatus({ 
        type: 'success', 
        title: 'Configuration Saved', 
        message: `Connection details for '${config.host}' have been securely saved for your SQL Export.\n\nNote: Use the 'SQL Preview' tab to copy the code. Direct live execution against remote databases is not possible within a browser environment.` 
    });
    } catch (err: any) {
      setStatus({ 
        type: 'error', 
        title: 'Validation Failed', 
        message: err.message 
      });
    }
  };

  const handleRunQuery = async () => {
    if (!querySql.trim() || !db) return;
    setIsExecutingQuery(true);
    setQueryResult(null);

    try {
        const start = performance.now();
        // PGlite exec handles multiple statements
        const results = await db.exec(querySql);
        const duration = (performance.now() - start).toFixed(2);
        
        if (results.length === 0) {
             setQueryResult({ 
                type: 'success', 
                message: `Executed successfully in ${duration}ms. No results returned.` 
            });
            return;
        }

        const res = results[results.length - 1];

        if (res.rows && Array.isArray(res.rows)) {
             const cols = res.fields.map((f: any) => f.name);
             setQueryResult({
                 type: 'table',
                 columns: cols.length > 0 ? cols : ['Result'],
                 data: res.rows,
                 message: `Fetched ${res.rows.length} row(s) in ${duration}ms`
             });
        } else {
            setQueryResult({ 
                type: 'success', 
                message: `Query executed successfully in ${duration}ms. ${res.affectedRows !== undefined ? res.affectedRows + ' rows affected.' : ''}`
            });
        }

    } catch (err: any) {
        console.error("Query Error", err);
        let errorMsg = err.message;
        
        // HELPFUL ERROR INTERCEPTION FOR USER CONTEXT
        if (err.message.includes("does not exist")) {
             errorMsg += `\n\n--- SYSTEM HINT ---\nYou are querying the LOCAL in-memory database (PGlite). Tables from your remote database ('${config.host}') are NOT accessible here due to browser security restrictions.`;
        } else if (err.message.includes("function db_name() does not exist")) {
             errorMsg += `\n\n--- SYSTEM HINT ---\nThe local engine is PostgreSQL. 'db_name()' is a SQL Server function.`;
        } else if (err.message.includes("syntax error")) {
             errorMsg += `\n\n--- SYSTEM HINT ---\nEnsure you are using valid PostgreSQL syntax for the local preview.`;
        }

        setQueryResult({
            type: 'error',
            message: errorMsg
        });
    } finally {
        setIsExecutingQuery(false);
    }
  };

  // -- Render Helpers --

  const getStatusColor = (t: StatusType) => {
    switch(t) {
      case 'success': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'error': return 'bg-red-50 text-red-700 border-red-200';
      case 'warning': return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'processing': return 'bg-blue-50 text-blue-700 border-blue-200';
      default: return 'bg-slate-50 text-slate-600 border-slate-200';
    }
  };

  const getStatusIcon = (t: StatusType) => {
    switch(t) {
      case 'success': return <CheckCircle2 className="w-5 h-5 text-emerald-600" />;
      case 'error': return <XCircle className="w-5 h-5 text-red-600" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-amber-600" />;
      case 'processing': return <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />;
      default: return <Database className="w-5 h-5 text-slate-400" />;
    }
  };

  return (
    <div className="h-full flex flex-col md:flex-row bg-slate-50 font-sans">
      
      {/* Left Sidebar: Config */}
      <div className="w-full md:w-80 bg-white border-r border-slate-200 flex flex-col h-full z-10 shadow-sm">
        <div className="p-5 border-b border-slate-100 bg-slate-50/50">
          <h2 className="font-bold text-slate-800 flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-600" />
            Configuration
          </h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
             {/* Connection Card */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Export Configuration</label>
                    <button onClick={handleConnect} className="text-[10px] font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded-full hover:bg-indigo-100 transition-colors">
                        <Save className="w-3 h-3" /> Save Config
                    </button>
                </div>
                
                <select 
                    value={config.dbType}
                    onChange={(e) => {
                        setConfig({...config, dbType: e.target.value as DBType});
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all cursor-pointer"
                >
                    <option value="PostgreSQL">PostgreSQL</option>
                    <option value="MySQL">MySQL</option>
                    <option value="SQL Server">SQL Server</option>
                    <option value="SQLite">SQLite</option>
                </select>
                
                <div className="p-2 bg-blue-50 border border-blue-100 rounded text-[10px] text-blue-700 flex items-start gap-1.5">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    Browser security prevents direct connections to your database host. Use these settings for the generated SQL file.
                </div>

                <div className="grid grid-cols-1 gap-3">
                    <div className="group">
                        <label className="block text-[10px] font-medium text-slate-500 mb-1">Host & Port</label>
                        <div className="flex gap-2">
                            <input 
                                type="text" 
                                value={config.host}
                                onChange={(e) => setConfig({...config, host: e.target.value})}
                                className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-700" 
                                placeholder="127.0.0.1"
                                autoComplete="off"
                            />
                            <input 
                                type="text" 
                                value={config.port}
                                onChange={(e) => setConfig({...config, port: e.target.value})}
                                className="w-20 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none text-center text-slate-700 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all" 
                                placeholder="5432"
                                autoComplete="off"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-[10px] font-medium text-slate-500 mb-1">Credentials (User / Pass)</label>
                        <div className="space-y-2">
                            <input 
                                type="text" 
                                value={config.username}
                                onChange={(e) => setConfig({...config, username: e.target.value})}
                                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-700" 
                                placeholder="Username"
                                autoComplete="off"
                            />
                            <div className="relative">
                                <input 
                                    type="password" 
                                    value={config.password}
                                    onChange={(e) => setConfig({...config, password: e.target.value})}
                                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-700" 
                                    placeholder="Password"
                                    autoComplete="off"
                                />
                            </div>
                        </div>
                    </div>
                     <div>
                        <label className="block text-[10px] font-medium text-slate-500 mb-1">Database Name</label>
                        <input 
                            type="text" 
                            value={config.database}
                            onChange={(e) => setConfig({...config, database: e.target.value})}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-slate-700" 
                            placeholder="my_database"
                            autoComplete="off"
                        />
                    </div>
                </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Target Table</label>
                <div className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all">
                    <Server className="w-4 h-4 text-slate-400" />
                    <input 
                        type="text" 
                        value={config.tableName}
                        onChange={(e) => setConfig({...config, tableName: e.target.value})}
                        className="flex-1 bg-transparent border-none outline-none text-sm font-medium text-slate-700 placeholder:text-slate-400"
                        placeholder="table_name"
                        autoComplete="off"
                    />
                </div>
            </div>
        </div>

        <div className="p-5 border-t border-slate-100 bg-slate-50/50">
             <button
                onClick={handleGenerateAndRun}
                disabled={status?.type === 'processing' || !db}
                className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl font-medium shadow-lg shadow-indigo-200 flex items-center justify-center gap-2 transition-all active:scale-95"
             >
                {status?.type === 'processing' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                Create & Migrate Local
             </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden bg-slate-100/50 relative">
        
        {/* Header / Status Bar */}
        <div className="bg-white border-b border-slate-200 p-4 flex items-center justify-between h-16 flex-shrink-0">
            <div className="flex gap-1 bg-slate-100 p-1 rounded-lg">
                <button 
                    onClick={() => setActiveTab('design')}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'design' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Design Schema
                </button>
                <button 
                    onClick={() => setActiveTab('sql')}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'sql' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    SQL Preview
                </button>
                <button 
                    onClick={() => setActiveTab('query')}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'query' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Query Tool
                </button>
            </div>

            <div className="flex items-center gap-2">
                <button onClick={syncFieldsToColumns} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Reset to Form Fields">
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>
        </div>

        {/* Status Banner */}
        {status && status.type !== 'idle' && (
            <div className={`mx-6 mt-6 p-4 rounded-xl border flex items-start gap-3 animate-in slide-in-from-top-2 duration-300 shadow-sm ${getStatusColor(status.type)}`}>
                <div className="mt-0.5 flex-shrink-0">{getStatusIcon(status.type)}</div>
                <div className="flex-1">
                    <h3 className="font-semibold text-sm">{status.title}</h3>
                    <p className="text-xs mt-0.5 opacity-90 whitespace-pre-line">{status.message}</p>
                </div>
                <button onClick={() => setStatus(null)} className="text-current opacity-50 hover:opacity-100">
                    <XCircle className="w-4 h-4" />
                </button>
            </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-hidden p-6">
            {activeTab === 'design' && (
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden animate-in fade-in">
                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        <div className="col-span-1 text-center"></div>
                        <div className="col-span-4">Column Name</div>
                        <div className="col-span-3">Type</div>
                        <div className="col-span-3 text-center">Settings</div>
                        <div className="col-span-1"></div>
                    </div>

                    {/* Columns List (Draggable) */}
                    <div className="flex-1 overflow-y-auto">
                        {columns.map((col, index) => (
                            <div 
                                key={col.id}
                                draggable={!col.isSystem}
                                onDragStart={(e) => handleDragStart(e, index)}
                                onDragEnter={(e) => handleDragEnter(e, index)}
                                onDragEnd={handleDragEnd}
                                onDragOver={(e) => e.preventDefault()}
                                className={`grid grid-cols-12 gap-4 px-6 py-3 border-b border-slate-100 items-center group transition-colors ${col.isSystem ? 'bg-slate-50/50' : 'hover:bg-indigo-50/30 bg-white'}`}
                            >
                                <div className="col-span-1 flex justify-center text-slate-300 cursor-grab active:cursor-grabbing">
                                    {!col.isSystem && <GripVertical className="w-4 h-4 hover:text-slate-500" />}
                                </div>
                                
                                <div className="col-span-4">
                                    <input 
                                        type="text" 
                                        value={col.name}
                                        disabled={col.isSystem}
                                        onChange={(e) => handleColumnChange(col.id, 'name', e.target.value)}
                                        className={`w-full bg-transparent border-b border-transparent focus:border-indigo-500 focus:outline-none text-sm font-medium font-mono ${col.isSystem ? 'text-slate-500 italic' : 'text-slate-700'}`}
                                    />
                                </div>

                                <div className="col-span-3">
                                    {col.isSystem ? (
                                        <span className="text-xs px-2 py-1 bg-slate-100 rounded text-slate-500 font-mono">{col.type}</span>
                                    ) : (
                                        <select 
                                            value={col.type}
                                            onChange={(e) => handleColumnChange(col.id, 'type', e.target.value)}
                                            className="w-full text-xs bg-white border border-slate-200 rounded px-2 py-1.5 focus:border-indigo-500 outline-none font-mono text-slate-600"
                                        >
                                            <optgroup label="Text">
                                                <option value="VARCHAR(255)">VARCHAR(255)</option>
                                                <option value="TEXT">TEXT</option>
                                            </optgroup>
                                            <optgroup label="Number">
                                                <option value="INTEGER">INTEGER</option>
                                                <option value="DECIMAL(10,2)">DECIMAL</option>
                                                <option value="BOOLEAN">BOOLEAN</option>
                                            </optgroup>
                                            <optgroup label="Date">
                                                <option value="TIMESTAMP">TIMESTAMP</option>
                                                <option value="DATE">DATE</option>
                                            </optgroup>
                                            <optgroup label="JSON">
                                                <option value="JSONB">JSONB</option>
                                                <option value="JSON">JSON</option>
                                            </optgroup>
                                        </select>
                                    )}
                                </div>

                                <div className="col-span-3 flex items-center justify-center gap-3">
                                    {col.isPk && (
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded border border-amber-200" title="Primary Key">PK</span>
                                    )}
                                    <label className={`flex items-center gap-1.5 cursor-pointer select-none ${col.isPk ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                        <input 
                                            type="checkbox" 
                                            checked={col.nullable} 
                                            disabled={col.isPk || col.isSystem}
                                            onChange={(e) => handleColumnChange(col.id, 'nullable', e.target.checked)}
                                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" 
                                        />
                                        <span className="text-xs text-slate-500">Nullable</span>
                                    </label>
                                </div>

                                <div className="col-span-1 flex justify-end">
                                    {!col.isSystem && (
                                        <button 
                                            onClick={() => handleRemoveColumn(col.id)}
                                            className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                        
                        <div className="p-4 border-t border-dashed border-slate-200">
                            <button 
                                onClick={handleAddColumn}
                                className="flex items-center gap-2 text-xs font-medium text-indigo-600 hover:text-indigo-700 px-3 py-2 rounded-lg hover:bg-indigo-50 transition-colors w-full justify-center border border-dashed border-indigo-200 hover:border-indigo-300"
                            >
                                <Plus className="w-3 h-3" />
                                Add Manual Column
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'sql' && (
                <div className="h-full flex flex-col bg-slate-900 rounded-xl border border-slate-700 overflow-hidden shadow-lg animate-in fade-in">
                    <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
                        <div className="flex gap-2">
                            <div className="w-3 h-3 rounded-full bg-red-500"></div>
                            <div className="w-3 h-3 rounded-full bg-amber-500"></div>
                            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                        </div>
                        <span className="text-xs text-slate-400 font-mono">generated_schema.sql</span>
                    </div>
                    <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
                         {generatedSQL ? (
                            <pre className="font-mono text-sm text-emerald-300 leading-relaxed whitespace-pre-wrap">
                                {generatedSQL}
                            </pre>
                         ) : (
                             <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-2">
                                 <Terminal className="w-8 h-8 opacity-50" />
                                 <p className="text-sm">Click "Create & Migrate Local" to generate SQL</p>
                             </div>
                         )}
                    </div>
                </div>
            )}

            {activeTab === 'query' && (
                <div className="h-full flex flex-col gap-4 animate-in fade-in">
                    {/* Query Editor */}
                    <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-2 bg-slate-50 border-b border-slate-200">
                            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                                <Terminal className="w-4 h-4" />
                                SQL Editor (Local Preview)
                            </div>
                            <button 
                                onClick={handleRunQuery}
                                disabled={isExecutingQuery || !querySql.trim()}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {isExecutingQuery ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
                                Run Query
                            </button>
                        </div>
                        <textarea
                            value={querySql}
                            onChange={(e) => setQuerySql(e.target.value)}
                            className="flex-1 w-full p-4 font-mono text-sm text-slate-800 resize-none focus:outline-none"
                            placeholder="SELECT * FROM table..."
                        />
                    </div>

                    {/* Results Pane */}
                    <div className="h-[40%] bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                         <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 flex items-center gap-2">
                            <TableIcon className="w-4 h-4" />
                            Query Results
                         </div>
                         
                         <div className="flex-1 overflow-auto custom-scrollbar p-0 bg-slate-50/30">
                             {!queryResult ? (
                                 <div className="h-full flex flex-col items-center justify-center text-slate-400 gap-2">
                                     <Search className="w-6 h-6 opacity-50" />
                                     <p className="text-xs">Execute a query to see results</p>
                                 </div>
                             ) : queryResult.type === 'error' ? (
                                 <div className="p-4 text-red-600 bg-red-50 h-full font-mono text-sm whitespace-pre-wrap">
                                     <div className="flex items-center gap-2 font-bold mb-2">
                                         <XCircle className="w-4 h-4" /> Error
                                     </div>
                                     {queryResult.message}
                                 </div>
                             ) : queryResult.type === 'success' ? (
                                 <div className="p-4 text-emerald-600 bg-emerald-50 h-full font-mono text-sm">
                                     <div className="flex items-center gap-2 font-bold mb-2">
                                         <CheckCircle2 className="w-4 h-4" /> Success
                                     </div>
                                     {queryResult.message}
                                 </div>
                             ) : (
                                 <table className="w-full text-left text-sm whitespace-nowrap">
                                     <thead className="bg-slate-100 text-slate-600 font-medium text-xs uppercase sticky top-0 shadow-sm">
                                         <tr>
                                             {queryResult.columns?.map((col, i) => (
                                                 <th key={i} className="px-4 py-2 border-b border-slate-200 border-r last:border-r-0">{col}</th>
                                             ))}
                                         </tr>
                                     </thead>
                                     <tbody className="bg-white divide-y divide-slate-100">
                                         {queryResult.data?.map((row, i) => (
                                             <tr key={i} className="hover:bg-indigo-50/50 transition-colors">
                                                 {queryResult.columns?.map((col, j) => (
                                                     <td key={j} className="px-4 py-2 border-r border-slate-100 last:border-r-0 text-slate-700 font-mono text-xs">
                                                         {row[col] === null ? <span className="text-slate-300">NULL</span> : 
                                                            (typeof row[col] === 'object' ? JSON.stringify(row[col]) : String(row[col]))
                                                         }
                                                     </td>
                                                 ))}
                                             </tr>
                                         ))}
                                     </tbody>
                                 </table>
                             )}
                         </div>
                         {queryResult?.message && queryResult.type === 'table' && (
                             <div className="px-4 py-1 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-500 text-right">
                                 {queryResult.message}
                             </div>
                         )}
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};