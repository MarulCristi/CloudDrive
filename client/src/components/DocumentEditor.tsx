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

const DocumentEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const editorRef = useRef<EditorJS | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');

  useEffect(() => {
    const initEditor = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch(`/api/files/${id}/content`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (!response.ok) return setError('Failed to fetch file content');

        const data = await response.json();
        setFileName(data.filename || 'Untitled Document')
        
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

        setLoading(false); // hide spinner FIRST so the div renders

        // Wait for the div to appear in the DOM
        setTimeout(() => {
          if (editorRef.current) return; // already initialized
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
        placeholder: 'Start typing your document...'
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
  }, [id]);

  const handleSave = async () => {
    if (!editorRef.current) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const savedData = await editorRef.current.save();
      const token = localStorage.getItem('token');
    //const content = JSON.stringify(savedData);
      
      const response = await fetch(`/api/files/${id}/content`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
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
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
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
        >
          Back
        </Button>
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

                // hide EditorJS add/remove/settings controls (+ / -)
                '& .ce-block__settings': { display: 'none !important' },
                '& .ce-popover': { display: 'none !important' },
                '& .ce-toolbox': { display: 'none !important' },
                '& .ce-settings': { display: 'none !important' },

                // keep layout safe
                overflowX: 'auto',
            }}
            />
        )}
    </Box>
  );
};

export default DocumentEditor;