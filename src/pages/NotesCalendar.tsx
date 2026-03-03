import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { NotesCalendarView } from '@/components/NotesCalendarView';
import { Plus, StickyNote, FileText, FileEdit, Pen, FileCode, Mic, Image } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NoteEditor } from '@/components/NoteEditor';
import { Note, Folder, NoteType } from '@/types/note';
import { BottomNavigation } from '@/components/BottomNavigation';
import { format, isSameDay } from 'date-fns';
import { NoteCard } from '@/components/NoteCard';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { saveNoteToDBSingle, deleteNoteFromDB } from '@/utils/noteStorage';
import { useNotes } from '@/contexts/NotesContext';
import { useSubscription, FREE_LIMITS } from '@/contexts/SubscriptionContext';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CalendarBackgroundSheet } from '@/components/CalendarBackgroundSheet';
import { getSetting } from '@/utils/settingsStorage';

const NotesCalendar = () => {
  const { t } = useTranslation();
  const { isPro, openPaywall } = useSubscription();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  
  const { notes, setNotes } = useNotes();
  
  const [selectedDateNotes, setSelectedDateNotes] = useState<Note[]>([]);
  // Use ref to track editing note ID to prevent stale reference issues
  const editingNoteIdRef = useRef<string | null>(null);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [defaultType, setDefaultType] = useState<NoteType>('regular');
  const [selectedNoteTypes] = useState<NoteType[]>([
    'sticky', 'lined', 'regular', 'code', 'voice'
  ]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [calendarBackground, setCalendarBackground] = useState<string>('none');
  const [isBackgroundSheetOpen, setIsBackgroundSheetOpen] = useState(false);
  
  // Load folders and background preference
  useEffect(() => {
    const loadSettings = async () => {
      const [savedFolders, savedBackground] = await Promise.all([
        getSetting<Folder[]>('folders', []),
        getSetting<string>('calendarBackground', 'none')
      ]);
      setFolders(savedFolders);
      setCalendarBackground(savedBackground);
    };
    loadSettings();
  }, []);

  // Filter notes for selected date
  useEffect(() => {
    if (date) {
      const notesForDate = notes.filter(note =>
        isSameDay(new Date(note.createdAt), date) &&
        selectedNoteTypes.includes(note.type)
      );
      setSelectedDateNotes(notesForDate);
    } else {
      setSelectedDateNotes([]);
    }
  }, [date, notes, selectedNoteTypes]);

  // Keep editingNote in sync with notes array using ID reference
  useEffect(() => {
    if (editingNoteIdRef.current && isEditorOpen) {
      const updatedNote = notes.find(n => n.id === editingNoteIdRef.current);
      if (updatedNote) {
        setEditingNote(updatedNote);
      }
    }
  }, [notes, isEditorOpen]);

  const handleSaveNote = useCallback(async (noteData: Omit<Note, 'id' | 'createdAt' | 'updatedAt'>) => {
    const currentEditingId = editingNoteIdRef.current;
    
    if (currentEditingId) {
      const existingNote = notes.find(n => n.id === currentEditingId);
      if (existingNote) {
        const updatedNote: Note = {
          ...existingNote,
          ...noteData,
          createdAt: existingNote.createdAt,
          updatedAt: new Date(),
        };
        const updatedNotes = notes.map(n => n.id === currentEditingId ? updatedNote : n);
        setNotes(updatedNotes);
        await saveNoteToDBSingle(updatedNote);
      }
    } else {
      const newNote: Note = {
        ...noteData,
        id: Date.now().toString(),
        title: noteData.title || `Note - ${format(date || new Date(), 'MMM dd, yyyy')}`,
        createdAt: date || new Date(),
        updatedAt: date || new Date(),
      };
      const updatedNotes = [...notes, newNote];
      setNotes(updatedNotes);
      await saveNoteToDBSingle(newNote);
    }
    
    setIsEditorOpen(false);
    editingNoteIdRef.current = null;
    setEditingNote(null);
    window.dispatchEvent(new Event('notesUpdated'));
  }, [notes, setNotes, date]);

  const handleEditNote = useCallback((note: Note) => {
    // Store the note ID in ref to prevent stale reference
    editingNoteIdRef.current = note.id;
    setEditingNote(note);
    setIsEditorOpen(true);
  }, []);

  const handleCreateNote = useCallback((type: NoteType) => {
    // Free users limited to 10 notes total (including archived and deleted)
    if (!isPro && notes.length >= FREE_LIMITS.maxNotes) {
      openPaywall('extra_notes');
      return;
    }
    setDefaultType(type);
    editingNoteIdRef.current = null;
    setEditingNote(null);
    setIsEditorOpen(true);
  }, [isPro, notes.length, openPaywall]);

  const handleDeleteNote = useCallback(async (noteId: string) => {
    const updatedNotes = notes.filter(n => n.id !== noteId);
    setNotes(updatedNotes);
    await deleteNoteFromDB(noteId);
    window.dispatchEvent(new Event('notesUpdated'));
  }, [notes, setNotes]);

  const handleCloseEditor = useCallback(() => {
    setIsEditorOpen(false);
    editingNoteIdRef.current = null;
    setEditingNote(null);
  }, []);

  const handleBackgroundChange = useCallback((background: string) => {
    setCalendarBackground(background);
  }, []);

  // Get all note dates for calendar indicators
  const noteDates = notes.map(n => new Date(n.createdAt));

  return (
    <div className="min-h-screen min-h-screen-dynamic bg-background pb-16 sm:pb-20 flex flex-col">
      <div style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }} className="flex-1 flex flex-col overflow-hidden">
        {/* Calendar View with Background */}
        <NotesCalendarView
          selectedDate={date}
          onDateSelect={setDate}
          highlightedDates={noteDates}
          showEmptyState={selectedDateNotes.length === 0}
          emptyStateMessage={t('calendar.noNotes', 'No notes for the day.')}
          emptyStateSubMessage={t('calendar.clickToCreate', 'Click "+" to create your notes.')}
          calendarBackground={calendarBackground}
          onBackgroundSettingsClick={() => setIsBackgroundSheetOpen(true)}
        />

        {/* Notes for Selected Date - Scrollable */}
        {selectedDateNotes.length > 0 && (
          <div className="flex-1 flex flex-col min-h-0 px-4">
            <h2 className="text-lg font-semibold text-foreground py-2 flex-shrink-0">
              {format(date || new Date(), 'MMMM dd, yyyy')}
            </h2>
            <ScrollArea className="flex-1">
              <div className="space-y-3 pb-4">
                {selectedDateNotes.map((note) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    onEdit={handleEditNote}
                    onDelete={handleDeleteNote}
                  />
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Floating Action Button */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="lg"
            className="fixed right-6 h-14 w-14 rounded-full shadow-lg z-30"
            style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))' }}
            disabled={!date}
          >
            <Plus className="h-6 w-6" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="mb-2 w-48 z-50 bg-card">
          <DropdownMenuItem onClick={() => handleCreateNote('sticky')} className="gap-2">
            <StickyNote className="h-4 w-4" />
            {t('notesMenu.stickyNotes')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleCreateNote('lined')} className="gap-2">
            <FileText className="h-4 w-4" />
            {t('notesMenu.linedNotes')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleCreateNote('regular')} className="gap-2">
            <FileEdit className="h-4 w-4" />
            {t('notesMenu.regularNotes')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleCreateNote('code')} className="gap-2">
            <FileCode className="h-4 w-4" />
            {t('notesMenu.codeNotes')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleCreateNote('voice')} className="gap-2">
            <Mic className="h-4 w-4" />
            {t('notes.noteTypes.voice', 'Voice Note')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <NoteEditor
        note={editingNote}
        isOpen={isEditorOpen}
        onClose={handleCloseEditor}
        onSave={handleSaveNote}
        defaultType={defaultType}
        returnTo="/calendar"
      />

      {/* Background Settings Sheet */}
      <CalendarBackgroundSheet
        isOpen={isBackgroundSheetOpen}
        onClose={() => setIsBackgroundSheetOpen(false)}
        currentBackground={calendarBackground}
        onBackgroundChange={handleBackgroundChange}
      />

      <BottomNavigation />
    </div>
  );
};

export default NotesCalendar;
