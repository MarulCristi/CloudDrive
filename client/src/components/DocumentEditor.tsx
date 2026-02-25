import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import EditorJS from '@editorjs/editorjs';
import Header from '@editorjs/header';
import List from '@editorjs/list';
import { Box, Button, Typography, Alert, CircularProgress } from '@mui/material';
import Table from '@editorjs/table';
import Quote from '@editorjs/quote';
import Code from '@editorjs/code';
import Delimiter from '@editorjs/delimiter';
import { Share, Lock, Download } from '@mui/icons-material';
import ShareDialog from './ShareModal';
import jsPDF from 'jspdf';

const DocumentEditor: React.FC = () => {
  const { id, token } = useParams<{ id?: string; token?: string }>();
  const navigate = useNavigate();
  const editorRef = useRef<EditorJS | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [canEdit, setCanEdit] = useState(true);
  const [isViewOnly, setIsViewOnly] = useState(false);

  // lock logic
  const [isLocked, setIsLocked] = useState(false);
  const [lockedBy, setLockedBy] = useState('');
  const [lockCountdown, setLockCountdown] = useState<number | null>(null); // null = user is active
  const [isOwner, setIsOwner] = useState(false); // track if current user owns the file

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

  const releaseLockBeacon = () => {
    // if (lockAcquiredRef.current && idRef.current && !tokenRef.current) {
    //   const authToken = localStorage.getItem('token');
    //   const blob = new Blob([], { type: 'application/json' });
    //   navigator.sendBeacon(
    //     `/api/files/${idRef.current}/lock-release?token=${authToken}`,
    //     blob
    //   );
    // }

    // Intentionally empty - we let the lease expire naturally
    // This gives the user 30 seconds to come back
  };

  useEffect(() => {
    window.addEventListener('beforeunload', releaseLockBeacon);
    return () => window.removeEventListener('beforeunload', releaseLockBeacon);
  }, []);

  // Heartbeat — renew lock AND check if owner force-unlocked us
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
          // Owner force-unlocked us - stop editing, refresh
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
        setFileName(data.filename || 'Untitled Document');

        setIsOwner(data.isOwner === true);

        const editAllowed = data.canEdit !== false && !token;
        setCanEdit(editAllowed);

        if (data.isImage) {
          setError('Images cannot be edited as text.');
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
                  setLockedBy(lockData.lockedBy);
                  // Start polling — page will auto-refresh when lock expires
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
            } as any,
            data: editorData,
            readOnly: !editAllowed || lockedState,
            placeholder: editAllowed && !lockedState ? 'Start typing your document...' : '',
          });
        }, 100);

      } catch (err: any) {
        setError(err.message);
        setLoading(false);
      }
    };

    initEditor();

    return () => {
      if (inactivityTimerRef.current) clearInterval(inactivityTimerRef.current);
      if (heartbeatRef.current) clearInterval(heartbeatRef.current);
      if (lockPollRef.current) clearInterval(lockPollRef.current);

      // Only release lock when navigating away within the app (not tab close)
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

  // Poll every 1s when locked - tracks whether holder is active or gone
  const startLockPolling = () => {
    if (lockPollRef.current) clearInterval(lockPollRef.current);
    lockPollRef.current = setInterval(async () => {
      try {
        const authToken = localStorage.getItem('token');
        const res = await fetch(`/api/files/${idRef.current}/lock-status`, {
          headers: { 'Authorization': `Bearer ${authToken}` },
        });
        const data = await res.json();

        if (!data.locked) {
          // Lock fully expired - refresh and acquire it
          clearInterval(lockPollRef.current!);
          lockPollRef.current = null;
          window.location.reload();
          return;
        }

        setLockedBy(data.lockedBy);

        if (data.isActive) {
          // User came back or is still here - hide countdown
          setLockCountdown(null);
        } else {
          // User has left - show countdown with remaining seconds
          setLockCountdown(data.remainingSeconds);
        }

      } catch (err) {
        console.error('Lock poll failed:', err);
      }
    }, 1000); // poll every 1 second for responsive UI
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
        // Strip basic HTML tags for plain text rendering
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
          // EditorJS list items can be a string or { content: string, items: [] }
          const text = typeof item === 'string' ? item : (item.content ?? '');
          const children = typeof item === 'object' && Array.isArray(item.items) ? item.items : [];
          const marker = ordered ? `${index + 1}.` : depth === 0 ? '•' : depth === 1 ? '◦' : '▪';

          pdf.setFontSize(11);
          pdf.setFont('helvetica', 'normal');
          const lineHeight = 11 * 1.4;
          checkPageBreak(lineHeight);

          // Draw marker at indented position
          const markerX = marginLeft + indent;
          pdf.text(marker, markerX, y);

          // Draw text with space after marker
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

          // Render nested children with increased depth
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
            y += 6; // extra space before heading
            renderWrappedText(block.data.text, marginLeft, fontSize, 'bold');
            y += 4; // extra space after heading
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
            // Draw left border line
            checkPageBreak(16);
            const quoteStartY = y;
            renderWrappedText(block.data.text, marginLeft + 15, 11, 'italic', 0);
            // Draw vertical bar
            pdf.setDrawColor(180, 180, 180);
            pdf.setLineWidth(2);
            pdf.line(marginLeft + 8, quoteStartY - 12, marginLeft + 8, y);
            if (block.data.caption) {
              renderWrappedText(`— ${block.data.caption}`, marginLeft + 15, 9, 'italic', 0);
            }
            y += 6;
            break;
          }
          case 'code': {
            y += 4;
            // Light gray background
            const codeLines = pdf.splitTextToSize(block.data.code, usableWidth - 20);
            const codeLineHeight = 10 * 1.3;
            const codeBlockHeight = codeLines.length * codeLineHeight + 16;
            checkPageBreak(Math.min(codeBlockHeight, 60)); // at least check for a few lines

            pdf.setFillColor(244, 244, 244);
            pdf.setFont('courier', 'normal');
            pdf.setFontSize(9);

            for (const line of codeLines) {
              checkPageBreak(codeLineHeight);
              // Draw background strip for this line
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

              // Calculate row height based on tallest cell
              let maxLines = 1;
              const cellLines: string[][] = row.map((cell: string) => {
                const plain = cell.replace(/<[^>]+>/g, '');
                const lines = pdf.splitTextToSize(plain, colWidth - cellPadding * 2);
                maxLines = Math.max(maxLines, lines.length);
                return lines;
              });
              const rowHeight = maxLines * tableFontSize * 1.3 + cellPadding * 2;

              checkPageBreak(rowHeight);

              // Draw cell borders and text
              for (let colIdx = 0; colIdx < colCount; colIdx++) {
                const cellX = marginLeft + colIdx * colWidth;

                // Background for header
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
                  pdf.text(
                    lines[li],
                    cellX + cellPadding,
                    y + cellPadding + tableFontSize + li * tableFontSize * 1.3
                  );
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

  const updateActivity = () => { lastActivityRef.current = Date.now(); };

  // ...existing handleSave, handleForceUnlock unchanged...
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
      if (!response.ok) throw new Error('Failed to save changes');
      setSuccess('Document saved successfully!');
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

  if (loading) return <CircularProgress />;

  return (
    <Box sx={{ width: '100%', maxWidth: '100%', padding: '20px', border: '1px solid', borderColor: 'divider', borderRadius: '4px', minHeight: '500px', '& .ce-block__content': { maxWidth: '100% !important' }, '& .ce-toolbar__content': { maxWidth: '100% !important' }, '& .codex-editor': { maxWidth: '100% !important' }, overflowX: 'auto' }}>
      <Box sx={{ marginBottom: '20px' }}>
        <Typography variant="h4" sx={{ marginBottom: '10px', marginTop: '25px' }}>{fileName}</Typography>

        {isViewOnly && <Alert severity="info" sx={{ mb: 2 }}>This is a view-only document. You cannot make changes.</Alert>}

        {isLocked && (
          <Alert severity="warning" sx={{ mb: 2 }} icon={<Lock />}>
            {lockCountdown === null ? (
              // User is actively editing
              <>This document is currently being edited by <strong>{lockedBy}</strong>. Wait for them to finish for it to become available.</>
            ) : (
              // User has left, countdown running
              <><strong>{lockedBy}</strong> left the document. They have <strong>{lockCountdown}s</strong> to return before you can edit.</>
            )}
          </Alert>
        )}

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

        {canEdit && !isViewOnly && !isLocked && (
          <>
            <Button variant="contained" onClick={handleSave} disabled={saving || loading} sx={{ mr: 1 }}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button variant="outlined" onClick={() => navigate('/')} sx={{ mr: 1 }}>Back</Button>
            <Button variant="outlined" startIcon={<Share />} onClick={() => setShareDialogOpen(true)}>Share</Button>
            <Button variant="outlined" startIcon={<Download />} onClick={handleDownloadPDF}>Download PDF</Button>
          </>
        )}
        {isLocked && canEdit && (
          <>
            <Button variant="outlined" onClick={() => navigate('/')} sx={{ mr: 1 }}>Back</Button>
            <Button variant="outlined" startIcon={<Download />} onClick={handleDownloadPDF}>Download PDF</Button>
          </>
        )}
        {isLocked && isOwner && (
          <Button
            variant="contained"
            color="error"
            onClick={handleForceUnlock}
            sx={{ mr: 1 }}
          >
            Force Unlock
          </Button>
        )}
        {isViewOnly && (
        <>
          <Button variant="outlined" onClick={() => navigate('/')}>Back to Files</Button>
          <Button variant="outlined" startIcon={<Download />} onClick={handleDownloadPDF}>Download PDF</Button>
        </>
        )}
      </Box>

      {loading ? (
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
    </Box>
  );
};

export default DocumentEditor;