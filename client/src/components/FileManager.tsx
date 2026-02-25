import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Box, 
    Button, 
    Typography, 
    List, 
    ListItem, 
    ListItemText,
    Alert,
    CircularProgress,
    Paper,
    TextField,
    Chip,
    IconButton,
    Avatar,
    Tooltip,
    ToggleButtonGroup,
    ToggleButton
} from '@mui/material';
import { Check, Close, CloudUpload, Delete, Edit, SortByAlpha, Schedule } from '@mui/icons-material';
import { jwtDecode } from 'jwt-decode';

interface FileData {
    _id: string;
    filename: string;
    originalName: string;
    size: number;
    createdAt: string;
    uploadDate: string;
    role?: 'owner' | 'editor';
}

type SortKey = 'name' | 'createdAt' | 'uploadDate';

function FileManager() {
    const [files, setFiles] = useState<FileData[]>([]);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [editingNameId, setEditingNameId] = useState<string | null>(null);
    const [newName, setNewName] = useState('');
    const [fileExtension, setFileExtension] = useState('');
    const [username, setUsername] = useState('');
    const [profilePicture, setProfilePicture] = useState<string | null>(null);
    const [sortKey, setSortKey] = useState<SortKey>('uploadDate');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    const navigate = useNavigate();

    useEffect(() => {
        fetchFiles();
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/users/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setUsername(data.username || '');
                setProfilePicture(data.profilePicture || null);
            }
        } catch {
            // fallback to JWT decode
            try {
                const token = localStorage.getItem('token');
                if (token) {
                    const decoded = jwtDecode<{ username: string }>(token);
                    setUsername(decoded.username || '');
                }
            } catch {
                setUsername('');
            }
        }
    };

    const handleProfilePictureChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files || !event.target.files[0]) return;
        const file = event.target.files[0];

        const formData = new FormData();
        formData.append('profilePicture', file);

        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/users/profile-picture', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formData
            });
            if (res.ok) {
                const data = await res.json();
                // Add cache-busting query param so the browser reloads the new image
                setProfilePicture(`${data.profilePicture}?t=${Date.now()}`);
                setSuccess('Profile picture updated!');
            } else {
                setError('Failed to update profile picture');
            }
        } catch {
            setError('Network error uploading profile picture');
        }
    };

    const fetchFiles = async () => {
        setLoading(true);
        setError('');
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/files', {
                headers: { 'authorization': `Bearer ${token}` }
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

    const getSortedFiles = () => {
        return [...files].sort((a, b) => {
            let valA: string | number;
            let valB: string | number;

            if (sortKey === 'name') {
                valA = a.originalName.toLowerCase();
                valB = b.originalName.toLowerCase();
            } else if (sortKey === 'createdAt') {
                valA = new Date(a.createdAt || a.uploadDate).getTime();
                valB = new Date(b.createdAt || b.uploadDate).getTime();
            } else {
                valA = new Date(a.uploadDate).getTime();
                valB = new Date(b.uploadDate).getTime();
            }

            if (valA < valB) return sortDir === 'asc' ? -1 : 1;
            if (valA > valB) return sortDir === 'asc' ? 1 : -1;
            return 0;
        });
    };

    const handleSortChange = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            setSelectedFile(event.target.files[0]);
            setError('');
            setSuccess('');
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) { setError('Please select a file first'); return; }

        const allowedTypes = ['text/plain', 'text/html', 'text/markdown', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!allowedTypes.includes(selectedFile.type)) {
            setError('Only text, PDF, or DOCX files are allowed!');
            return;
        }

        setUploading(true);
        setError('');
        setSuccess('');

        const formData = new FormData();
        formData.append('file', selectedFile);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/files/upload', {
                method: 'POST',
                headers: { 'authorization': `Bearer ${token}` },
                body: formData
            });
            const data = await response.json();
            if (response.ok) {
                setSuccess('File uploaded successfully!');
                setSelectedFile(null);
                const fileInput = document.getElementById('file-input') as HTMLInputElement;
                if (fileInput) fileInput.value = '';
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

    const handleDelete = async (fileId: string) => {
        setError(''); setSuccess('');
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/files/${fileId}`, {
                method: 'DELETE',
                headers: { 'authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                setFiles(files.filter(f => f._id !== fileId));
                setSuccess('File deleted successfully');
            } else {
                const data = await response.json();
                setError(data.error || 'Failed to delete file');
            }
        } catch (error) {
            setError('Some network error');
        }
    };

    const handleRename = async (fileId: string, name: string) => {
        setError(''); setSuccess('');
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/files/${fileId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'authorization': `Bearer ${token}` },
                body: JSON.stringify({ newName: name })
            });
            if (response.ok) {
                const data = await response.json();
                setFiles(files.map(f => f._id === fileId ? { ...f, ...data.file } : f));
                setSuccess('File renamed successfully');
                setEditingNameId(null);
                setNewName('');
                setFileExtension('');
            } else {
                const data = await response.json();
                setError(data.error || 'Failed to rename file');
            }
        } catch (err) {
            setError('Network error during rename');
        }
    };

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    };

    const formatDate = (dateString: string) => new Date(dateString).toLocaleString();

    const splitFileName = (fullName: string) => {
        const lastDot = fullName.lastIndexOf('.');
        return { base: fullName.substring(0, lastDot), ext: fullName.substring(lastDot) };
    };

    const sortedFiles = getSortedFiles();

    return (
        <Box sx={{ width: '100%', maxWidth: 1200, margin: '80px auto 20px', p: 3 }}>

            {/* Header with avatar */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 4 }}>
                <Tooltip title="Click to change profile picture">
                    <Box
                        component="label"
                        sx={{ position: 'relative', cursor: 'pointer', display: 'inline-block' }}
                    >
                        <Avatar
                            src={profilePicture ? profilePicture : undefined}
                            imgProps={{ 
                                onError: () => setProfilePicture(null) // fallback to initials if image fails
                            }}
                            sx={{
                                width: 64,
                                height: 64,
                                fontSize: 28,
                                '& img': {
                                    objectFit: 'cover',
                                    width: '100%',
                                    height: '100%',
                                },
                                '&:hover': {
                                    opacity: 0.8,
                                    outline: '2px solid',
                                    outlineColor: 'primary.main',
                                }
                            }}
                        >
                            {!profilePicture && username.charAt(0).toUpperCase()}
                        </Avatar>
                        <input
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={handleProfilePictureChange}
                        />
                    </Box>
                </Tooltip>
                <Typography variant="h4">
                    Hello, {username || 'there'}!
                </Typography>
            </Box>

            {/* Upload Section */}
            <Paper sx={{ p: 3, mb: 4 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>Upload File</Typography>

                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

                <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    <Button variant="outlined" component="label">
                        Choose File
                        <input
                            id="file-input"
                            type="file"
                            accept='.txt,.html,.md,.pdf,.docx'
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
            <Paper sx={{ p: 3, width: '100%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    {/* Sort controls */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" color="text.secondary">Sort by:</Typography>
                        <ToggleButtonGroup size="small" exclusive value={sortKey}>
                            <Tooltip title={`Sort by name (${sortKey === 'name' ? sortDir : 'asc'})`}>
                                <ToggleButton value="name" onClick={() => handleSortChange('name')}>
                                    <SortByAlpha fontSize="small" />
                                    <Typography variant="caption" sx={{ ml: 0.5 }}>Name</Typography>
                                    {sortKey === 'name' && (
                                        <Typography variant="caption" sx={{ ml: 0.3 }}>
                                            {sortDir === 'asc' ? '↑' : '↓'}
                                        </Typography>
                                    )}
                                </ToggleButton>
                            </Tooltip>
                            <Tooltip title={`Sort by creation date (${sortKey === 'createdAt' ? sortDir : 'asc'})`}>
                                <ToggleButton value="createdAt" onClick={() => handleSortChange('createdAt')}>
                                    <Schedule fontSize="small" />
                                    <Typography variant="caption" sx={{ ml: 0.5 }}>Created</Typography>
                                    {sortKey === 'createdAt' && (
                                        <Typography variant="caption" sx={{ ml: 0.3 }}>
                                            {sortDir === 'asc' ? '↑' : '↓'}
                                        </Typography>
                                    )}
                                </ToggleButton>
                            </Tooltip>
                            <Tooltip title={`Sort by last edited (${sortKey === 'uploadDate' ? sortDir : 'asc'})`}>
                                <ToggleButton value="uploadDate" onClick={() => handleSortChange('uploadDate')}>
                                    <Edit fontSize="small" />
                                    <Typography variant="caption" sx={{ ml: 0.5 }}>Modified</Typography>
                                    {sortKey === 'uploadDate' && (
                                        <Typography variant="caption" sx={{ ml: 0.3 }}>
                                            {sortDir === 'asc' ? '↑' : '↓'}
                                        </Typography>
                                    )}
                                </ToggleButton>
                            </Tooltip>
                        </ToggleButtonGroup>
                    </Box>
                </Box>

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
                        {sortedFiles.map((file) => (
                            <ListItem
                                key={file._id}
                                secondaryAction={
                                    <>
                                        {editingNameId === file._id ? (
                                            <>
                                                <IconButton edge="end" onClick={() => handleRename(file._id, newName + fileExtension)}>
                                                    <Check />
                                                </IconButton>
                                                <IconButton edge="end" onClick={() => { setEditingNameId(null); setNewName(''); }}>
                                                    <Close />
                                                </IconButton>
                                            </>
                                        ) : (
                                            <>
                                                {file.role === 'owner' && (
                                                    <>
                                                        <IconButton edge="end" onClick={() => {
                                                            setEditingNameId(file._id);
                                                            const { base, ext } = splitFileName(file.originalName);
                                                            setNewName(base);
                                                            setFileExtension(ext);
                                                        }}>
                                                            <Edit />
                                                        </IconButton>
                                                        <IconButton edge="end" onClick={() => handleDelete(file._id)}>
                                                            <Delete />
                                                        </IconButton>
                                                    </>
                                                )}
                                            </>
                                        )}
                                    </>
                                }
                                sx={{
                                    borderBottom: '1px solid',
                                    borderColor: 'divider',
                                    '&:last-child': { borderBottom: 'none' },
                                    pr: 12
                                }}
                            >
                                {editingNameId === file._id ? (
                                    <TextField
                                        fullWidth
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleRename(file._id, newName + fileExtension);
                                            if (e.key === 'Escape') { setEditingNameId(null); setNewName(''); }
                                        }}
                                        autoFocus
                                    />
                                ) : (
                                    <ListItemText
                                        onClick={() => navigate(`/edit/${file._id}`)}
                                        sx={{ cursor: 'pointer' }}
                                        primary={
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                {file.originalName}
                                                {file.role === 'editor' && <Chip label="Editor" size="small" color="primary" />}
                                                {file.role === 'owner' && <Chip label="Owner" size="small" color="success" />}
                                            </Box>
                                        }
                                        secondary={
                                            <Box component="span" sx={{ display: 'flex', flexDirection: 'column', gap: 0.2 }}>
                                                <span>{formatFileSize(file.size)}</span>
                                                <span>Created: {formatDate(file.createdAt || file.uploadDate)}</span>
                                                <span>Last modified: {formatDate(file.uploadDate)}</span>
                                            </Box>
                                        }
                                    />
                                )}
                            </ListItem>
                        ))}
                    </List>
                )}
            </Paper>
        </Box>
    );
}

export default FileManager;