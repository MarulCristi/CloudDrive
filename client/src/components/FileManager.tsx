import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Box, Button, Typography, Paper, CircularProgress, Alert, 
    IconButton, TextField, Tooltip, Tabs, Tab,
    Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
    Avatar, Chip,
    ToggleButton,
    ToggleButtonGroup
} from '@mui/material';
import { 
    Delete, Edit, Share, CloudUpload, 
    RestoreFromTrash, DeleteForever, ContentCopy,
    Schedule, SortByAlpha, DriveFileRenameOutline
} from '@mui/icons-material';
import { jwtDecode } from 'jwt-decode';
import ShareDialog from './ShareModal';

interface FileData {
    _id: string;
    filename: string;
    originalName: string;
    size: number;
    createdAt: string;
    uploadDate: string;
    role?: 'owner' | 'editor';
}

interface TrashFileData {
    _id: string;
    filename: string;
    originalName: string;
    size: number;
    deletedAt: string;
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

    // Tabs, trash, confirm dialogs
    const [activeTab, setActiveTab] = useState(0);
    const [trashFiles, setTrashFiles] = useState<TrashFileData[]>([]);
    const [trashLoading, setTrashLoading] = useState(false);
    const [emptyTrashDialogOpen, setEmptyTrashDialogOpen] = useState(false);
    const [permanentDeleteId, setPermanentDeleteId] = useState<string | null>(null);

