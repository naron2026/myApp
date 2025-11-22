import React, { useState } from 'react';
import { Github, Save, X, Loader2, CheckCircle2, AlertCircle, FileJson } from 'lucide-react';

interface GitHubSyncProps {
  isOpen: boolean;
  onClose: () => void;
  content: string; // The content to save (JSON schema)
  filename?: string;
}

export const GitHubSync: React.FC<GitHubSyncProps> = ({ isOpen, onClose, content, filename = 'form-schema.json' }) => {
  const [token, setToken] = useState('');
  const [repo, setRepo] = useState(''); // Format: owner/repo
  const [path, setPath] = useState(filename);
  const [branch, setBranch] = useState('main');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  if (!isOpen) return null;

  const handleSync = async () => {
    if (!token || !repo || !path) {
      setStatus('error');
      setMessage('Please fill in all required fields.');
      return;
    }

    setStatus('loading');
    setMessage('Connecting to GitHub...');

    try {
      const [owner, repoName] = repo.split('/');
      if (!owner || !repoName) throw new Error('Invalid repository format. Use owner/repo.');

      const apiUrl = `https://api.github.com/repos/${owner}/${repoName}/contents/${path}`;
      
      // 1. Get current SHA if file exists (to allow updates)
      let sha: string | undefined;
      try {
        const getRes = await fetch(apiUrl, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
          },
        });
        if (getRes.ok) {
          const data = await getRes.json();
          sha = data.sha;
        }
      } catch (e) {
        // File doesn't exist yet, which is fine
      }

      // 2. Push (Create or Update)
      const putRes = await fetch(apiUrl, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `Update ${path} via Gemini FormCraft`,
          content: btoa(unescape(encodeURIComponent(content))), // Base64 encode handles special chars
          sha: sha, // Required if updating
          branch: branch,
        }),
      });

      if (!putRes.ok) {
        const errorData = await putRes.json();
        throw new Error(errorData.message || 'Failed to push to GitHub.');
      }

      setStatus('success');
      setMessage('Successfully saved to GitHub!');
      
      // Clear success message after delay
      setTimeout(() => {
        if (status === 'success') onClose();
      }, 2000);

    } catch (error: any) {
      setStatus('error');
      setMessage(error.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-100">
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-900 text-white">
          <div className="flex items-center gap-2">
            <Github className="w-5 h-5" />
            <h2 className="font-semibold">Sync to GitHub</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="p-6 space-y-4">
          {status === 'error' && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {message}
            </div>
          )}
          
          {status === 'success' && (
            <div className="p-3 bg-emerald-50 text-emerald-700 text-xs rounded-lg flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              {message}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Personal Access Token</label>
            <input 
              type="password" 
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="ghp_..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
            />
            <p className="text-[10px] text-slate-400 mt-1">Requires 'repo' scope.</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Repository</label>
                <input 
                  type="text" 
                  value={repo}
                  onChange={(e) => setRepo(e.target.value)}
                  placeholder="username/repo"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                />
             </div>
             <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Branch</label>
                <input 
                  type="text" 
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="main"
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none"
                />
             </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">File Path</label>
            <div className="flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg bg-slate-50">
                <FileJson className="w-4 h-4 text-slate-400" />
                <input 
                  type="text" 
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  placeholder="forms/schema.json"
                  className="w-full bg-transparent border-none text-sm focus:outline-none text-slate-700"
                />
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSync}
            disabled={status === 'loading' || status === 'success'}
            className="px-4 py-2 text-sm font-medium bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-50 flex items-center gap-2 transition-colors"
          >
            {status === 'loading' ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Pushing...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Push to GitHub
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
