import React, { useState, useMemo } from 'react';
import { FormField, FieldType, FormTab } from './types';
import { Builder } from './components/Builder';
import { Preview } from './components/Preview';
import { DatabaseDesigner } from './components/DatabaseDesigner';
import { AIGenerator } from './components/AIGenerator';
import { GitHubSync } from './components/GitHubSync';
import { Sparkles, Box, Eye, PenTool, Play, Database, Github } from 'lucide-react';

function App() {
  const [fields, setFields] = useState<FormField[]>([
    { id: '1', type: 'short_text', label: 'First Name', propertyName: 'first_name', placeholder: 'John', required: true, width: 'half' },
    { id: '2', type: 'short_text', label: 'Last Name', propertyName: 'last_name', placeholder: 'Doe', required: true, width: 'half' },
    { id: '3', type: 'short_text', label: 'Email Address', propertyName: 'email', placeholder: 'john@example.com', required: true, width: 'full' },
  ]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);
  const [isGithubModalOpen, setIsGithubModalOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'builder' | 'live' | 'database'>('builder');

  // --