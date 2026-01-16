import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { LocalDB } from '../services/db';
import { type Note } from '../types';
import { ApiProxy } from '../services/apiProxy';
import { v4 as uuidv4 } from 'uuid';

/**
 * STATE MANAGEMENT SUPREMACY
 * Replaces manual useEffect/useState with TanStack Query v5.
 * Features: Caching, Deduping, Optimistic Updates, Background Sync.
 */

// 1. Fetcher Function
const fetchNotes = async (): Promise<Note[]> => {
  const notes = await LocalDB.getAll<Note>(LocalDB.STORES.NOTES);
  // Sort by updated desc
  return notes.sort((a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime());
};

export const useSmartNotes = () => {
  const queryClient = useQueryClient();

  // 2. Query (Read)
  const { data: notes = [], isLoading, isError, error } = useQuery({
    queryKey: ['notes'],
    queryFn: fetchNotes,
    staleTime: 1000 * 60 * 5, // 5 minutes fresh
  });

  // 3. Mutations (Write)
  
  // ADD / UPDATE
  const saveNoteMutation = useMutation({
    mutationFn: async (note: Note) => {
      // Validate via Zero Trust Layer
      const validated = ApiProxy.validateNote(note);
      await LocalDB.put(LocalDB.STORES.NOTES, validated);
      return validated;
    },
    onMutate: async (newNote) => {
      // Optimistic Update
      await queryClient.cancelQueries({ queryKey: ['notes'] });
      const previousNotes = queryClient.getQueryData<Note[]>(['notes']);
      
      queryClient.setQueryData<Note[]>(['notes'], (old) => {
        const existing = old?.find(n => n.id === newNote.id);
        if (existing) {
          return old?.map(n => n.id === newNote.id ? newNote : n);
        }
        return [newNote, ...(old || [])];
      });

      return { previousNotes };
    },
    onError: (err, newNote, context) => {
      if (context?.previousNotes) {
        queryClient.setQueryData(['notes'], context.previousNotes);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    }
  });

  // DELETE
  const deleteNoteMutation = useMutation({
    mutationFn: async (id: string) => {
      await LocalDB.delete(LocalDB.STORES.NOTES, id);
      return id;
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ['notes'] });
      const previousNotes = queryClient.getQueryData<Note[]>(['notes']);
      
      queryClient.setQueryData<Note[]>(['notes'], (old) => old?.filter(n => n.id !== id));
      
      return { previousNotes };
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    }
  });

  // Wrapper Functions
  const createNote = () => {
    const newNote: Note = {
      id: uuidv4(),
      title: '',
      content: '',
      tags: [],
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      tasks: [],
      is_pinned: false,
      is_archived: false
    };
    saveNoteMutation.mutate(newNote);
    return newNote.id;
  };

  return {
    notes,
    isLoading,
    isError,
    error,
    saveNote: saveNoteMutation.mutate,
    deleteNote: deleteNoteMutation.mutate,
    createNote
  };
};