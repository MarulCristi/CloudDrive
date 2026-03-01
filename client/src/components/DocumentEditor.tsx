import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import EditorJS from '@editorjs/editorjs';
import Header from '@editorjs/header';
import List from '@editorjs/list';
import {
  Box, Button, Typography, Alert, CircularProgress, Chip,
  Drawer, TextField, IconButton, Divider, Tooltip, Badge,
  Menu, MenuItem, ListItemIcon, ListItemText, useMediaQuery, useTheme
} from '@mui/material';
import Table from '@editorjs/table';
import Quote from '@editorjs/quote';
import Code from '@editorjs/code';
import Delimiter from '@editorjs/delimiter';
import Underline from '@editorjs/underline';
import Marker from '@editorjs/marker';
import InlineCode from '@editorjs/inline-code';
import Checklist from '@editorjs/checklist';
import Warning from '@editorjs/warning';
import Undo from 'editorjs-undo';
import {
  Share, Lock, Download, People, Comment as CommentIcon,
  Delete, CheckCircle, CheckCircleOutline, Close,
  Undo as UndoIcon, Redo as RedoIcon
} from '@mui/icons-material';
import ShareDialog from './ShareModal';
import jsPDF from 'jspdf';
import { useTranslation } from 'react-i18next';

interface CommentData {
  _id: string;
  blockIndex: number;
  selectedText: string;
  text: string;
  resolved: boolean;
  userId: { _id: string; username: string };
  createdAt: string;
  updatedAt: string;
}

