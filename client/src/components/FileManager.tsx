import { useState, useEffect } from 'react';
import { 
    Box, 
    Button, 
    Typography, 
    List, 
    ListItem, 
    ListItemText,
    Alert,
    CircularProgress,
    Paper
} from '@mui/material';
import { CloudUpload } from '@mui/icons-material';

interface FileData {
    _id: string;
    filename: string;
    originalName: string;
    size: number;
    uploadDate: string;
}

function FileManager() {
    const [files, setFiles] = useState<FileData[]>([]);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    // Fetch user's files on component mount
    useEffect(() => {
        fetchFiles();
    }, []);

    const fetchFiles = async () => {
        setLoading(true);
        setError('');
        
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/files', {
                headers: {
                    'authorization': `Bearer ${token}`
                }
            });

            const data = await response.json();

            if (response.ok) {
                setFiles(data.files || []);
            } else {
                setError(data.error || 'Failed to fetch files');
            }
        } catch (err) {
            setError('Network error while fetching files');
        } finally {
            setLoading(false);
        }
    };

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => { // updates every time input file changes.
        if (event.target.files && event.target.files[0]) { // checking if file exists
            setSelectedFile(event.target.files[0]); // saving it to useState
            setError(''); // clear previous
            setSuccess(''); // clear previous
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) {
            setError('Please select a file first');
            return;
        }

        setUploading(true);
        setError('');
        setSuccess('');

        const formData = new FormData();
        formData.append('file', selectedFile); // file from "upload.single(file)" multer

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/files/upload', {
                method: 'POST',
                headers: {
                    'authorization': `Bearer ${token}`
                },
                body: formData
            });

            const data = await response.json();

            if (response.ok) {
                setSuccess('File uploaded successfully!');
                setSelectedFile(null);
                // Reset file input
                const fileInput = document.getElementById('file-input') as HTMLInputElement;
                if (fileInput) fileInput.value = '';
                // Refresh file list
                fetchFiles();
            } else {
                setError(data.error || 'Upload failed');
            }
        } catch (err) {
            setError('Network error during upload');
        } finally {
            setUploading(false);
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString();
    };

    return (
        <Box sx={{ maxWidth: 800, margin: '80px auto 20px', p: 3 }}>
            <Typography variant="h4" sx={{ mb: 3, textAlign: 'center' }}>
                My Cloud Drive
            </Typography>

            {/* Upload Section */}
            <Paper sx={{ p: 3, mb: 4 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                    Upload File
                </Typography>

                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <Button
                        variant="outlined"
                        component="label"
                    >
                        Choose File
                        <input
                            id="file-input"
                            type="file"
                            hidden
                            onChange={handleFileSelect}
                        />
                    </Button>

                    {selectedFile && (
                        <Typography sx={{ flex: 1 }}>
                            {selectedFile.name} ({formatFileSize(selectedFile.size)})
                        </Typography>
                    )}

                    <Button
                        variant="contained"
                        startIcon={uploading ? <CircularProgress size={20} color="inherit" /> : <CloudUpload />}
                        onClick={handleUpload}
                        disabled={!selectedFile || uploading}
                    >
                        {uploading ? 'Uploading...' : 'Upload'}
                    </Button>
                </Box>
            </Paper>

            {/* File List Section */}
            <Paper sx={{ p: 3 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>
                    Your Files
                </Typography>

                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                        <CircularProgress />
                    </Box>
                ) : files.length === 0 ? (
                    <Typography color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                        No files uploaded yet
                    </Typography>
                ) : (
                    <List>
                        {files.map((file) => (
                            <ListItem 
                                key={file._id}
                                sx={{ 
                                    borderBottom: '1px solid',
                                    borderColor: 'divider',
                                    '&:last-child': { borderBottom: 'none' }
                                }}
                            >
                                <ListItemText
                                    primary={file.originalName}
                                    secondary={`${formatFileSize(file.size)} • ${formatDate(file.uploadDate)}`}
                                />
                            </ListItem>
                        ))}
                    </List>
                )}
            </Paper>
        </Box>
    );
}

export default FileManager;