    // Share dialog
    const [shareDialogOpen, setShareDialogOpen] = useState(false);
    const [shareFileId, setShareFileId] = useState<string>('');

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
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                setSuccess('File moved to recycle bin');
                // Immediately remove from local state so it disappears
                setFiles(prev => prev.filter(f => f._id !== fileId));
                if (activeTab === 1) fetchTrash();
            } else {
                const data = await response.json();
                setError(data.message || 'Failed to delete');
            }
        } catch (error) {
            setError('Network error');
        }
    };

    const fetchTrash = async () => {
        setTrashLoading(true);
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/files/trash/list', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setTrashFiles(data);
            }
        } catch {
            setError('Failed to load trash');
        } finally {
            setTrashLoading(false);
        }
    };

    const handleRestore = async (fileId: string) => {
        setError(''); setSuccess('');
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/files/${fileId}/restore`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                setSuccess('File restored');
                fetchTrash();
                fetchFiles();
            } else {
                const data = await response.json();
                setError(data.message || 'Failed to restore');
            }
        } catch {
            setError('Network error');
        }
    };

    const handlePermanentDelete = async (fileId: string) => {
        setError(''); setSuccess('');
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/files/${fileId}/permanent`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                setSuccess('File permanently deleted');
                fetchTrash();
            } else {
                const data = await response.json();
                setError(data.message || 'Failed to delete');
            }
        } catch {
            setError('Network error');
        } finally {
            setPermanentDeleteId(null);
        }
    };

    const handleEmptyTrash = async () => {
        setError(''); setSuccess('');
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/files/trash/empty', {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setSuccess(`Trash emptied (${data.count} files removed)`);
                setTrashFiles([]);
            } else {
                const data = await response.json();
                setError(data.message || 'Failed to empty trash');
            }
        } catch {
            setError('Network error');
        } finally {
            setEmptyTrashDialogOpen(false);
        }
    };

    const handleClone = async (fileId: string) => {
        setError(''); setSuccess('');
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/files/${fileId}/clone`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                setSuccess('Document cloned successfully');
                fetchFiles();
            } else {
                const data = await response.json();
                setError(data.message || 'Failed to clone');
            }
        } catch {
            setError('Network error');
        }
    };

    const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
        setActiveTab(newValue);
        if (newValue === 1) {
            fetchTrash();
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
                                onError: () => setProfilePicture(null)
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

            <Tabs value={activeTab} onChange={handleTabChange} sx={{ mb: 2 }}>
                <Tab label="My Files" />
                <Tab label={`Recycle Bin${trashFiles.length > 0 ? ` (${trashFiles.length})` : ''}`} />
            </Tabs>

            {/* Tab 0: Files list */}
            {activeTab === 0 && (
                <Paper sx={{ p: 3, width: '100%' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
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

                    {loading ? <CircularProgress /> : (
                        sortedFiles.map(file => {
                            const isEditing = editingNameId === file._id;
                            return (
                                <Paper
                                    key={file._id}
                                    elevation={2}
                                    sx={{
                                        p: 2,
                                        mb: 1,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        cursor: isEditing ? 'default' : 'pointer',
                                        transition: 'background-color 0.15s',
                                        '&:hover': isEditing ? {} : {
                                            backgroundColor: 'action.hover',
                                        }
                                    }}
                                    onClick={() => {
                                        if (!isEditing) navigate(`/edit/${file._id}`);
                                    }}
                                >
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        {isEditing ? (
                                            <Box
                                                sx={{ display: 'flex', alignItems: 'center', gap: 1 }}
                                                onClick={e => e.stopPropagation()}
                                            >
                                                <TextField
                                                    size="small"
                                                    value={newName}
                                                    onChange={e => setNewName(e.target.value)}
                                                    onKeyDown={e => {
                                                        if (e.key === 'Enter') handleRename(file._id, newName + fileExtension);
                                                        if (e.key === 'Escape') setEditingNameId(null);
                                                    }}
                                                    autoFocus
                                                />
                                                <Typography variant="body2" color="text.secondary">{fileExtension}</Typography>
                                                <Button size="small" onClick={() => handleRename(file._id, newName + fileExtension)}>Save</Button>
                                                <Button size="small" onClick={() => setEditingNameId(null)}>Cancel</Button>
                                            </Box>
                                        ) : (
                                            <>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                                    <Typography variant="subtitle1" sx={{ fontWeight: 500 }} noWrap>
                                                        {file.originalName}
                                                    </Typography>
                                                    <Chip
                                                        label={file.role === 'editor' ? 'Shared (Editor)' : 'Owner'}
                                                        size="small"
                                                        color={file.role === 'editor' ? 'info' : 'success'}
                                                        variant="outlined"
                                                        sx={{ fontSize: '0.7rem', height: 22 }}
                                                    />
                                                </Box>
                                                <Typography variant="body2" color="text.secondary">
                                                    Size: {formatFileSize(file.size)}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    Created: {formatDate(file.createdAt)}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    Modified: {formatDate(file.uploadDate)}
                                                </Typography>
                                            </>
                                        )}
                                    </Box>
                                    <Box
                                        sx={{ display: 'flex', gap: 0.5 }}
                                        onClick={e => e.stopPropagation()}
                                    >
                                        <Tooltip title="Rename">
                                            <IconButton onClick={() => {
                                                const { base: b, ext: e } = splitFileName(file.originalName);
                                                setEditingNameId(file._id);
                                                setNewName(b);
                                                setFileExtension(e);
                                            }}>
                                                <DriveFileRenameOutline fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Clone">
                                            <IconButton onClick={() => handleClone(file._id)}>
                                                <ContentCopy fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        {file.role !== 'editor' && (
                                            <>
                                                <Tooltip title="Share">
                                                    <IconButton onClick={() => {
                                                        setShareFileId(file._id);
                                                        setShareDialogOpen(true);
                                                    }}>
                                                        <Share fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Move to Trash">
                                                    <IconButton onClick={() => handleDelete(file._id)} color="error">
                                                        <Delete fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                            </>
                                        )}
                                    </Box>
                                </Paper>
                            );
                        })
                    )}
                </Paper>
            )}

            {/* Tab 1: Recycle Bin */}
            {activeTab === 1 && (
                <>
                    {trashFiles.length > 0 && (
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                            <Button
                                variant="contained"
                                color="error"
                                startIcon={<DeleteForever />}
                                onClick={() => setEmptyTrashDialogOpen(true)}
                            >
                                Empty Trash
                            </Button>
                        </Box>
                    )}

                    {trashLoading ? <CircularProgress /> : trashFiles.length === 0 ? (
                        <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                            Recycle bin is empty
                        </Typography>
                    ) : (
                        trashFiles.map(file => (
                            <Paper key={file._id} sx={{ p: 2, mb: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', opacity: 0.85 }}>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                    <Typography variant="subtitle1" noWrap>{file.originalName}</Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Size: {formatFileSize(file.size)}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Deleted: {formatDate(file.deletedAt)}
                                    </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', gap: 0.5 }}>
                                    <Tooltip title="Restore">
                                        <IconButton onClick={() => handleRestore(file._id)} color="primary">
                                            <RestoreFromTrash />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Delete Permanently">
                                        <IconButton onClick={() => setPermanentDeleteId(file._id)} color="error">
                                            <DeleteForever />
                                        </IconButton>
                                    </Tooltip>
                                </Box>
                            </Paper>
                        ))
                    )}
                </>
            )}

            {/* Confirm permanent delete dialog */}
            <Dialog open={!!permanentDeleteId} onClose={() => setPermanentDeleteId(null)}>
                <DialogTitle>Delete Permanently?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        This file will be permanently deleted and cannot be recovered.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setPermanentDeleteId(null)}>Cancel</Button>
                    <Button onClick={() => permanentDeleteId && handlePermanentDelete(permanentDeleteId)} color="error" variant="contained">
                        Delete Forever
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Confirm empty trash dialog */}
            <Dialog open={emptyTrashDialogOpen} onClose={() => setEmptyTrashDialogOpen(false)}>
                <DialogTitle>Empty Recycle Bin?</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        All {trashFiles.length} file(s) will be permanently deleted. This cannot be undone.
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEmptyTrashDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleEmptyTrash} color="error" variant="contained">
                        Empty Trash
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Share dialog */}
            <ShareDialog
                open={shareDialogOpen}
                onClose={() => setShareDialogOpen(false)}
                fileId={shareFileId}
            />

        </Box>
    );
}

export default FileManager;