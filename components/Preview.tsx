import React, { useState, useRef, useEffect, useLayoutEffect } from 'react';
import { FormField, FormTab, FieldType, FieldEvent, EventTrigger } from '../types';
import { Eye, Trash2, MoveLeft, MoveRight, Minimize2, Maximize2, Check, Settings2, ArrowLeft, ArrowRight, Plus, Minus, Paperclip, Send, Play, Search, ChevronDown, Copy, GripVertical, AlertCircle } from 'lucide-react';

interface PreviewProps {
  fields: FormField[];
  selectedFieldId?: string | null;
  onSelectField?: (id: string) => void;
  onDeleteField?: (id: string) => void;
  onUpdateField?: (id: string, updates: Partial<FormField>) => void;
  onMoveField?: (id: string, direction: 'up' | 'down') => void;
  onCloneField?: (id: string) => void;
  onReorderField?: (dragIndex: number, hoverIndex: number, parentId?: string) => void;
  validationErrors?: Record<string, string>;
  mode?: 'builder' | 'live';
}

interface RenderProps extends PreviewProps {
  field: FormField;
  index: number;
  parentId?: string;
  onDragStart?: (e: React.DragEvent, index: number, parentId?: string) => void;
  onDragEnter?: (e: React.DragEvent, index: number, parentId?: string) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

const FIELD_TYPES: { type: FieldType; label: string }[] = [
  { type: 'short_text', label: 'Text' },
  { type: 'long_text', label: 'Long Text' },
  { type: 'number', label: 'Number' },
  { type: 'select', label: 'Select' },
  { type: 'radio', label: 'Radio' },
  { type: 'checkbox', label: 'Checkbox' },
  { type: 'date', label: 'Date' },
  { type: 'file_upload', label: 'File Upload' },
  { type: 'multi_line', label: 'List (Multi-line)' },
  { type: 'repeating_group', label: 'Table Group' },
];

const executeEventAction = async (event: FieldEvent, value: any) => {
    if (event.action.type === 'ajax_request') {
        console.log(`[FormCraft] Triggering AJAX (${event.trigger}) to ${event.action.url} with value:`, value);
        try {
            // In a real implementation, this would handle response state, loading indicators, etc.
            // For this demo, we just fire the request.
            await fetch(event.action.url, {
                method: event.action.method,
                headers: {
                    'Content-Type': 'application/json',
                },
                body: event.action.method !== 'GET' ? JSON.stringify({ value, timestamp: new Date().toISOString() }) : undefined
            });
            console.log('[FormCraft] AJAX request sent successfully.');
        } catch (error) {
            console.error('[FormCraft] AJAX request failed:', error);
        }
    }
};

// -- Searchable Select Component (Select2 style) --
const SearchableSelect = ({ field, value: propValue, onChange, onFocus, disabled, className, placeholder, onBlurEvent }: any) => {
    const [isOpen, setIsOpen] = useState(false);
    const [search, setSearch] = useState("");
    const [internalValue, setInternalValue] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Use internal state for preview if no propValue provided (uncontrolled mode simulation)
    const value = propValue !== undefined ? propValue : internalValue;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                if (isOpen) {
                    // Treat closing the dropdown as a blur equivalent if needed
                    onBlurEvent?.();
                }
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen, onBlurEvent]);

    const filteredOptions = field.options?.filter((opt: string) => 
        opt.toLowerCase().includes(search.toLowerCase())
    ) || [];

    const handleSelect = (opt: string) => {
        if (onChange) onChange(opt);
        setInternalValue(opt);
        setIsOpen(false);
        setSearch("");
    };

    return (
        <div className="relative" ref={containerRef}>
            <div 
                className={`${className} flex items-center justify-between cursor-pointer ${disabled ? 'opacity-60 cursor-not-allowed' : 'bg-white'} pr-2`}
                onClick={(e) => {
                    if (disabled) {
                        onFocus?.(e); 
                        return;
                    }
                    setIsOpen(!isOpen);
                    onFocus?.(e);
                }}
            >
                <span className={`truncate select-none ${value ? "text-slate-700" : "text-slate-400"}`}>
                    {value || placeholder || field.placeholder || "Select..."}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && !disabled && (
                <div 
                    className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-xl flex flex-col animate-in fade-in zoom-in-95 duration-100 origin-top min-w-[200px]"
                    style={{ maxHeight: '250px' }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="p-2 border-b border-slate-100 bg-slate-50/50 rounded-t-lg">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                            <input 
                                type="text"
                                autoFocus
                                className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 transition-all placeholder:text-slate-400"
                                placeholder="Search..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="overflow-y-auto p-1 custom-scrollbar" style={{ maxHeight: '200px' }}>
                        {filteredOptions.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-slate-400 text-center">No results found</div>
                        ) : (
                            filteredOptions.map((opt: string) => (
                                <div 
                                    key={opt}
                                    className={`px-3 py-2 text-sm rounded-md cursor-pointer flex items-center justify-between group transition-colors ${value === opt ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-slate-700 hover:bg-slate-50'}`}
                                    onClick={() => handleSelect(opt)}
                                >
                                    <span className="truncate">{opt}</span>
                                    {value === opt && <Check className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0 ml-2" />}
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

const TabGroupRenderer: React.FC<RenderProps> = (props) => {
  const { field, selectedFieldId, onSelectField, onDeleteField, onUpdateField, onMoveField, onCloneField, onReorderField, mode = 'builder' } = props;
  const [activeTabId, setActiveTabId] = useState<string>(field.tabs?.[0]?.id || '');
  const isBuilder = mode === 'builder';

  if (!field.tabs || field.tabs.length === 0) return null;

  const activeTab = field.tabs.find(t => t.id === activeTabId) || field.tabs[0];

  return (
    <div className="w-full mt-2 mb-6">
      {/* Tabs Header */}
      <div className="flex border-b border-slate-200 mb-6 overflow-x-auto no-scrollbar">
        {field.tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={(e) => { 
                // In Builder mode, clicking tab header also selects the group
                if (isBuilder) {
                    e.stopPropagation(); 
                    onSelectField?.(field.id); 
                }
                setActiveTabId(tab.id); 
            }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
              activeTab.id === tab.id 
                ? 'border-indigo-600 text-indigo-600' 
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="animate-in fade-in slide-in-from-bottom-1 duration-200">
        <div className="flex flex-wrap gap-x-4 gap-y-6">
          {activeTab.fields.map((nestedField, idx) => (
             <FieldRenderer 
                key={nestedField.id} 
                field={nestedField} 
                index={idx}
                parentId={activeTab.id}
                selectedFieldId={selectedFieldId}
                onSelectField={onSelectField}
                onDeleteField={onDeleteField}
                onUpdateField={onUpdateField}
                onMoveField={onMoveField}
                onCloneField={onCloneField}
                onReorderField={onReorderField}
                onDragStart={props.onDragStart}
                onDragEnter={props.onDragEnter}
                onDragEnd={props.onDragEnd}
                fields={[]} 
                mode={mode}
                validationErrors={props.validationErrors}
             />
          ))}
        </div>
      </div>
    </div>
  );
};

const RepeatingGroupRenderer: React.FC<RenderProps> = (props) => {
    const { field, selectedFieldId, onSelectField, mode = 'builder' } = props;
    const columns = field.subFields || [];
    // Simulate row state for the preview
    const [rows, setRows] = useState<any[]>([{}]); 
    const isBuilder = mode === 'builder';

    const addRow = () => setRows([...rows, {}]);
    const removeRow = (idx: number) => {
        if (rows.length > 1) setRows(rows.filter((_, i) => i !== idx));
    };

    if (columns.length === 0) {
        return (
            <div className="w-full p-6 text-center border-2 border-dashed border-slate-200 rounded-lg text-slate-400 text-sm">
                {isBuilder ? "No columns defined. Add fields in the Builder." : "No columns."}
            </div>
        );
    }

    return (
        <div className="w-full overflow-x-auto pb-32"> {/* Extra padding at bottom for dropdowns */}
             <table className="w-full text-sm text-left border-separate border-spacing-0">
                 <thead className="text-xs text-slate-500 uppercase bg-slate-50">
                     <tr>
                         <th className="px-4 py-3 font-medium text-slate-400 w-8 border-b border-slate-200 first:rounded-tl-lg">#</th>
                         {columns.map(col => {
                             const isColSelected = isBuilder && selectedFieldId === col.id;
                             return (
                                <th 
                                    key={col.id} 
                                    onClick={(e) => { if (isBuilder) { e.stopPropagation(); onSelectField?.(col.id); }}}
                                    className={`px-4 py-3 font-medium transition-colors whitespace-nowrap border-b border-slate-200 ${isBuilder ? 'cursor-pointer hover:text-indigo-600' : ''} ${isColSelected ? 'text-indigo-600 bg-indigo-50' : ''}`}
                                >
                                    {col.label}
                                    {col.required && <span className="text-red-500 ml-0.5">*</span>}
                                </th>
                             );
                         })}
                         <th className="px-4 py-3 w-10 border-b border-slate-200 last:rounded-tr-lg"></th>
                     </tr>
                 </thead>
                 <tbody>
                     {rows.map((row, rowIdx) => (
                         <tr key={rowIdx} className="group/row hover:bg-slate-50/50">
                             <td className="px-4 py-2 text-slate-400 text-xs border-b border-slate-100">{rowIdx + 1}</td>
                             {columns.map(col => (
                                 <td key={col.id} className="px-4 py-2 border-b border-slate-100">
                                     <TableInputRenderer 
                                        field={col} 
                                        onSelectField={onSelectField} 
                                        selectedFieldId={selectedFieldId} 
                                        mode={mode}
                                     />
                                 </td>
                             ))}
                             <td className="px-4 py-2 border-b border-slate-100">
                                 {rows.length > 1 && (
                                     <button 
                                        type="button" 
                                        onClick={(e) => { e.stopPropagation(); removeRow(rowIdx); }}
                                        className="text-slate-300 hover:text-red-500 transition-colors"
                                     >
                                         <Trash2 className="w-4 h-4" />
                                     </button>
                                 )}
                             </td>
                         </tr>
                     ))}
                 </tbody>
             </table>
             <div className="mt-2">
                 <button 
                     type="button"
                     onClick={(e) => { e.stopPropagation(); addRow(); }}
                     className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 px-2 py-1 rounded hover:bg-indigo-50 transition-colors"
                 >
                     <Plus className="w-3 h-3" />
                     Add Row
                 </button>
             </div>
        </div>
    );
};

// Specialized renderer for inputs inside a table cell
const TableInputRenderer: React.FC<{ 
    field: FormField; 
    onSelectField?: (id: string) => void; 
    selectedFieldId?: string | null; 
    mode: 'builder' | 'live';
}> = ({ field, onSelectField, selectedFieldId, mode }) => {
    
    const isBuilder = mode === 'builder';
    const isSelected = isBuilder && selectedFieldId === field.id;
    
    const handleFocus = (e: React.FocusEvent | React.MouseEvent) => {
        if (isBuilder) {
            e.stopPropagation();
            onSelectField?.(field.id);
        }
    };

    const baseClass = `w-full px-2 py-1.5 text-sm bg-white border rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors ${isSelected ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-slate-200'}`;

    const handleEventTrigger = (trigger: EventTrigger, value: any) => {
        if (isBuilder) return;
        const eventConfig = field.events?.find(e => e.trigger === trigger);
        if (eventConfig) {
            executeEventAction(eventConfig, value);
        }
    };

    switch(field.type) {
        case 'select':
            return (
                <SearchableSelect 
                    field={field} 
                    disabled={isBuilder}
                    onFocus={handleFocus}
                    onChange={(val: string) => handleEventTrigger('onChange', val)}
                    onBlurEvent={() => handleEventTrigger('onBlur', '')} // Simple blur trigger
                    className={baseClass}
                    placeholder="Select..."
                />
            );
        case 'checkbox':
             return (
                 <input 
                    type="checkbox" 
                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer" 
                    onFocus={handleFocus} 
                    onChange={(e) => handleEventTrigger('onChange', e.target.checked)}
                    onBlur={(e) => handleEventTrigger('onBlur', e.target.checked)}
                    disabled={isBuilder} 
                />
             );
        case 'date':
             return (
                <input 
                    type="date" 
                    className={baseClass} 
                    onFocus={handleFocus} 
                    onChange={(e) => handleEventTrigger('onChange', e.target.value)}
                    onBlur={(e) => handleEventTrigger('onBlur', e.target.value)}
                    disabled={isBuilder} 
                />
             );
        case 'number':
             return (
                <input 
                    type="number" 
                    className={baseClass} 
                    placeholder={field.placeholder} 
                    onFocus={handleFocus} 
                    onChange={(e) => handleEventTrigger('onChange', e.target.value)}
                    onBlur={(e) => handleEventTrigger('onBlur', e.target.value)}
                    readOnly={isBuilder} 
                />
             );
        case 'file_upload':
              return (
                  <div 
                    className={`flex items-center gap-2 text-xs text-slate-400 border border-slate-200 rounded px-2 py-1.5 bg-slate-50 ${isSelected ? 'border-indigo-500 ring-1 ring-indigo-500' : ''}`}
                    onClick={handleFocus}
                  >
                      <Paperclip className="w-3 h-3" />
                      <span className="truncate">Upload...</span>
                  </div>
              );
        default:
             return (
                <input 
                    type="text" 
                    className={baseClass} 
                    placeholder={field.placeholder} 
                    onFocus={handleFocus} 
                    onChange={(e) => handleEventTrigger('onChange', e.target.value)}
                    onBlur={(e) => handleEventTrigger('onBlur', e.target.value)}
                    readOnly={isBuilder} 
                />
             );
    }
};

const MultiLineInput: React.FC<{ field: FormField; handleInteraction: (e: any) => void; baseInputClasses: string; handleEvent: (t: EventTrigger, v: any) => void }> = ({ field, handleInteraction, baseInputClasses, handleEvent }) => {
    const [lines, setLines] = useState<string[]>(['']);

    const addLine = () => setLines([...lines, '']);
    const removeLine = (idx: number) => {
        if (lines.length > 1) {
            setLines(lines.filter((_, i) => i !== idx));
        }
    };

    return (
        <div className="space-y-2">
            {lines.map((_, idx) => (
                <div key={idx} className="flex items-center gap-2">
                    <input 
                        type="text" 
                        className={baseInputClasses}
                        placeholder={`${field.placeholder || 'Item'} ${idx + 1}`}
                        onFocus={handleInteraction}
                        onChange={(e) => handleEvent('onChange', e.target.value)} // Triggers on individual line change for now
                        onBlur={(e) => handleEvent('onBlur', e.target.value)}
                    />
                    {lines.length > 1 && (
                         <button 
                         type="button" 
                         onClick={(e) => { e.stopPropagation(); removeLine(idx); }}
                         className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                     >
                         <Minus className="w-4 h-4" />
                     </button>
                    )}
                </div>
            ))}
            <button 
                type="button"
                onClick={(e) => { e.stopPropagation(); addLine(); }}
                className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 px-2 py-1 rounded hover:bg-indigo-50 transition-colors w-fit"
            >
                <Plus className="w-3 h-3" />
                Add Item
            </button>
        </div>
    );
}

const FieldRenderer: React.FC<RenderProps> = (props) => {
    const { field, selectedFieldId, onSelectField, onDeleteField, onUpdateField, onMoveField, onCloneField, mode = 'builder', index, parentId, onDragStart, onDragEnter, onDragEnd, validationErrors } = props;
    const isBuilder = mode === 'builder';
    const isSelected = isBuilder && selectedFieldId === field.id;
    const fieldError = validationErrors?.[field.id];

    const baseInputClasses = "w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400 text-slate-700 text-sm";

    const handleInteraction = (e: React.MouseEvent | React.FocusEvent) => {
        if (isBuilder) {
            e.stopPropagation();
            onSelectField?.(field.id);
        }
    };

    const handleEventTrigger = (trigger: EventTrigger, value: any) => {
        if (isBuilder) return;
        const eventConfig = field.events?.find(e => e.trigger === trigger);
        if (eventConfig) {
            executeEventAction(eventConfig, value);
        }
    };

    // Wrapper for Tab Group
    if (field.type === 'tab_group') {
      return (
        <div 
            onClick={isBuilder ? handleInteraction : undefined}
            draggable={isBuilder}
            onDragStart={(e) => isBuilder && onDragStart?.(e, index, parentId)}
            onDragEnter={(e) => isBuilder && onDragEnter?.(e, index, parentId)}
            onDragEnd={(e) => isBuilder && onDragEnd?.(e)}
            onDragOver={(e) => isBuilder && e.preventDefault()}
            className={`relative w-full transition-all duration-200 rounded-xl p-2 -m-2 border-2 ${
                isSelected 
                ? 'border-indigo-500 bg-indigo-50/10' 
                : 'border-transparent hover:border-slate-200'
            } ${!isBuilder ? '!border-transparent !p-0 !m-0 !bg-transparent' : ''}`}
        >
            {isSelected && (
                <div className="absolute -top-10 right-0 flex gap-1 z-20 bg-white p-1 rounded-lg shadow-md border border-slate-200 animate-in fade-in slide-in-from-bottom-2">
                    <div className="cursor-grab active:cursor-grabbing p-1.5 text-slate-300 hover:text-slate-500">
                        <GripVertical className="w-3.5 h-3.5" />
                    </div>
                    <span className="px-2 py-1.5 flex items-center text-xs font-bold text-indigo-700 uppercase">
                        Tab Group
                    </span>
                     <div className="w-px bg-slate-200 my-1 mx-1"></div>
                     <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onCloneField?.(field.id); }}
                        className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-indigo-600"
                        title="Duplicate"
                    >
                        <Copy className="w-3.5 h-3.5" />
                    </button>
                     <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onMoveField?.(field.id, 'up'); }}
                        className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-indigo-600"
                        title="Move Up"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                    <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onMoveField?.(field.id, 'down'); }}
                        className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-indigo-600"
                        title="Move Down"
                    >
                        <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <div className="w-px bg-slate-200 my-1 mx-1"></div>
                    <button 
                        onClick={(e) => { e.stopPropagation(); onDeleteField?.(field.id); }}
                        className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded transition-colors"
                        title="Delete"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}
            <TabGroupRenderer {...props} />
        </div>
      );
    }

    // Wrapper for Repeating Group
    if (field.type === 'repeating_group') {
        return (
            <div 
                onClick={isBuilder ? handleInteraction : undefined}
                draggable={isBuilder}
                onDragStart={(e) => isBuilder && onDragStart?.(e, index, parentId)}
                onDragEnter={(e) => isBuilder && onDragEnter?.(e, index, parentId)}
                onDragEnd={(e) => isBuilder && onDragEnd?.(e)}
                onDragOver={(e) => isBuilder && e.preventDefault()}
                className={`relative w-full transition-all duration-200 rounded-xl p-2 -m-2 border-2 ${
                    isSelected 
                    ? 'border-indigo-500 bg-indigo-50/10' 
                    : 'border-transparent hover:border-slate-200'
                } ${!isBuilder ? '!border-transparent !p-0 !m-0 !bg-transparent' : ''}`}
            >
                {isSelected && (
                    <div className="absolute -top-10 right-0 flex gap-1 z-20 bg-white p-1 rounded-lg shadow-md border border-slate-200 animate-in fade-in slide-in-from-bottom-2">
                        <div className="cursor-grab active:cursor-grabbing p-1.5 text-slate-300 hover:text-slate-500">
                             <GripVertical className="w-3.5 h-3.5" />
                        </div>
                        <span className="px-2 py-1.5 flex items-center text-xs font-bold text-indigo-700 uppercase">
                            Table
                        </span>
                        <div className="w-px bg-slate-200 my-1 mx-1"></div>
                        <button 
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onCloneField?.(field.id); }}
                            className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-indigo-600"
                            title="Duplicate"
                        >
                            <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button 
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onMoveField?.(field.id, 'up'); }}
                            className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-indigo-600"
                            title="Move Up"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                        </button>
                        <button 
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onMoveField?.(field.id, 'down'); }}
                            className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-indigo-600"
                            title="Move Down"
                        >
                            <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                        <div className="w-px bg-slate-200 my-1 mx-1"></div>
                        <button 
                            onClick={(e) => { e.stopPropagation(); onDeleteField?.(field.id); }}
                            className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded transition-colors"
                            title="Delete"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}
                 <div className="mb-2">
                    {isSelected ? (
                        <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
                            <input
                                type="text"
                                value={field.label}
                                onChange={(e) => onUpdateField?.(field.id, { label: e.target.value })}
                                className="w-full bg-transparent border-b border-indigo-300 focus:border-indigo-600 border-dashed focus:outline-none text-sm font-medium text-indigo-900 px-0 py-0.5"
                                autoFocus
                                placeholder="Label"
                            />
                            <div className="relative">
                                <input
                                    type="text"
                                    value={field.propertyName || ''}
                                    onChange={(e) => onUpdateField?.(field.id, { propertyName: e.target.value })}
                                    className={`w-full bg-transparent border-b focus:outline-none text-xs font-mono px-0 py-0.5 ${fieldError ? 'border-red-300 text-red-500 focus:border-red-500' : 'border-indigo-200 text-slate-500 focus:border-indigo-500'}`}
                                    placeholder="property_name"
                                />
                                {fieldError && <div className="absolute right-0 top-0 text-red-500" title={fieldError}><AlertCircle className="w-3 h-3" /></div>}
                            </div>
                        </div>
                    ) : (
                        <label className="block text-sm font-medium text-slate-700">
                            {field.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                    )}
                </div>
                <RepeatingGroupRenderer {...props} />
            </div>
        );
    }

    const renderInput = () => {
        switch (field.type) {
            case 'multi_line':
                return <MultiLineInput field={field} handleInteraction={handleInteraction} baseInputClasses={baseInputClasses} handleEvent={handleEventTrigger} />;
            case 'long_text':
              return (
                <textarea 
                  className={`${baseInputClasses} min-h-[100px] resize-y`}
                  placeholder={field.placeholder}
                  required={field.required}
                  onFocus={handleInteraction}
                  onChange={(e) => handleEventTrigger('onChange', e.target.value)}
                  onBlur={(e) => handleEventTrigger('onBlur', e.target.value)}
                  readOnly={isBuilder}
                />
              );
            case 'select':
              return (
                  <SearchableSelect 
                      field={field}
                      disabled={isBuilder}
                      onFocus={handleInteraction}
                      onChange={(val: string) => handleEventTrigger('onChange', val)}
                      onBlurEvent={() => handleEventTrigger('onBlur', '')}
                      className={baseInputClasses}
                  />
              );
            case 'checkbox':
              return (
                <div className="flex items-center h-[42px]">
                  <input 
                    type="checkbox" 
                    id={`field-${field.id}`} 
                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                    required={field.required}
                    onFocus={handleInteraction}
                    onChange={(e) => handleEventTrigger('onChange', e.target.checked)}
                    onBlur={(e) => handleEventTrigger('onBlur', e.target.checked)}
                    disabled={isBuilder} // Disabled to prevent actual checking, we want to select the field wrapper
                  />
                  <div className="ml-2 flex-1">
                    {isSelected ? (
                         <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
                             <input
                                 type="text"
                                 value={field.label}
                                 onChange={(e) => onUpdateField?.(field.id, { label: e.target.value })}
                                 className="w-full bg-transparent border-b border-indigo-300 focus:border-indigo-600 border-dashed focus:outline-none text-sm font-medium text-indigo-900 px-0 py-0.5"
                                 autoFocus
                                 placeholder="Label"
                             />
                             <div className="relative">
                                <input
                                    type="text"
                                    value={field.propertyName || ''}
                                    onChange={(e) => onUpdateField?.(field.id, { propertyName: e.target.value })}
                                    className={`w-full bg-transparent border-b focus:outline-none text-xs font-mono px-0 py-0.5 ${fieldError ? 'border-red-300 text-red-500 focus:border-red-500' : 'border-indigo-200 text-slate-500 focus:border-indigo-500'}`}
                                    placeholder="property_name"
                                />
                                {fieldError && <div className="absolute right-0 top-0 text-red-500" title={fieldError}><AlertCircle className="w-3 h-3" /></div>}
                            </div>
                         </div>
                    ) : (
                        <label htmlFor={`field-${field.id}`} className="block text-sm text-slate-700 cursor-pointer pointer-events-none">
                            {field.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                    )}
                  </div>
                </div>
              );
            case 'radio':
              return (
                  <div className="space-y-2 pt-2">
                      {field.options?.map((opt, idx) => (
                          <div key={idx} className="flex items-center">
                              <input 
                                  type="radio" 
                                  name={`field-${field.id}`} 
                                  id={`field-${field.id}-${idx}`}
                                  className="w-4 h-4 text-indigo-600 border-slate-300 focus:ring-indigo-500"
                                  required={field.required}
                                  onFocus={handleInteraction}
                                  onChange={(e) => handleEventTrigger('onChange', opt)}
                                  onBlur={(e) => handleEventTrigger('onBlur', opt)}
                                  disabled={isBuilder}
                              />
                              <label htmlFor={`field-${field.id}-${idx}`} className="ml-2 block text-sm text-slate-700">
                                  {opt}
                              </label>
                          </div>
                      ))}
                  </div>
              );
            case 'file_upload':
              return (
                  <input 
                    type="file"
                    className={`${baseInputClasses} file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 text-slate-500`}
                    onFocus={handleInteraction}
                    onClick={isBuilder ? handleInteraction : undefined}
                    onChange={(e) => handleEventTrigger('onChange', 'File Selected')}
                    onBlur={(e) => handleEventTrigger('onBlur', 'File Input Blurred')}
                  />
              );
            default: // short_text, number, date
              return (
                <input 
                  type={field.type === 'short_text' ? 'text' : field.type} 
                  className={baseInputClasses}
                  placeholder={field.placeholder}
                  required={field.required}
                  onFocus={handleInteraction}
                  onChange={(e) => handleEventTrigger('onChange', e.target.value)}
                  onBlur={(e) => handleEventTrigger('onBlur', e.target.value)}
                  readOnly={isBuilder}
                />
              );
          }
    }

    return (
        <div 
            onClick={isBuilder ? handleInteraction : undefined}
            draggable={isBuilder}
            onDragStart={(e) => isBuilder && onDragStart?.(e, index, parentId)}
            onDragEnter={(e) => isBuilder && onDragEnter?.(e, index, parentId)}
            onDragEnd={(e) => isBuilder && onDragEnd?.(e)}
            onDragOver={(e) => isBuilder && e.preventDefault()}
            className={`relative group/preview animate-in fade-in slide-in-from-bottom-2 duration-300 p-2 -m-2 rounded-xl border-2 transition-all ${
                field.width === 'half' ? 'w-full sm:w-[calc(50%-0.5rem)]' : 'w-full'
            } ${
                isSelected 
                ? 'border-indigo-500 bg-indigo-50/10' 
                : 'border-transparent hover:border-slate-200 hover:bg-slate-50/50'
            } ${!isBuilder ? '!border-transparent !p-0 !m-0 !bg-transparent hover:!bg-transparent' : ''}`}
        >
            {/* Action Toolbar (Top Right) */}
            {isSelected && (
                <div className="absolute -top-10 right-0 flex gap-1 z-20 bg-white p-1 rounded-lg shadow-md border border-slate-200 animate-in fade-in slide-in-from-bottom-2">
                    
                    {/* Drag Handle */}
                    <div className="cursor-grab active:cursor-grabbing p-1.5 text-slate-300 hover:text-slate-500">
                        <GripVertical className="w-3.5 h-3.5" />
                    </div>

                    {/* Type Selector */}
                    <div className="relative group/type">
                        <select 
                            value={field.type}
                            onChange={(e) => { 
                                e.stopPropagation();
                                onUpdateField?.(field.id, { type: e.target.value as FieldType });
                            }}
                            className="appearance-none pl-2 pr-6 py-1.5 bg-slate-50 hover:bg-slate-100 rounded text-xs font-medium text-slate-700 focus:outline-none cursor-pointer border border-transparent hover:border-slate-200"
                        >
                           {FIELD_TYPES.filter(t => t.type !== 'tab_group' && t.type !== 'repeating_group').map(t => (
                               <option key={t.type} value={t.type}>{t.label}</option>
                           ))}
                        </select>
                         <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-1 text-slate-500">
                             <Settings2 className="w-3 h-3" />
                         </div>
                    </div>

                    <div className="w-px bg-slate-200 my-1 mx-1"></div>
                    
                    {/* Clone Button */}
                    <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onCloneField?.(field.id); }}
                        className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-indigo-600"
                        title="Duplicate"
                    >
                        <Copy className="w-3.5 h-3.5" />
                    </button>

                    {/* Width Toggle */}
                    <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onUpdateField?.(field.id, { width: field.width === 'full' ? 'half' : 'full' }); }}
                        className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-indigo-600"
                        title={field.width === 'full' ? "Set to Half Width" : "Set to Full Width"}
                    >
                        {field.width === 'full' ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    </button>

                    <div className="w-px bg-slate-200 my-1 mx-1"></div>

                    {/* Move Controls */}
                    <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onMoveField?.(field.id, 'up'); }}
                        className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-indigo-600"
                        title="Move Previous / Left"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                    <button 
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onMoveField?.(field.id, 'down'); }}
                        className="p-1.5 hover:bg-slate-100 rounded text-slate-500 hover:text-indigo-600"
                        title="Move Next / Right"
                    >
                        <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                    <div className="w-px bg-slate-200 my-1 mx-1"></div>

                    {/* Delete */}
                    <button 
                        onClick={(e) => { e.stopPropagation(); onDeleteField?.(field.id); }}
                        className="p-1.5 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded transition-colors"
                        title="Delete"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            {/* Field Label (Editable when selected) */}
            {field.type !== 'checkbox' && (
                <div className="mb-1.5">
                    {isSelected ? (
                        <div className="space-y-1" onClick={(e) => e.stopPropagation()}>
                            <input
                                type="text"
                                value={field.label}
                                onChange={(e) => onUpdateField?.(field.id, { label: e.target.value })}
                                className="w-full bg-transparent border-b border-indigo-300 focus:border-indigo-600 border-dashed focus:outline-none text-sm font-medium text-indigo-900 px-0 py-0.5"
                                autoFocus
                                placeholder="Label"
                            />
                            <div className="relative">
                                <input
                                    type="text"
                                    value={field.propertyName || ''}
                                    onChange={(e) => onUpdateField?.(field.id, { propertyName: e.target.value })}
                                    className={`w-full bg-transparent border-b focus:outline-none text-xs font-mono px-0 py-0.5 ${fieldError ? 'border-red-300 text-red-500 focus:border-red-500' : 'border-indigo-200 text-slate-500 focus:border-indigo-500'}`}
                                    placeholder="property_name"
                                />
                                {fieldError && <div className="absolute right-0 top-0 text-red-500" title={fieldError}><AlertCircle className="w-3 h-3" /></div>}
                            </div>
                        </div>
                    ) : (
                        <label className="block text-sm font-medium text-slate-700">
                            {field.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                        </label>
                    )}
                </div>
            )}
            
            {renderInput()}
            
            {field.helperText && (
                <p className="mt-1 text-xs text-slate-500">{field.helperText}</p>
            )}
        </div>
    );
}

