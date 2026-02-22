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
import { Share } from '@mui/icons-material';
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

  useEffect(() => {
    const initEditor = async () => {
      try {
        let response;
        
        // Check if it's a shared link (has token param)
        if (token) {
          setIsViewOnly(true);
          response = await fetch(`/api/files/shared/${token}`);
        } else {
          // Normal authenticated access
          const authToken = localStorage.getItem('token');
          response = await fetch(`/api/files/${id}/content`, {
            headers: {
              'Authorization': `Bearer ${authToken}`,
            },
          });
        }

        if (!response.ok) {
          setError('Failed to fetch file content');
          setLoading(false);
          return;
        }

        const data = await response.json();
        setFileName(data.filename || 'Untitled Document');
        setCanEdit(data.canEdit !== false && !token);
        
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
                editorData = {
                blocks: [
                    {
                    type: 'paragraph',
                    data: { text: editorData },
                    },
                ],
                };
            }
        }

        if (!editorData || !editorData.blocks) {
          editorData = { blocks: [{ type: 'paragraph', data: { text: '' } }] };
        }

        setLoading(false);

        setTimeout(() => {
          if (editorRef.current) return;
          
          editorRef.current = new EditorJS({
            holder: 'editorjs',
            tools: {
                header: Header,
                list: List,
                table: {
                    class: Table,
                    inlineToolbar: true,
                    config: {
                        rows: 2,
                        cols: 3,
                    }
                },
                quote: {
                    class: Quote,
                    inlineToolbar: true,
                    config: {
                        quotePlaceholder: 'Enter a quote',
                        captionPlaceholder: 'Quote\'s author',
                    }
                },
                code: Code,
                delimiter: Delimiter
            } as any,
            data: editorData,
            readOnly: !canEdit || isViewOnly,
            placeholder: canEdit && !isViewOnly ? 'Start typing your document...' : ''
          });
        }, 100);

      } catch (err: any) {
        setError(err.message);
        setLoading(false);
      }
    };

    initEditor();

    return () => {
      if (editorRef.current) {
        editorRef.current.destroy?.();
        editorRef.current = null;
      }
    };
  }, [id, token]);

  const handleSave = async () => {
    if (!editorRef.current || !canEdit) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const savedData = await editorRef.current.save();
      const authToken = localStorage.getItem('token');
      
      const response = await fetch(`/api/files/${id}/content`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
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

  if (loading) return <CircularProgress />;

  return (
    <Box 
    sx={{
        width: '100%',
        maxWidth: '100%',
        padding: '20px',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: '4px',
        minHeight: '500px',

        '& .ce-block__content': {
            maxWidth: '100% !important',
        },

        '& .ce-toolbar__content': {
            maxWidth: '100% !important',
        },

        '& .codex-editor': {
            maxWidth: '100% !important',
        },

        overflowX: 'auto',
    }}>
      <Box sx={{ marginBottom: '20px' }}>
        <Typography variant="h4" sx={{ marginBottom: '10px', marginTop: '25px' }}>
          {fileName}
        </Typography>
        
        {isViewOnly && (
          <Alert severity="info" sx={{ mb: 2 }}>
            This is a view-only document. You cannot make changes.
          </Alert>
        )}
        
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
        
        {canEdit && !isViewOnly && (
          <>
            <Button 
              variant="contained" 
              onClick={handleSave}
              disabled={saving || loading}
              sx={{ mr: 1 }}
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
            <Button 
              variant="outlined" 
              onClick={() => navigate('/')}
              sx={{ mr: 1 }}
            >
              Back
            </Button>
            <Button
              variant="outlined"
              startIcon={<Share />}
              onClick={() => setShareDialogOpen(true)}
            >
              Share
            </Button>
          </>
        )}
        
        {isViewOnly && (
          <Button 
            variant="outlined" 
            onClick={() => navigate('/login')}
          >
            Go to Login
          </Button>
        )}
      </Box>
        {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
            <CircularProgress />
            </Box>
        ) : (
            <Box
            id="editorjs"
            sx={{
                width: '100%',
                padding: '20px',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: '4px',
                minHeight: '500px',
                '& .ce-block': { marginBottom: '10px' },
                '& .ce-editor__redactor': { paddingBottom: '200px' },
                '& .codex-editor': { width: '100%' },

                '& .ce-paragraph': { 
                    textAlign: 'left',
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                    whiteSpace: 'normal',
                },
                '& .ce-header': {
                    textAlign: 'left',
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                },
                '& ul': {
                    textAlign: 'left',
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                    whiteSpace: 'normal',
                    paddingLeft: '20px',
                },
                '& li': {
                    textAlign: 'left',
                    wordBreak: 'break-word',
                    overflowWrap: 'break-word',
                    whiteSpace: 'normal',
                },

                '& .ce-block__settings': { display: isViewOnly ? 'none !important' : undefined },
                '& .ce-popover': { display: isViewOnly ? 'none !important' : undefined },
                '& .ce-toolbox': { display: isViewOnly ? 'none !important' : undefined },
                '& .ce-settings': { display: isViewOnly ? 'none !important' : undefined },

                // Hide all editor controls in view-only mode
                ...(isViewOnly && {
                    '& .ce-toolbar': { display: 'none !important' },
                    '& .ce-block__settings': { display: 'none !important' },
                    '& .ce-popover': { display: 'none !important' },
                    '& .ce-toolbox': { display: 'none !important' },
                    '& .ce-settings': { display: 'none !important' },
                    '& .ce-inline-toolbar': { display: 'none !important' },
                    '& .ce-conversion-toolbar': { display: 'none !important' },
                    pointerEvents: 'none',
                    userSelect: 'text',
                    '& *': {
                        cursor: 'default !important'
                    }
                }),

                overflowX: 'auto',
            }}
            />
        )}
      {canEdit && !isViewOnly && (
        <ShareDialog
          open={shareDialogOpen}
          onClose={() => setShareDialogOpen(false)}
          fileId={id || ''}
        />
      )}
    </Box>
  );
};

export default DocumentEditor;