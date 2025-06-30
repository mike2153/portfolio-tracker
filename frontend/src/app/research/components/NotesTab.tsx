'use client';

import React, { useState, useEffect } from 'react';
import { RefreshCw, Plus, Edit2, Trash2, Save, X, FileText } from 'lucide-react';
import { front_api_client } from '@/lib/front_api_client';
import type { TabContentProps, StockNote } from '@/types/stock-research';

export default function NotesTab({ ticker, data, isLoading, onRefresh }: TabContentProps) {
  const [notes, setNotes] = useState<StockNote[]>(data.notes || []);
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [editContent, setEditContent] = useState('');
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    if (data.notes) {
      setNotes(data.notes);
    } else {
      loadNotes();
    }
  }, [ticker, data.notes]);

  const loadNotes = async () => {
    setLoadingNotes(true);
    try {
      const notesData = await stockResearchAPI.getNotes(ticker);
      setNotes(notesData);
    } catch (error) {
      console.error('Error loading notes:', error);
    } finally {
      setLoadingNotes(false);
    }
  };

  const handleCreateNote = async () => {
    if (!newNoteContent.trim()) return;
    
    setSavingNote(true);
    try {
      const newNote = await stockResearchAPI.createNote(ticker, newNoteContent.trim());
      if (newNote) {
        setNotes(prev => [newNote, ...prev]);
        setNewNoteContent('');
        setIsCreating(false);
      }
    } catch (error) {
      console.error('Error creating note:', error);
    } finally {
      setSavingNote(false);
    }
  };

  const handleUpdateNote = async (noteId: number) => {
    if (!editContent.trim()) return;
    
    setSavingNote(true);
    try {
      const updatedNote = await stockResearchAPI.updateNote(noteId, editContent.trim());
      if (updatedNote) {
        setNotes(prev => prev.map(note => 
          note.id === noteId ? updatedNote : note
        ));
        setEditingId(null);
        setEditContent('');
      }
    } catch (error) {
      console.error('Error updating note:', error);
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: number) => {
    setDeletingId(noteId);
    try {
      const success = await stockResearchAPI.deleteNote(noteId);
      if (success) {
        setNotes(prev => prev.filter(note => note.id !== noteId));
      }
    } catch (error) {
      console.error('Error deleting note:', error);
    } finally {
      setDeletingId(null);
    }
  };

  const startEditing = (note: StockNote) => {
    setEditingId(note.id);
    setEditContent(note.content);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditContent('');
  };

  const cancelCreating = () => {
    setIsCreating(false);
    setNewNoteContent('');
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateString;
    }
  };

  if (loadingNotes || isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex items-center gap-2 text-gray-400">
          <RefreshCw className="w-5 h-5 animate-spin" />
          Loading notes...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Notes</h2>
          <p className="text-sm text-gray-400 mt-1">
            Personal notes for {ticker} • {notes.length} note{notes.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              onRefresh();
              loadNotes();
            }}
            disabled={isLoading || loadingNotes}
            className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${(isLoading || loadingNotes) ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => setIsCreating(true)}
            disabled={isCreating}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <Plus size={16} />
            Add Note
          </button>
        </div>
      </div>

      {/* Create Note Form */}
      {isCreating && (
        <div className="bg-gray-800 rounded-lg p-4 border border-blue-500">
          <h3 className="text-lg font-semibold text-white mb-3">Create New Note</h3>
          <textarea
            value={newNoteContent}
            onChange={(e) => setNewNoteContent(e.target.value)}
            placeholder="Write your note about this stock..."
            className="w-full h-32 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          />
          <div className="flex items-center justify-end gap-2 mt-3">
            <button
              onClick={cancelCreating}
              disabled={savingNote}
              className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            >
              <X size={16} />
              Cancel
            </button>
            <button
              onClick={handleCreateNote}
              disabled={!newNoteContent.trim() || savingNote}
              className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {savingNote ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Save size={16} />
              )}
              Save Note
            </button>
          </div>
        </div>
      )}

      {/* Notes List */}
      {notes.length === 0 ? (
        <div className="text-center py-16">
          <FileText size={48} className="mx-auto mb-4 text-gray-600" />
          <h3 className="text-lg font-medium text-gray-400 mb-2">No Notes Yet</h3>
          <p className="text-gray-500 mb-4">
            Start taking notes about {ticker} to track your research and thoughts.
          </p>
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors mx-auto"
          >
            <Plus size={16} />
            Create Your First Note
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {notes.map((note) => (
            <div key={note.id} className="bg-gray-800 rounded-lg p-4">
              {editingId === note.id ? (
                /* Edit Mode */
                <div>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full h-32 px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  />
                  <div className="flex items-center justify-between mt-3">
                    <div className="text-xs text-gray-400">
                      Last updated: {formatDate(note.updated_at)}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={cancelEditing}
                        disabled={savingNote}
                        className="flex items-center gap-2 px-3 py-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                      >
                        <X size={16} />
                        Cancel
                      </button>
                      <button
                        onClick={() => handleUpdateNote(note.id)}
                        disabled={!editContent.trim() || savingNote}
                        className="flex items-center gap-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50"
                      >
                        {savingNote ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save size={16} />
                        )}
                        Save
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                /* View Mode */
                <div>
                  <div className="flex items-start justify-between mb-3">
                    <div className="text-xs text-gray-400">
                      Created: {formatDate(note.created_at)}
                      {note.created_at !== note.updated_at && (
                        <span> • Updated: {formatDate(note.updated_at)}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => startEditing(note)}
                        className="p-1 text-gray-400 hover:text-white transition-colors"
                        title="Edit note"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteNote(note.id)}
                        disabled={deletingId === note.id}
                        className="p-1 text-gray-400 hover:text-red-400 transition-colors disabled:opacity-50"
                        title="Delete note"
                      >
                        {deletingId === note.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="text-white whitespace-pre-wrap leading-relaxed">
                    {note.content}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tips */}
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <h3 className="text-sm font-medium text-white mb-2">💡 Note-taking Tips</h3>
        <ul className="text-sm text-gray-400 space-y-1">
          <li>• Track your investment thesis and key reasons for considering {ticker}</li>
          <li>• Note important dates (earnings, ex-dividend, events)</li>
          <li>• Record price levels you're watching (support, resistance, target prices)</li>
          <li>• Keep track of management changes, product launches, or industry news</li>
          <li>• Document your analysis of financial metrics and ratios</li>
        </ul>
      </div>
    </div>
  );
}