export const Preview: React.FC<PreviewProps> = (props) => {
  const { mode = 'builder' } = props;
  
  const dragItem = useRef<{index: number, parentId?: string} | null>(null);
  const dragOverItem = useRef<{index: number, parentId?: string} | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number, parentId?: string) => {
    e.stopPropagation();
    dragItem.current = { index, parentId };
    // Optional: set drag image styling if needed
  };

  const handleDragEnter = (e: React.DragEvent, index: number, parentId?: string) => {
    e.stopPropagation();
    dragOverItem.current = { index, parentId };
  };

  const handleDragEnd = (e: React.DragEvent) => {
    e.stopPropagation();
    if (dragItem.current && dragOverItem.current) {
        // Ensure we are reordering within the same container
        if (dragItem.current.parentId === dragOverItem.current.parentId && 
            dragItem.current.index !== dragOverItem.current.index) {
            props.onReorderField?.(dragItem.current.index, dragOverItem.current.index, dragItem.current.parentId);
        }
    }
    dragItem.current = null;
    dragOverItem.current = null;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'live') {
        // Simulate successful submission
        const btn = (e.target as HTMLFormElement).querySelector('button[type="submit"]');
        if (btn) {
            const originalText = btn.textContent;
            btn.textContent = 'Submitted!';
            btn.classList.add('bg-emerald-600', 'hover:bg-emerald-700');
            btn.classList.remove('bg-indigo-600', 'hover:bg-indigo-700');
            setTimeout(() => {
                btn.textContent = originalText;
                btn.classList.remove('bg-emerald-600', 'hover:bg-emerald-700');
                btn.classList.add('bg-indigo-600', 'hover:bg-indigo-700');
                alert("Form submitted successfully! (Simulation)");
            }, 1000);
        }
    } else {
        alert("This is a preview. Switch to Live Mode to test submission properly.");
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
       <div className="p-4 border-b border-slate-200 bg-white flex justify-between items-center">
        <div>
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            {mode === 'live' ? <Play className="w-4 h-4 text-emerald-600" /> : <Eye className="w-4 h-4" />}
            {mode === 'live' ? 'Live Preview' : 'Design Preview'}
            </h2>
            <p className="text-xs text-slate-500 mt-1">
                {mode === 'live' ? 'Test your form as a real user.' : 'Click fields to edit layout and properties.'}
            </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-8" onClick={() => props.onSelectField?.('')}> 
        {/* Clicking background deselects */}
        
        <div 
            className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 p-6 sm:p-10 relative mt-8 mb-20"
            onClick={(e) => e.stopPropagation()} 
        >
          {props.fields.length === 0 ? (
             <div className="text-center py-20 text-slate-400">
                <p>Form is empty.</p>
             </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-wrap gap-x-4 gap-y-6">
                {props.fields.map((field, index) => (
                    <FieldRenderer 
                        key={field.id} 
                        field={field} 
                        index={index}
                        onDragStart={handleDragStart}
                        onDragEnter={handleDragEnter}
                        onDragEnd={handleDragEnd}
                        {...props} 
                    />
                ))}

                <div className="w-full pt-6 border-t border-slate-100 mt-4">
                    <button 
                        type="submit"
                        className="flex items-center justify-center gap-2 w-full sm:w-auto px-6 py-2.5 bg-indigo-600 text-white font-medium rounded-lg shadow-sm hover:bg-indigo-700 focus:ring-4 focus:ring-indigo-500/20 transition-all"
                    >
                        {mode === 'live' && <Send className="w-4 h-4" />}
                        Submit Form
                    </button>
                </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};