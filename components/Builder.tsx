import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FormField, FieldType, FieldWidth, FormTab, FieldEvent, ActionType, EventTrigger } from '../types';
import { Trash2, ArrowUp, ArrowDown, Settings2, Folder, Plus, X, Table, ChevronRight, ChevronDown, GripVertical, Copy, AlertCircle, Zap, Globe, Activity } from 'lucide-react';

interface BuilderProps {
  fields: FormField[];
  onAddField: (type: FieldType, parentId?: string) => void; // parentId is the ID of a Tab container OR a Repeating Group
  onUpdateField: (id: string, updates: Partial<FormField>) => void;
  onRemoveField: (id: string) => void;
  onMoveField: (id: string, direction: 'up' | 'down') => void;
  onReorderField: (dragIndex: number, hoverIndex: number, parentId?: string) => void;
  onCloneField: (id: string) => void;
  selectedFieldId?: string | null;
  onSelectField?: (id: string | null) => void;
  validationErrors?: Record<string, string>;
}

const FIELD_TYPES: { type: FieldType; label: string; icon: string; category: 'input' | 'group' }[] = [
  { type: 'short_text', label: 'Text', icon: 'T', category: 'input' },
  { type: 'long_text', label: 'Textarea', icon: '¶', category: 'input' },
  { type: 'number', label: 'Number', icon: '#' , category: 'input'},
  { type: 'select', label: 'Dropdown', icon: '▼', category: 'input' },
  { type: 'radio', label: 'Radio', icon: '○', category: 'input' },
  { type: 'checkbox', label: 'Checkbox', icon: '☑', category: 'input' },
  { type: 'date', label: 'Date', icon: '📅', category: 'input' },
  { type: 'file_upload', label: 'File Upload', icon: '📎', category: 'input' },
  { type: 'multi_line', label: 'List', icon: '☰', category: 'input' },
  { type: 'repeating_group', label: 'Table Group', icon: '▦', category: 'group' },
  { type: 'tab_group', label: 'Tabs', icon: '📑', category: 'group' },
];

// --- Helper Functions ---

const findFieldRecursive = (fields: FormField[], targetId: string): boolean => {
    for (const f of fields) {
        if (f.id === targetId) return true;
        if (f.tabs) {
            for (const t of f.tabs) {
                if (findFieldRecursive(t.fields, targetId)) return true;
            }
        }
        if (f.subFields) {
            if (findFieldRecursive(f.subFields, targetId)) return true;
        }
    }
    return false;
};

const getAllParentIds = (fields: FormField[], targetId: string | null): Set<string> => {
    const ids = new Set<string>();
    if (!targetId) return ids;
  
    const find = (currentFields: FormField[], path: string[]): boolean => {
      for (const f of currentFields) {
        if (f.id === targetId) {
          path.forEach(id => ids.add(id));
          ids.add(f.id); // Add self
          return true;
        }
        
        if (f.tabs) {
          for (const tab of f.tabs) {
            if (find(tab.fields, [...path, f.id])) return true;
          }
        }
        
        if (f.subFields) {
          if (find(f.subFields, [...path, f.id])) return true;
        }
      }
      return false;
    };
  
    find(fields, []);
    return ids;
};

// --- Sub-Components ---

interface BuilderFieldItemProps {
    field: FormField;
    index: number;
    totalFields: number;
    parentId?: string;
    handlers: {
        onAddField: (type: FieldType, parentId?: string) => void;
        onUpdateField: (id: string, updates: Partial<FormField>) => void;
        onRemoveField: (id: string) => void;
        onMoveField: (id: string, direction: 'up' | 'down') => void;
        onReorderField: (dragIndex: number, hoverIndex: number, parentId?: string) => void;
        onCloneField: (id: string) => void;
        onSelectField?: (id: string | null) => void;
        validationErrors?: Record<string, string>;
    };
    selectedFieldId?: string | null;
    expandedIds: Set<string>;
    isNested?: boolean;
    onDragStart: (e: React.DragEvent<HTMLDivElement>, index: number) => void;
    onDragEnter: (e: React.DragEvent<HTMLDivElement>, index: number) => void;
    onDragEnd: (e: React.DragEvent<HTMLDivElement>) => void;
}