const DocumentEditor: React.FC = () => {
  const { id, token } = useParams<{ id?: string; token?: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const editorRef = useRef<EditorJS | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [canEdit, setCanEdit] = useState(true);
  const [isViewOnly, setIsViewOnly] = useState(false);
  const [isImage, setIsImage] = useState(false);
  const [imagePath, setImagePath] = useState<string>('');

  // lock logic
  const [isLocked, setIsLocked] = useState(false);
  const [lockedBy, setLockedBy] = useState('');
  const [lockCountdown, setLockCountdown] = useState<number | null>(null);
  const [isOwner, setIsOwner] = useState(false);

  // Queue state
  const [queueNames, setQueueNames] = useState<string[]>([]);
  const [queuePosition, setQueuePosition] = useState<number>(-1);
  const [isFirstInQueue, setIsFirstInQueue] = useState(false);

  // Unsaved changes tracking
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const initialDataRef = useRef<string>('');
  const editorReadyRef = useRef(false); // Gate: only track changes after editor settles

  // Comments
  const [comments, setComments] = useState<CommentData[]>([]);
  const [commentDrawerOpen, setCommentDrawerOpen] = useState(false);
  const [newCommentText, setNewCommentText] = useState('');
  const [selectedText, setSelectedText] = useState('');
  const [selectedBlockIndex, setSelectedBlockIndex] = useState<number>(-1);
  const [showResolved, setShowResolved] = useState(false);
  const [commentCount, setCommentCount] = useState(0);

  // Context menu for comments
  const [contextMenu, setContextMenu] = useState<{ mouseX: number; mouseY: number } | null>(null);
  const pendingCommentRef = useRef<{ text: string; blockIndex: number } | null>(null);

  // Undo/Redo
  const undoRef = useRef<any>(null);

  const lockAcquiredRef = useRef(false);
  const lastActivityRef = useRef<number>(Date.now());
  const inactivityTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lockPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const idRef = useRef(id);
  const tokenRef = useRef(token);

  useEffect(() => {
    idRef.current = id;
    tokenRef.current = token;
  }, [id, token]);

  // ========== Unsaved changes: beforeunload warning ==========
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // ========== Check for changes (only after editor is ready) ==========
  const checkForChanges = useCallback(async () => {
    if (!editorRef.current || !lockAcquiredRef.current || !editorReadyRef.current) return;
    try {
      const currentData = await editorRef.current.save();
      const currentStr = JSON.stringify(currentData);
      setHasUnsavedChanges(currentStr !== initialDataRef.current);
    } catch {
      // editor might not be ready
    }
  }, []);

  // ========== Leave queue on unmount ==========
  const leaveQueue = useCallback(async () => {
    if (idRef.current && !tokenRef.current && !lockAcquiredRef.current) {
      const authToken = localStorage.getItem('token');
      try {
        await fetch(`/api/files/${idRef.current}/queue`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${authToken}` },
        });
      } catch (err) {
        console.error('Failed to leave queue:', err);
      }
    }
  }, []);

  const releaseLockBeacon = () => {
    // Let the lease expire naturally
  };

  useEffect(() => {
    window.addEventListener('beforeunload', releaseLockBeacon);
    return () => window.removeEventListener('beforeunload', releaseLockBeacon);
  }, []);

  const startHeartbeat = () => {
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    heartbeatRef.current = setInterval(async () => {
      if (!lockAcquiredRef.current || !idRef.current || tokenRef.current) return;
      try {
        const authToken = localStorage.getItem('token');
        const res = await fetch(`/api/files/${idRef.current}/lock`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${authToken}` },
        });

        if (res.status === 403) {
          lockAcquiredRef.current = false;
          clearInterval(heartbeatRef.current!);
          alert('The file owner has unlocked this document. Your session has ended.');
          window.location.reload();
        }
      } catch (err) {
        console.error('Heartbeat failed:', err);
      }
    }, 5000);
  };

  const startLockPolling = () => {
    if (lockPollRef.current) clearInterval(lockPollRef.current);
    lockPollRef.current = setInterval(async () => {
      try {
        const authToken = localStorage.getItem('token');
        const res = await fetch(`/api/files/${idRef.current}/lock-status`, {
          headers: { 'Authorization': `Bearer ${authToken}` },
        });
        const data = await res.json();

        // Lock is free and we're next - try to acquire
        if (!data.locked || data.youAreNext) {
          clearInterval(lockPollRef.current!);
          lockPollRef.current = null;

          // Try to acquire the lock
          const lockRes = await fetch(`/api/files/${idRef.current}/lock`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}` },
          });

          if (lockRes.ok) {
            // Got the lock - reload to start editing
            window.location.reload();
          } else {
            // Someone else got it first - start polling again
            startLockPolling();
          }
          return;
        }

        setLockedBy(data.lockedBy);
        setQueueNames(data.queue || []);
        setQueuePosition(data.queuePosition || -1);
        setIsFirstInQueue(data.isFirstInQueue || false);

        if (data.isActive) {
          setLockCountdown(null);
        } else {
          // Only show countdown to the first person in queue
          if (data.isFirstInQueue) {
            setLockCountdown(data.remainingSeconds);
          } else {
            setLockCountdown(null);
          }
        }
      } catch (err) {
        console.error('Lock poll failed:', err);
      }
    }, 1000);
  };

  useEffect(() => {
    const initEditor = async () => {
      try {
        let response;
        if (token) {
          setIsViewOnly(true);
          response = await fetch(`/api/files/shared/${token}`);
        } else {
          const authToken = localStorage.getItem('token');
          response = await fetch(`/api/files/${id}/content`, {
            headers: { 'Authorization': `Bearer ${authToken}` },
          });
        }

        if (!response.ok) {
          setError('Failed to fetch file content');
          setLoading(false);
          return;
        }

        const data = await response.json();
        setFileName(data.filename || t('editor.untitled'));
        setIsOwner(data.isOwner === true);

        const editAllowed = data.canEdit !== false && !token;
        setCanEdit(editAllowed);

        if (data.isImage) {
          setIsImage(true);
          setImagePath(data.imagePath || '');
          setIsViewOnly(true);
          setLoading(false);
          return;
        }

        let editorData = data.content;
        if (typeof editorData === 'string') {
          try {
            editorData = JSON.parse(editorData);
          } catch {
            editorData = { blocks: [{ type: 'paragraph', data: { text: editorData } }] };
          }
        }
        if (!editorData || !editorData.blocks) {
          editorData = { blocks: [{ type: 'paragraph', data: { text: '' } }] };
        }

        let lockedState = false;

        if (editAllowed && !token) {
          try {
            const authToken = localStorage.getItem('token');
            const lockResponse = await fetch(`/api/files/${id}/lock`, {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${authToken}` },
            });

            if (lockResponse.status === 423) {
              const lockData = await lockResponse.json();
              setIsLocked(true);
              lockedState = true;
              setLockedBy(lockData.lockedBy);
              setQueueNames(lockData.queue || []);
              setQueuePosition(lockData.queuePosition || -1);
              setIsFirstInQueue(lockData.isFirstInQueue || false);
              startLockPolling();
            } else if (lockResponse.ok) {
              lockAcquiredRef.current = true;
              startInactivityTimer();
              startHeartbeat();
            }
          } catch (err) {
            console.error('Failed to acquire lock:', err);
          }
        }

        setLoading(false);

        setTimeout(() => {
          if (editorRef.current) return;
          editorRef.current = new EditorJS({
            holder: 'editorjs',
            tools: {
              header: Header,
              list: List,
              table: { class: Table, inlineToolbar: true, config: { rows: 2, cols: 3 } },
              quote: { class: Quote, inlineToolbar: true, config: { quotePlaceholder: 'Enter a quote', captionPlaceholder: "Quote's author" } },
              code: Code,
              delimiter: Delimiter,
              underline: Underline,
              marker: { class: Marker, shortcut: 'CMD+SHIFT+M' },
              inlineCode: { class: InlineCode, shortcut: 'CMD+E' },
              checklist: { class: Checklist, inlineToolbar: true },
              warning: { class: Warning, inlineToolbar: true, config: { titlePlaceholder: 'Title', messagePlaceholder: 'Message' } },
            } as any,
            data: editorData,
            readOnly: !editAllowed || lockedState,
            placeholder: editAllowed && !lockedState ? 'Start typing your document...' : '',
            onReady: () => {
              // Initialize undo/redo (Ctrl+Z / Ctrl+Shift+Z)
              if (editorRef.current && editAllowed && !lockedState) {
                undoRef.current = new Undo({ editor: editorRef.current, config: { debounceTimer: 200 } });
                undoRef.current.initialize(editorData);
              }
              // Save the initial state AFTER the editor has fully rendered,
              // then enable change tracking after a short delay
              if (editorRef.current) {
                editorRef.current.save().then((savedData) => {
                  initialDataRef.current = JSON.stringify(savedData);
                  // Wait a tick so any initial onChange events finish
                  setTimeout(() => {
                    editorReadyRef.current = true;
                  }, 500);
                }).catch(() => {
                  // Fallback: use the data we loaded
                  initialDataRef.current = JSON.stringify(editorData);
                  setTimeout(() => {
                    editorReadyRef.current = true;
                  }, 500);
                });
              }
            },
            onChange: async () => {
              checkForChanges();
            },
          });
        }, 100);

      } catch (err: any) {
        setError(err.message);
        setLoading(false);
      }
    };

    initEditor();

    return () => {
      editorReadyRef.current = false;
      if (inactivityTimerRef.current) clearInterval(inactivityTimerRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (lockPollRef.current) clearInterval(lockPollRef.current);

      // Leave queue if we were waiting
      leaveQueue();

      if (lockAcquiredRef.current && id && !token) {
        const authToken = localStorage.getItem('token');
        fetch(`/api/files/${id}/lock`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${authToken}` },
        })
          .then(() => { lockAcquiredRef.current = false; })
          .catch(err => console.error('Failed to release lock:', err));
      }

      if (editorRef.current) {
        editorRef.current.destroy?.();
        editorRef.current = null;
      }
    };
  }, [id, token]);

  const startInactivityTimer = () => {
    if (inactivityTimerRef.current) clearInterval(inactivityTimerRef.current);
    inactivityTimerRef.current = setInterval(() => {
      const timeSinceLastActivity = Date.now() - lastActivityRef.current;
      if (timeSinceLastActivity >= 5 * 60 * 1000) {
        releaseLock();
      }
    }, 30000);
  };

  const releaseLock = async () => {
    if (lockAcquiredRef.current && id && !token) {
      const authToken = localStorage.getItem('token');
      try {
        await fetch(`/api/files/${id}/lock`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${authToken}` },
        });
        lockAcquiredRef.current = false;
        if (inactivityTimerRef.current) clearInterval(inactivityTimerRef.current);
        if (heartbeatRef.current) clearInterval(heartbeatRef.current);
        setIsLocked(true);
        setError('Document locked due to inactivity. Refresh to edit again.');
      } catch (err) {
        console.error('Failed to release lock:', err);
      }
    }
  };

  const handleDownloadPDF = async () => {
    if (!editorRef.current) return;

    try {
      const savedData = await editorRef.current.save();
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const marginLeft = 50;
      const marginRight = 50;
      const marginTop = 50;
      const marginBottom = 50;
      const usableWidth = pageWidth - marginLeft - marginRight;
      let y = marginTop;

      const checkPageBreak = (needed: number) => {
        if (y + needed > pageHeight - marginBottom) {
          pdf.addPage();
          y = marginTop;
        }
      };

      const renderWrappedText = (
        text: string,
        x: number,
        fontSize: number,
        fontStyle: string = 'normal',
        indent: number = 0
      ) => {
        const plain = text
          .replace(/<br\s*\/?>/gi, '\n')
          .replace(/<[^>]+>/g, '')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&nbsp;/g, ' ');

        pdf.setFontSize(fontSize);
        pdf.setFont('helvetica', fontStyle);
        const maxWidth = usableWidth - indent;
        const lines = pdf.splitTextToSize(plain, maxWidth);
        const lineHeight = fontSize * 1.4;

        for (const line of lines) {
          checkPageBreak(lineHeight);
          pdf.text(line, x + indent, y);
          y += lineHeight;
        }
      };

      const renderListItems = (
        items: any[],
        ordered: boolean,
        depth: number = 0,
        parentIndex: number[] = []
      ) => {
        const indent = depth * 25;
        const bulletIndent = ordered ? 20 : 15;

        items.forEach((item: any, index: number) => {
          const text = typeof item === 'string' ? item : (item.content ?? '');
          const children = typeof item === 'object' && Array.isArray(item.items) ? item.items : [];
          const marker = ordered ? `${index + 1}.` : depth === 0 ? '•' : depth === 1 ? '◦' : '▪';

          pdf.setFontSize(11);
          pdf.setFont('helvetica', 'normal');
          const lineHeight = 11 * 1.4;
          checkPageBreak(lineHeight);

          const markerX = marginLeft + indent;
          pdf.text(marker, markerX, y);

          const plain = text
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/&amp;/g, '&')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&nbsp;/g, ' ');

          const textX = markerX + bulletIndent;
          const maxWidth = usableWidth - indent - bulletIndent;
          const lines = pdf.splitTextToSize(plain, maxWidth);

          for (let i = 0; i < lines.length; i++) {
            if (i > 0) checkPageBreak(lineHeight);
            pdf.text(lines[i], textX, y);
            y += lineHeight;
          }

          if (children.length > 0) {
            renderListItems(children, ordered, depth + 1, [...parentIndex, index + 1]);
          }
        });
      };

      for (const block of savedData.blocks) {
        switch (block.type) {
          case 'header': {
            const sizes: Record<number, number> = { 1: 24, 2: 20, 3: 17, 4: 15, 5: 13, 6: 12 };
            const fontSize = sizes[block.data.level] || 14;
            y += 6;
            renderWrappedText(block.data.text, marginLeft, fontSize, 'bold');
            y += 4;
            break;
          }
          case 'paragraph': {
            renderWrappedText(block.data.text, marginLeft, 11);
            y += 4;
            break;
          }
          case 'list': {
            const ordered = block.data.style === 'ordered';
            renderListItems(block.data.items, ordered, 0);
            y += 4;
            break;
          }
          case 'quote': {
            y += 4;
            checkPageBreak(16);
            const quoteStartY = y;
            renderWrappedText(block.data.text, marginLeft + 15, 11, 'italic', 0);
            pdf.setDrawColor(180, 180, 180);
            pdf.setLineWidth(2);
            pdf.line(marginLeft + 8, quoteStartY - 12, marginLeft + 8, y);
            if (block.data.caption) {
              renderWrappedText(`- ${block.data.caption}`, marginLeft + 15, 9, 'italic', 0);
            }
            y += 6;
            break;
          }
          case 'code': {
            y += 4;
            const codeLines = pdf.splitTextToSize(block.data.code, usableWidth - 20);
            const codeLineHeight = 10 * 1.3;
            checkPageBreak(Math.min(codeLines.length * codeLineHeight + 16, 60));
            pdf.setFont('courier', 'normal');
            pdf.setFontSize(9);
            for (const line of codeLines) {
              checkPageBreak(codeLineHeight);
              pdf.setFillColor(244, 244, 244);
              pdf.rect(marginLeft, y - 9, usableWidth, codeLineHeight, 'F');
              pdf.text(line, marginLeft + 10, y);
              y += codeLineHeight;
            }
            y += 6;
            break;
          }
          case 'delimiter': {
            checkPageBreak(20);
            y += 8;
            pdf.setDrawColor(200, 200, 200);
            pdf.setLineWidth(1);
            pdf.line(marginLeft + 40, y, pageWidth - marginRight - 40, y);
            y += 14;
            break;
          }
          case 'table': {
            const rows: string[][] = block.data.content;
            if (!rows || rows.length === 0) break;
            const colCount = rows[0]!.length;
            const colWidth = usableWidth / colCount;
            const cellPadding = 6;
            const tableFontSize = 9;
            pdf.setFontSize(tableFontSize);
            y += 4;
            for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
              const row = rows[rowIdx]!;
              const isHeader = block.data.withHeadings && rowIdx === 0;
              let maxLines = 1;
              const cellLines: string[][] = row.map((cell: string) => {
                const plain = cell.replace(/<[^>]+>/g, '');
                const lines = pdf.splitTextToSize(plain, colWidth - cellPadding * 2);
                maxLines = Math.max(maxLines, lines.length);
                return lines;
              });
              const rowHeight = maxLines * tableFontSize * 1.3 + cellPadding * 2;
              checkPageBreak(rowHeight);
              for (let colIdx = 0; colIdx < colCount; colIdx++) {
                const cellX = marginLeft + colIdx * colWidth;
                if (isHeader) {
                  pdf.setFillColor(230, 230, 230);
                  pdf.rect(cellX, y, colWidth, rowHeight, 'FD');
                  pdf.setFont('helvetica', 'bold');
                } else {
                  pdf.setDrawColor(200, 200, 200);
                  pdf.rect(cellX, y, colWidth, rowHeight, 'S');
                  pdf.setFont('helvetica', 'normal');
                }
                pdf.setFontSize(tableFontSize);
                const lines = cellLines[colIdx]!;
                for (let li = 0; li < lines.length; li++) {
                  pdf.text(lines[li], cellX + cellPadding, y + cellPadding + tableFontSize + li * tableFontSize * 1.3);
                }
              }
              y += rowHeight;
            }
            y += 8;
            break;
          }
          default:
            break;
        }
      }

      const safeName = fileName.replace(/\.[^/.]+$/, '').replace(/[^a-z0-9_\- ]/gi, '_');
      pdf.save(`${safeName}.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
      setError('Failed to generate PDF');
    }
  };

  const updateActivity = () => {
    lastActivityRef.current = Date.now();
  };

  const handleSave = async () => {
    if (!editorRef.current || !canEdit || isLocked) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const savedData = await editorRef.current.save();
      const authToken = localStorage.getItem('token');
      const response = await fetch(`/api/files/${id}/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` },
        body: JSON.stringify({ content: savedData }),
      });
      if (!response.ok) throw new Error(t('editor.saveFailed'));
      // Update initial data reference so it's no longer "unsaved"
      initialDataRef.current = JSON.stringify(savedData);
      setHasUnsavedChanges(false);
      setSuccess(t('editor.savedSuccess'));
      setTimeout(() => navigate('/'), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleForceUnlock = async () => {
    try {
      const authToken = localStorage.getItem('token');
      const response = await fetch(`/api/files/${id}/force-unlock`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      if (response.ok) {
        setSuccess('File unlocked! Refreshing...');
        setTimeout(() => window.location.reload(), 1000);
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to unlock file');
      }
    } catch (err) {
      setError('Failed to unlock file');
    }
  };

  const fetchComments = useCallback(async () => {
    try {
      let response;
      if (token) {
        response = await fetch(`/api/files/shared/${token}/comments`);
      } else {
        const authToken = localStorage.getItem('token');
        response = await fetch(`/api/files/${id}/comments`, {
          headers: { 'Authorization': `Bearer ${authToken}` },
        });
      }
      if (response.ok) {
        const data = await response.json();
        setComments(data.comments || []);
        setCommentCount((data.comments || []).filter((c: CommentData) => !c.resolved).length);
      }
    } catch (err) {
      console.error('Failed to fetch comments:', err);
    }
  }, [id, token]);

  useEffect(() => {
    if (id || token) {
      fetchComments();
    }
  }, [id, token, fetchComments]);

  const handleAddComment = async () => {
    if (!newCommentText.trim() || !selectedText.trim() || selectedBlockIndex < 0) return;

    try {
      const authToken = localStorage.getItem('token');
      const response = await fetch(`/api/files/${id}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          blockIndex: selectedBlockIndex,
          selectedText: selectedText,
          text: newCommentText,
        }),
      });

      if (response.ok) {
        setNewCommentText('');
        setSelectedText('');
        setSelectedBlockIndex(-1);
        fetchComments();
      } else {
        const data = await response.json();
        setError(data.error || 'Failed to add comment');
      }
    } catch (err) {
      setError('Failed to add comment');
    }
  };

  const handleResolveComment = async (commentId: string) => {
    try {
      const authToken = localStorage.getItem('token');
      const response = await fetch(`/api/files/${id}/comments/${commentId}/resolve`, {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      if (response.ok) {
        fetchComments();
      }
    } catch (err) {
      console.error('Failed to resolve comment:', err);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      const authToken = localStorage.getItem('token');
      const response = await fetch(`/api/files/${id}/comments/${commentId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${authToken}` },
      });
      if (response.ok) {
        fetchComments();
      }
    } catch (err) {
      console.error('Failed to delete comment:', err);
    }
  };

  const captureSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || !selection.toString().trim()) {
      return null;
    }

    const text = selection.toString().trim();
    const editorHolder = document.getElementById('editorjs');
    if (!editorHolder) return null;

    const anchorNode = selection.anchorNode;
    if (!anchorNode) return null;

    let blockEl: HTMLElement | null = anchorNode.nodeType === 1
      ? anchorNode as HTMLElement
      : anchorNode.parentElement;

    while (blockEl && !blockEl.classList?.contains('ce-block')) {
      blockEl = blockEl.parentElement;
    }

    if (!blockEl) return null;

    const allBlocks = editorHolder.querySelectorAll('.ce-block');
    let blockIndex = -1;
    allBlocks.forEach((b, i) => {
      if (b === blockEl) blockIndex = i;
    });

    if (blockIndex >= 0) {
      return { text, blockIndex };
    }
    return null;
  };

  const handleContextMenu = useCallback((e: MouseEvent) => {
    const result = captureSelection();
    if (result) {
      e.preventDefault();
      pendingCommentRef.current = result;
      setContextMenu({ mouseX: e.clientX, mouseY: e.clientY });
    }
  }, []);

  const handleContextMenuComment = () => {
    if (pendingCommentRef.current) {
      setSelectedText(pendingCommentRef.current.text);
      setSelectedBlockIndex(pendingCommentRef.current.blockIndex);
      setCommentDrawerOpen(true);
      pendingCommentRef.current = null;
    }
    setContextMenu(null);
  };

  const handleContextMenuClose = () => {
    setContextMenu(null);
    pendingCommentRef.current = null;
  };

  useEffect(() => {
    const editorHolder = document.getElementById('editorjs');
    if (editorHolder) {
      editorHolder.addEventListener('contextmenu', handleContextMenu);
      return () => editorHolder.removeEventListener('contextmenu', handleContextMenu);
    }
  });

  const formatCommentDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const filteredComments = showResolved ? comments : comments.filter(c => !c.resolved);

  if (loading) return <CircularProgress />;

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', padding: { xs: '10px', sm: '20px' }, border: '1px solid', borderColor: 'divider', borderRadius: '4px', minHeight: '500px', '& .ce-block__content': { maxWidth: '100% !important' }, '& .ce-toolbar__content': { maxWidth: '100% !important' }, '& .codex-editor': { maxWidth: '100% !important' }, overflowX: 'auto' }}>
      <Box sx={{ marginBottom: '20px' }}>
        <Typography variant={isMobile ? 'h5' : 'h4'} sx={{ marginBottom: '10px', marginTop: '25px', wordBreak: 'break-word' }}>
          {fileName}
          {hasUnsavedChanges && (
            <Chip label={t('editor.unsavedChanges')} size="small" color="warning" sx={{ ml: 2, verticalAlign: 'middle' }} />
          )}
        </Typography>

        {isViewOnly && !isImage && <Alert severity="info" sx={{ mb: 2 }}>{t('editor.viewOnly')}</Alert>}

        {isLocked && (
          <Alert severity="warning" sx={{ mb: 2 }} icon={<Lock />}>
            {lockCountdown === null ? (
              isFirstInQueue ? (
                <span dangerouslySetInnerHTML={{ __html: t('editor.lockedBy', { user: lockedBy }) + ' ' + t('editor.youAreNext') }} />
              ) : queuePosition > 0 ? (
                <span dangerouslySetInnerHTML={{ __html: t('editor.lockedBy', { user: lockedBy }) + ' ' + t('editor.queuePosition', { position: queuePosition }) }} />
              ) : (
                <span dangerouslySetInnerHTML={{ __html: t('editor.lockedBy', { user: lockedBy }) + ' ' + t('editor.waitingForFinish') }} />
              )
            ) : (
              <span dangerouslySetInnerHTML={{ __html: t('editor.leftDocument', { user: lockedBy, seconds: lockCountdown }) }} />
            )}
          </Alert>
        )}

        {/* Show queue info */}
        {isLocked && queueNames.length > 0 && (
          <Alert severity="info" sx={{ mb: 2 }} icon={<People />}>
            <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 0.5 }}>
              {t('fileManager.waitingQueue')} ({queueNames.length} {queueNames.length === 1 ? t('fileManager.person') : t('fileManager.people')}):
            </Typography>
            {queueNames.map((name, idx) => (
              <Chip
                key={idx}
                label={`${idx + 1}. ${name}`}
                size="small"
                variant={idx === (queuePosition - 1) ? 'filled' : 'outlined'}
                color={idx === (queuePosition - 1) ? 'primary' : 'default'}
                sx={{ mr: 0.5, mb: 0.5 }}
              />
            ))}
          </Alert>
        )}

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

        {canEdit && !isViewOnly && !isLocked && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
            <Tooltip title={t('editor.undo')}>
              <IconButton onClick={() => undoRef.current?.undo()} size={isMobile ? 'small' : 'medium'}><UndoIcon /></IconButton>
            </Tooltip>
            <Tooltip title={t('editor.redo')}>
              <IconButton onClick={() => undoRef.current?.redo()} size={isMobile ? 'small' : 'medium'}><RedoIcon /></IconButton>
            </Tooltip>
            <Button variant="outlined" size={isMobile ? 'small' : 'medium'} startIcon={<Share />} onClick={() => setShareDialogOpen(true)}>{t('editor.share')}</Button>
            <Button variant="outlined" size={isMobile ? 'small' : 'medium'} startIcon={<Download />} onClick={handleDownloadPDF}>{isMobile ? 'PDF' : t('editor.downloadPdf')}</Button>
            <Badge badgeContent={commentCount} color="primary">
              <Button variant="outlined" size={isMobile ? 'small' : 'medium'} startIcon={<CommentIcon />} onClick={() => setCommentDrawerOpen(true)}>{t('editor.comments')}</Button>
            </Badge>
            <Box sx={{ flexGrow: 1 }} />
            <Button variant="contained" size={isMobile ? 'small' : 'medium'} onClick={handleSave} disabled={saving || loading}>
              {saving ? t('editor.saving') : t('editor.save')}
            </Button>
          </Box>
        )}
        {isLocked && canEdit && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
            <Button variant="outlined" size={isMobile ? 'small' : 'medium'} startIcon={<Download />} onClick={handleDownloadPDF}>{isMobile ? 'PDF' : t('editor.downloadPdf')}</Button>
            <Badge badgeContent={commentCount} color="primary">
              <Button variant="outlined" size={isMobile ? 'small' : 'medium'} startIcon={<CommentIcon />} onClick={() => setCommentDrawerOpen(true)}>{t('editor.comments')}</Button>
            </Badge>
          </Box>
        )}
        {isLocked && isOwner && (
          <Button
            variant="contained"
            color="error"
            size={isMobile ? 'small' : 'medium'}
            onClick={handleForceUnlock}
            sx={{ mt: 1 }}
          >
            {t('editor.forceUnlock')}
          </Button>
        )}
        {isViewOnly && (
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
            {!isImage && <Button variant="outlined" size={isMobile ? 'small' : 'medium'} startIcon={<Download />} onClick={handleDownloadPDF}>{isMobile ? 'PDF' : t('editor.downloadPdf')}</Button>}
            <Badge badgeContent={commentCount} color="primary">
              <Button variant="outlined" size={isMobile ? 'small' : 'medium'} startIcon={<CommentIcon />} onClick={() => setCommentDrawerOpen(true)}>{t('editor.comments')}</Button>
            </Badge>
          </Box>
        )}
      </Box>

      {isImage ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: { xs: 1, sm: 3 }, border: '1px solid', borderColor: 'divider', borderRadius: '4px', minHeight: '300px' }}>
          <img
            src={`/${imagePath}`}
            alt={fileName}
            style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', borderRadius: 8 }}
          />
        </Box>
      ) : loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>
      ) : (
        <Box
          id="editorjs"
          onClick={updateActivity}
          onKeyDown={updateActivity}
          onMouseMove={updateActivity}
          sx={{
            width: '100%', padding: '20px', border: '1px solid', borderColor: 'divider', borderRadius: '4px', minHeight: '500px',
            '& .ce-block': { marginBottom: '10px' },
            '& .ce-editor__redactor': { paddingBottom: '200px' },
            '& .codex-editor': { width: '100%' },
            '& .ce-paragraph': { textAlign: 'left', wordBreak: 'break-word', overflowWrap: 'break-word', whiteSpace: 'normal' },
            '& .ce-header': { textAlign: 'left', wordBreak: 'break-word', overflowWrap: 'break-word' },
            '& ul': { textAlign: 'left', wordBreak: 'break-word', overflowWrap: 'break-word', whiteSpace: 'normal', paddingLeft: '20px' },
            '& li': { textAlign: 'left', wordBreak: 'break-word', overflowWrap: 'break-word', whiteSpace: 'normal' },
            ...((isViewOnly || isLocked) && {
              '& .ce-toolbar': { display: 'none !important' },
              '& .ce-block__settings': { display: 'none !important' },
              '& .ce-popover': { display: 'none !important' },
              '& .ce-toolbox': { display: 'none !important' },
              '& .ce-settings': { display: 'none !important' },
              '& .ce-inline-toolbar': { display: 'none !important' },
              '& .ce-conversion-toolbar': { display: 'none !important' },
              pointerEvents: 'none', userSelect: 'text',
              '& *': { cursor: 'default !important' }
            }),
            overflowX: 'auto',
          }}
        />
      )}
      {canEdit && !isViewOnly && !isLocked && (
        <ShareDialog open={shareDialogOpen} onClose={() => setShareDialogOpen(false)} fileId={id || ''} />
      )}

      {/* Right-click context menu */}
      <Menu
        open={contextMenu !== null}
        onClose={handleContextMenuClose}
        anchorReference="anchorPosition"
        anchorPosition={contextMenu !== null ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined}
      >
        <MenuItem onClick={handleContextMenuComment}>
          <ListItemIcon><CommentIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('editor.commentsDrawer.addCommentMenu')}</ListItemText>
        </MenuItem>
      </Menu>

      {/* Comments Drawer */}
      <Drawer
        anchor="right"
        open={commentDrawerOpen}
        onClose={() => setCommentDrawerOpen(false)}
        PaperProps={{ sx: { width: { xs: '100%', sm: 400 }, p: 2 } }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6">
            <CommentIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
            {t('editor.commentsDrawer.title')}
          </Typography>
          <IconButton onClick={() => setCommentDrawerOpen(false)}><Close /></IconButton>
        </Box>

        {/* Add new comment (only if text is selected and user can interact) */}
        {selectedText && !isViewOnly && (
          <Box sx={{ mb: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'action.hover' }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('editor.commentsDrawer.on')}:</Typography>
            <Typography
              variant="body2"
              sx={{
                fontStyle: 'italic',
                p: 1,
                borderLeft: '3px solid',
                borderColor: 'primary.main',
                bgcolor: 'background.paper',
                borderRadius: 1,
                mb: 1,
                wordBreak: 'break-word',
              }}
            >
              "{selectedText.length > 150 ? selectedText.substring(0, 150) + '...' : selectedText}"
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              Block #{selectedBlockIndex + 1}
            </Typography>
            <TextField
              fullWidth
              multiline
              minRows={2}
              maxRows={4}
              placeholder="Write your comment..."
              value={newCommentText}
              onChange={(e) => setNewCommentText(e.target.value)}
              size="small"
              sx={{ mb: 1 }}
            />
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                size="small"
                onClick={handleAddComment}
                disabled={!newCommentText.trim()}
              >
                {t('editor.commentsDrawer.post')}
              </Button>
              <Button
                variant="outlined"
                size="small"
                onClick={() => { setSelectedText(''); setSelectedBlockIndex(-1); }}
              >
                {t('fileManager.cancel')}
              </Button>
            </Box>
          </Box>
        )}

        {!selectedText && !isViewOnly && (
          <Alert severity="info" sx={{ mb: 2 }}>
            {t('editor.commentsDrawer.selectText')}
          </Alert>
        )}

        <Divider sx={{ mb: 2 }} />

        {/* Toggle resolved */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="subtitle2">
            {showResolved ? t('editor.commentsDrawer.resolved') : t('editor.commentsDrawer.active')} ({filteredComments.length})
          </Typography>
          <Button size="small" onClick={() => setShowResolved(!showResolved)}>
            {showResolved ? t('editor.commentsDrawer.showActive') : t('editor.commentsDrawer.showResolved')}
          </Button>
        </Box>

        {/* Comment list */}
        {filteredComments.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
            {showResolved ? t('editor.commentsDrawer.noResolved') : t('editor.commentsDrawer.noComments')}
          </Typography>
        ) : (
          filteredComments.map((comment) => (
            <Box
              key={comment._id}
              sx={{
                mb: 2,
                p: 2,
                border: '1px solid',
                borderColor: comment.resolved ? 'success.main' : 'divider',
                borderRadius: 2,
                opacity: comment.resolved ? 0.7 : 1,
                bgcolor: comment.resolved ? 'action.disabledBackground' : 'background.paper',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold' }}>
                  {comment.userId?.username || 'Unknown'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatCommentDate(comment.createdAt)}
                </Typography>
              </Box>

              <Typography
                variant="body2"
                sx={{
                  fontStyle: 'italic',
                  p: 0.5,
                  borderLeft: '2px solid',
                  borderColor: 'text.secondary',
                  mb: 1,
                  fontSize: '0.8rem',
                  color: 'text.secondary',
                  wordBreak: 'break-word',
                }}
              >
                "{comment.selectedText.length > 100 ? comment.selectedText.substring(0, 100) + '...' : comment.selectedText}"
              </Typography>

              <Chip label={`Block #${comment.blockIndex + 1}`} size="small" variant="outlined" sx={{ mb: 1 }} />

              <Typography variant="body2" sx={{ mb: 1, wordBreak: 'break-word' }}>
                {comment.text}
              </Typography>

              {comment.resolved && (
                <Chip label={t('editor.commentsDrawer.resolved')} size="small" color="success" sx={{ mb: 1 }} />
              )}

              {!isViewOnly && (
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <Tooltip title={comment.resolved ? t('editor.commentsDrawer.reopen') : t('editor.commentsDrawer.resolve')}>
                    <IconButton size="small" onClick={() => handleResolveComment(comment._id)} color={comment.resolved ? 'success' : 'default'}>
                      {comment.resolved ? <CheckCircle fontSize="small" /> : <CheckCircleOutline fontSize="small" />}
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={t('editor.commentsDrawer.delete')}>
                    <IconButton size="small" onClick={() => handleDeleteComment(comment._id)} color="error">
                      <Delete fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              )}
            </Box>
          ))
        )}
      </Drawer>
    </Box>
  );
};

export default DocumentEditor;