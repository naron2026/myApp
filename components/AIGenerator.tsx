import React, { useState } from 'react';
import { FormField } from '../types';
import { generateFormSchema } from '../services/ai';
import { Sparkles, X, Loader2 } from 'lucide-react';

interface AIGeneratorProps {
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (fields: FormField[]) => void;
}

export const AIGenerator: React.FC<AIGeneratorProps> = ({ isOpen, onClose, onGenerate }) => {
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    
    setIsGenerating(true);
    setError(null);
    
    try {
      const fields = await generateFormSchema(prompt);
      onGenerate(fields);
      onClose();
      setPrompt('');
    } catch (err) {
      setError("Failed to generate form. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex items-center gap-2 text-indigo-700">
            <Sparkles className="w-5 h-5" />
            <h2 className="font-semibold text-lg">Generate with AI</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          <p className="text-slate-600 text-sm">
            Describe the form you need (e.g., "A registration form for a tech conference with dietary preferences" or "A customer satisfaction survey").
          </p>
          
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter your description here..."
            className="w-full h-32 p-3 rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-none text-slate-700 placeholder:text-slate-400"
            autoFocus
          />

          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">
              {error}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
            className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors shadow-sm"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Thinking...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Generate Form
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};