const BuilderFieldItem: React.FC<BuilderFieldItemProps> = ({ 
    field, 
    index, 
    totalFields, 
    parentId, 
    handlers, 
    selectedFieldId,
    expandedIds,
    isNested,
    onDragStart,
    onDragEnter,
    onDragEnd
}) => {
    const { onUpdateField, onRemoveField, onCloneField, onSelectField, validationErrors } = handlers;
    const isSelected = selectedFieldId === field.id;
    const isExpanded = expandedIds.has(field.id);
    const isGroup = field.type === 'tab_group' || field.type === 'repeating_group';
    const fieldError = validationErrors?.[field.id];

    const handleToggleExpand = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isExpanded) {
            onSelectField?.(null); // Collapse
        } else {
            onSelectField?.(field.id); // Expand
        }
    };

    const handleOptionsChange = (id: string, value: string) => {
        const options = value.split(',').map(o => o.trim());
        onUpdateField(id, { options });
    };

    const handleAddTab = (currentTabs: FormTab[]) => {
        const newTab: FormTab = {
            id: crypto.randomUUID(),
            label: `Tab ${currentTabs.length + 1}`,
            fields: []
        };
        onUpdateField(field.id, { tabs: [...currentTabs, newTab] });
    };

    const handleRemoveTab = (currentTabs: FormTab[], tabIndex: number) => {
        if (currentTabs.length <= 1) return;
        const newTabs = [...currentTabs];
        newTabs.splice(tabIndex, 1);
        onUpdateField(field.id, { tabs: newTabs });
    };

    const handleUpdateTabLabel = (currentTabs: FormTab[], tabIndex: number, newLabel: string) => {
        const newTabs = [...currentTabs];
        newTabs[tabIndex] = { ...newTabs[tabIndex], label: newLabel };
        onUpdateField(field.id, { tabs: newTabs });
    };

    // Event Handlers Configuration
    const handleAddEvent = () => {
        const newEvent: FieldEvent = {
            trigger: 'onChange',
            action: {
                type: 'ajax_request',
                url: 'https://api.example.com/hook',
                method: 'POST'
            }
        };
        onUpdateField(field.id, { events: [...(field.events || []), newEvent] });
    };

    const handleRemoveEvent = (idx: number) => {
        const newEvents = [...(field.events || [])];
        newEvents.splice(idx, 1);
        onUpdateField(field.id, { events: newEvents });
    };

    const handleUpdateEvent = (idx: number, updates: Partial<FieldEvent> | { action: Partial<FieldEvent['action']> }) => {
        const newEvents = [...(field.events || [])];
        if ('action' in updates) {
            newEvents[idx] = { ...newEvents[idx], action: { ...newEvents[idx].action, ...updates.action } };
        } else {
            newEvents[idx] = { ...newEvents[idx], ...updates } as FieldEvent;
        }
        onUpdateField(field.id, { events: newEvents });
    };

    return (
        <div 
            id={`builder-field-${field.id}`}
            draggable
            onDragStart={(e) => onDragStart(e, index)}
            onDragEnter={(e) => onDragEnter(e, index)}
            onDragEnd={onDragEnd}
            onDragOver={(e) => e.preventDefault()} // Needed for drop to work
            onClick={(e) => { e.stopPropagation(); onSelectField?.(field.id); }}
            className={`group border rounded-xl shadow-sm transition-all duration-200 overflow-hidden ${
                isSelected 
                ? 'bg-white border-indigo-500 ring-1 ring-indigo-500 shadow-md' 
                : 'bg-white border-slate-200 hover:shadow-md'
            }`}
        >
            {/* Field Header */}
            <div 
                className={`flex items-center justify-between p-3 border-b transition-colors cursor-pointer ${
                    isSelected ? 'bg-indigo-50/50 border-indigo-100' : 'bg-slate-50 border-slate-100'
                }`}
                onClick={handleToggleExpand}
            >
                <div className="flex items-center gap-2 overflow-hidden">
                    {/* Drag Handle */}
                    <div className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 p-1">
                        <GripVertical className="w-4 h-4" />
                    </div>

                    {/* Collapse Toggle */}
                    <button 
                        onClick={handleToggleExpand}
                        className="text-slate-400 hover:text-indigo-600 transition-colors"
                    >
                        {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>

                    <span className={`w-6 h-6 flex-shrink-0 flex items-center justify-center rounded text-xs font-bold uppercase ${isGroup ? 'bg-purple-100 text-purple-600' : 'bg-indigo-100 text-indigo-600'}`}>
                        {FIELD_TYPES.find(t => t.type === field.type)?.icon || '?'}
                    </span>
                    <div className="flex flex-col min-w-0">
                         <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">
                            {field.label || field.type.replace('_', ' ')}
                        </span>
                        {field.propertyName && (
                             <span className={`text-[10px] font-mono truncate ${fieldError ? 'text-red-500 font-semibold' : 'text-slate-400'}`}>
                                {field.propertyName}
                             </span>
                        )}
                    </div>
                </div>
                
                <div className="flex items-center gap-1 ml-2">
                    {fieldError && (
                        <div className="mr-2" title={fieldError}>
                            <AlertCircle className="w-4 h-4 text-red-500" />
                        </div>
                    )}
                    <button 
                        onClick={(e) => { e.stopPropagation(); onCloneField(field.id); }}
                        className="p-1.5 text-slate-400 hover:text-indigo-600"
                        title="Clone Field"
                    >
                        <Copy className="w-4 h-4" />
                    </button>
                    <button 
                        onClick={(e) => { e.stopPropagation(); onRemoveField(field.id); }}
                        className="p-1.5 text-slate-400 hover:text-red-500"
                        title="Delete Field"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Field Body (Collapsible) */}
            {isExpanded && (
                <div className="p-4 space-y-4 animate-in slide-in-from-top-1 duration-200" onClick={(e) => e.stopPropagation()}>
                    
                    {/* Label & Property Name */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="col-span-2 sm:col-span-1">
                            <label className="block text-xs font-medium text-slate-500 mb-1">
                                {field.type === 'tab_group' ? 'Group Label' : (field.type === 'repeating_group' ? 'Table Header' : 'Label')}
                            </label>
                            <input 
                                type="text" 
                                value={field.label} 
                                onChange={(e) => onUpdateField(field.id, { label: e.target.value })}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                                placeholder="Enter label"
                            />
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                            <label className={`block text-xs font-medium mb-1 ${fieldError ? 'text-red-500' : 'text-slate-500'}`}>
                                Property Name (DB Column)
                            </label>
                            <input 
                                type="text" 
                                value={field.propertyName || ''} 
                                onChange={(e) => onUpdateField(field.id, { propertyName: e.target.value })}
                                className={`w-full px-3 py-2 bg-white border rounded-md text-sm font-mono focus:outline-none focus:ring-2 transition-all ${
                                    fieldError 
                                    ? 'border-red-500 bg-red-50 text-red-900 focus:border-red-500 focus:ring-red-500/20' 
                                    : 'border-slate-200 focus:ring-indigo-500/50 focus:border-indigo-500'
                                }`}
                                placeholder={field.label.toLowerCase().replace(/\s+/g, '_')}
                            />
                            {fieldError && (
                                <p className="text-[10px] text-red-500 mt-1 font-medium flex items-center gap-1">
                                    {fieldError}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Tab Group Editor */}
                    {field.type === 'tab_group' && field.tabs && (
                        <TabGroupEditor 
                            field={field} 
                            tabs={field.tabs} 
                            onAddTab={() => handleAddTab(field.tabs!)}
                            onRemoveTab={(idx) => handleRemoveTab(field.tabs!, idx)}
                            onUpdateTabLabel={(idx, val) => handleUpdateTabLabel(field.tabs!, idx, val)}
                            handlers={handlers}
                            selectedFieldId={selectedFieldId}
                            expandedIds={expandedIds}
                        />
                    )}

                    {/* Repeating Group Editor */}
                    {field.type === 'repeating_group' && (
                        <div className="mt-3 border border-slate-200 rounded-lg bg-slate-50/50 p-3">
                            <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-slate-500 uppercase">
                                <Table className="w-3 h-3" />
                                <span>Columns</span>
                            </div>
                            <FieldList 
                                fields={field.subFields || []}
                                parentId={field.id}
                                handlers={handlers}
                                selectedFieldId={selectedFieldId}
                                expandedIds={expandedIds}
                                isNested={true}
                            />
                        </div>
                    )}

                    {/* Inputs for standard fields */}
                    {!isGroup && (
                        <>
                            {(field.type === 'select' || field.type === 'radio') && (
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">Options (comma separated)</label>
                                    <input 
                                        type="text" 
                                        value={field.options?.join(', ')} 
                                        onChange={(e) => handleOptionsChange(field.id, e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
                                        placeholder="Option 1, Option 2, Option 3"
                                    />
                                </div>
                            )}

                            <div className="flex gap-3">
                                {field.type !== 'file_upload' && (
                                    <div className="flex-1">
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Placeholder</label>
                                        <input 
                                            type="text" 
                                            value={field.placeholder || ''} 
                                            onChange={(e) => onUpdateField(field.id, { placeholder: e.target.value })}
                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
                                            placeholder="..."
                                        />
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-slate-500 mb-1">Help Text</label>
                                <input 
                                    type="text" 
                                    value={field.helperText || ''} 
                                    onChange={(e) => onUpdateField(field.id, { helperText: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                                    placeholder="Description or instructions for the user..."
                                />
                            </div>

                            {!isNested && (
                                <div className="flex gap-3">
                                    <div className="flex-1">
                                        <label className="block text-xs font-medium text-slate-500 mb-1">Width</label>
                                        <select 
                                            value={field.width || 'full'}
                                            onChange={(e) => onUpdateField(field.id, { width: e.target.value as FieldWidth })}
                                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500"
                                        >
                                            <option value="full">Full Width</option>
                                            <option value="half">Half Width (50%)</option>
                                        </select>
                                    </div>
                                    <div className="flex items-end pb-2">
                                        <label className="flex items-center gap-2 cursor-pointer select-none">
                                            <div className="relative">
                                                <input 
                                                    type="checkbox" 
                                                    className="peer sr-only"
                                                    checked={field.required}
                                                    onChange={(e) => onUpdateField(field.id, { required: e.target.checked })}
                                                />
                                                <div className="block bg-slate-200 w-10 h-6 rounded-full peer-checked:bg-indigo-500 transition-colors"></div>
                                                <div className="dot absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform peer-checked:translate-x-4"></div>
                                            </div>
                                            <span className="text-xs font-medium text-slate-600">Required</span>
                                        </label>
                                    </div>
                                </div>
                            )}

                             {/* Events & Actions Section */}
                             <div className="pt-2 mt-2 border-t border-slate-100">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                                        <Activity className="w-3 h-3" /> Interactions
                                    </label>
                                    <button 
                                        onClick={handleAddEvent}
                                        className="text-[10px] text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
                                    >
                                        <Plus className="w-3 h-3" /> Add Event
                                    </button>
                                </div>
                                
                                <div className="space-y-3">
                                    {field.events?.map((event, evtIdx) => (
                                        <div key={evtIdx} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                                            <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-200/60">
                                                <div className="flex items-center gap-2">
                                                    <Zap className="w-3 h-3 text-amber-500" />
                                                    <select 
                                                        value={event.trigger}
                                                        onChange={(e) => handleUpdateEvent(evtIdx, { trigger: e.target.value as EventTrigger })}
                                                        className="bg-transparent text-xs font-medium text-slate-700 border-none p-0 focus:ring-0 cursor-pointer"
                                                    >
                                                        <option value="onChange">When Changed</option>
                                                        <option value="onBlur">When Focus Lost</option>
                                                    </select>
                                                </div>
                                                <button onClick={() => handleRemoveEvent(evtIdx)} className="text-slate-400 hover:text-red-500">
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>

                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-mono bg-indigo-100 text-indigo-700 px-1.5 rounded">AJAX</span>
                                                    <select 
                                                        value={event.action.method}
                                                        onChange={(e) => handleUpdateEvent(evtIdx, { action: { method: e.target.value as any } })}
                                                        className="text-xs bg-white border border-slate-200 rounded px-1 py-0.5"
                                                    >
                                                        <option value="GET">GET</option>
                                                        <option value="POST">POST</option>
                                                        <option value="PUT">PUT</option>
                                                        <option value="DELETE">DELETE</option>
                                                    </select>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Globe className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                                    <input 
                                                        type="text"
                                                        value={event.action.url}
                                                        onChange={(e) => handleUpdateEvent(evtIdx, { action: { url: e.target.value } })}
                                                        placeholder="https://api.example.com/endpoint"
                                                        className="w-full text-xs bg-white border border-slate-200 rounded px-2 py-1 focus:border-indigo-500 outline-none"
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {(!field.events || field.events.length === 0) && (
                                        <div className="text-center py-3 text-slate-400 text-[10px] italic">
                                            No events configured.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};


interface FieldListProps {
  fields: FormField[];
  parentId?: string;
  handlers: {
    onAddField: (type: FieldType, parentId?: string) => void;
    onUpdateField: (id: string, updates: Partial<FormField>) => void;
    onRemoveField: (id: string) => void;
    onMoveField: (id: string, direction: 'up' | 'down') => void;
    onReorderField: (dragIndex: number, hoverIndex: number, parentId?: string) => void;
    onCloneField: (id: string) => void;
    onSelectField?: (id: string | null) => void;
    validationErrors?: Record<string, string>;
  };
  selectedFieldId?: string | null;
  expandedIds: Set<string>;
  isNested?: boolean;
}

const FieldList: React.FC<FieldListProps> = ({ fields, parentId, handlers, selectedFieldId, expandedIds, isNested }) => {
  const { onAddField, onReorderField } = handlers;
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);

  // Filter available fields for nested contexts
  const availableFieldTypes = FIELD_TYPES.filter(ft => {
    if (isNested) return ft.category === 'input' && ft.type !== 'multi_line';
    if (parentId) return ft.type !== 'tab_group'; 
    return true;
  });

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    dragItem.current = index;
    e.dataTransfer.effectAllowed = 'move';
    // Optional: set drag image if needed, default browser behavior is usually fine for standard divs
  };

  const handleDragEnter = (e: React.DragEvent<HTMLDivElement>, index: number) => {
     dragOverItem.current = index;
  };

  const handleDragEnd = (e: React.DragEvent<HTMLDivElement>) => {
      if (dragItem.current !== null && dragOverItem.current !== null && dragItem.current !== dragOverItem.current) {
          onReorderField(dragItem.current, dragOverItem.current, parentId);
      }
      dragItem.current = null;
      dragOverItem.current = null;
  };

  return (
    <div className="space-y-3">
      {fields.length === 0 && (
        <div className="text-center py-6 text-slate-400 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50">
          <p className="text-xs">{isNested ? "No columns defined." : "Empty section."}</p>
          <p className="text-[10px]">{isNested ? "Add a field to create a column." : "Add a field to start."}</p>
        </div>
      )}

      {fields.map((field, index) => (
          <BuilderFieldItem 
            key={field.id}
            field={field}
            index={index}
            totalFields={fields.length}
            parentId={parentId}
            handlers={handlers}
            selectedFieldId={selectedFieldId}
            expandedIds={expandedIds}
            isNested={isNested}
            onDragStart={handleDragStart}
            onDragEnter={handleDragEnter}
            onDragEnd={handleDragEnd}
          />
      ))}

      {/* Add Field Buttons */}
      <div className="p-3 border-2 border-dashed border-slate-200 rounded-xl bg-slate-50/50 hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors">
        <p className="text-[10px] font-semibold text-slate-400 uppercase mb-2 text-center">
            {isNested ? "Add Column" : `Add Field to ${parentId ? 'Section' : 'Form'}`}
        </p>
        <div className="grid grid-cols-4 gap-2">
          {availableFieldTypes.map((ft) => (
            <button
              key={ft.type}
              onClick={() => onAddField(ft.type, parentId)}
              className="flex flex-col items-center justify-center gap-1 p-2 rounded-lg bg-white border border-slate-100 shadow-sm hover:shadow hover:border-indigo-300 hover:text-indigo-700 text-slate-600 transition-all active:scale-95"
            >
               <span className="font-bold text-lg leading-none">{ft.icon}</span>
               <span className="text-[10px] font-medium truncate w-full text-center">{ft.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

// Sub-component for managing the internals of a Tab Group in the Builder
const TabGroupEditor: React.FC<{
  field: FormField;
  tabs: FormTab[];
  onAddTab: () => void;
  onRemoveTab: (idx: number) => void;
  onUpdateTabLabel: (idx: number, val: string) => void;
  handlers: FieldListProps['handlers'];
  selectedFieldId?: string | null;
  expandedIds: Set<string>;
}> = ({ field, tabs, onAddTab, onRemoveTab, onUpdateTabLabel, handlers, selectedFieldId, expandedIds }) => {
  const [activeTabIndex, setActiveTabIndex] = useState(0);
  const activeTab = tabs[activeTabIndex];

  // Auto-switch tab if a child field is selected
  useEffect(() => {
    if (!selectedFieldId) return;
    const tabIndex = tabs.findIndex(t => findFieldRecursive(t.fields, selectedFieldId));
    if (tabIndex !== -1 && tabIndex !== activeTabIndex) {
        setActiveTabIndex(tabIndex);
    }
  }, [selectedFieldId, tabs]);

  return (
    <div className="mt-4 border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
      {/* Tab Headers */}
      <div className="flex items-center overflow-x-auto border-b border-slate-200 bg-white no-scrollbar">
        {tabs.map((tab, idx) => (
          <div 
            key={tab.id}
            className={`flex-shrink-0 flex items-center gap-2 px-3 py-2 text-xs font-medium border-r border-slate-100 cursor-pointer transition-colors ${
              activeTabIndex === idx ? 'bg-indigo-50 text-indigo-700 border-b-2 border-b-indigo-500' : 'text-slate-500 hover:bg-slate-50'
            }`}
            onClick={() => setActiveTabIndex(idx)}
          >
            {activeTabIndex === idx ? (
              <input 
                type="text" 
                value={tab.label}
                onChange={(e) => onUpdateTabLabel(idx, e.target.value)}
                className="w-20 bg-transparent border-none p-0 focus:ring-0 font-semibold text-xs text-indigo-700"
                autoFocus
              />
            ) : (
              <span className="max-w-[80px] truncate">{tab.label}</span>
            )}
            {tabs.length > 1 && (
              <button 
                onClick={(e) => { e.stopPropagation(); onRemoveTab(idx); if (idx === activeTabIndex) setActiveTabIndex(0); }}
                className="p-0.5 hover:bg-red-100 rounded-full text-slate-400 hover:text-red-500"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
        <button 
          onClick={onAddTab}
          className="px-3 py-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
          title="Add Tab"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Tab Content Area */}
      <div className="p-3 bg-slate-100/50 min-h-[200px]">
        {activeTab && (
          <FieldList 
            fields={activeTab.fields} 
            parentId={activeTab.id}
            handlers={handlers}
            selectedFieldId={selectedFieldId}
            expandedIds={expandedIds}
          />
        )}
      </div>
    </div>
  );
};

export const Builder: React.FC<BuilderProps> = (props) => {
  
  // Compute set of all expanded IDs (the selected field and its parents)
  // This ensures only one branch is open at a time, but parents stay open when child is selected
  const expandedIds = useMemo(() => getAllParentIds(props.fields, props.selectedFieldId), [props.fields, props.selectedFieldId]);

  // Effect to scroll the selected field into view
  useEffect(() => {
    if (props.selectedFieldId) {
      const element = document.getElementById(`builder-field-${props.selectedFieldId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [props.selectedFieldId]);

  return (
    <div className="flex flex-col h-full bg-white shadow-sm border-r border-slate-200">
      <div className="p-4 border-b border-slate-200 bg-slate-50/50">
        <h2 className="font-semibold text-slate-800 flex items-center gap-2">
          <Settings2 className="w-4 h-4" />
          Builder
        </h2>
        <p className="text-xs text-slate-500 mt-1">Configure fields and layout.</p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 bg-slate-50/30">
        <FieldList 
          fields={props.fields} 
          handlers={props}
          selectedFieldId={props.selectedFieldId}
          expandedIds={expandedIds}
        />
      </div>
    </div>
  );
};