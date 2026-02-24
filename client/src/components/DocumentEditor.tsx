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
import { Share, Lock } from '@mui/icons-material';
import ShareDialog from './ShareModal';

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

        {/* ...existing buttons unchanged... */}
        {canEdit && !isViewOnly && !isLocked && (
          <>
            <Button variant="contained" onClick={handleSave} disabled={saving || loading} sx={{ mr: 1 }}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button variant="outlined" onClick={() => navigate('/')} sx={{ mr: 1 }}>Back</Button>
            <Button variant="outlined" startIcon={<Share />} onClick={() => setShareDialogOpen(true)}>Share</Button>
          </>
        )}
        {isLocked && canEdit && (
          <>
            <Button variant="outlined" onClick={() => navigate('/')} sx={{ mr: 1 }}>Back</Button>
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
        {isViewOnly && <Button variant="outlined" onClick={() => navigate('/')}>Back to Files</Button>}
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