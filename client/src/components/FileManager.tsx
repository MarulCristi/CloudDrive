import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    Box, Button, Typography, Paper, CircularProgress, 
    IconButton, TextField, Tooltip, Tabs, Tab,
    Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
    Avatar, Chip, Pagination,
    ToggleButton,
    ToggleButtonGroup,
    InputAdornment,
    Breadcrumbs, Link, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
    useMediaQuery, useTheme
} from '@mui/material';
import { 
    Delete, Edit, Share, CloudUpload, 
    RestoreFromTrash, DeleteForever, ContentCopy,
    Schedule, SortByAlpha, DriveFileRenameOutline,
    Search, NoteAdd, Image, CreateNewFolder, Folder,
    DriveFileMove, ArrowBack
} from '@mui/icons-material';
import { jwtDecode } from 'jwt-decode';
import ShareDialog from './ShareModal';
import ToastNotification from './ToastNotification';
import { useTranslation } from 'react-i18next';

interface FileData {
    _id: string;
    filename: string;
    originalName: string;
    size: number;
    createdAt: string;
    uploadDate: string;
    role?: 'owner' | 'editor';
    folder?: string;
}

interface TrashFileData {
    _id: string;
    filename: string;
    originalName: string;
    size: number;
    deletedAt: string;
}

interface FolderData {
    _id: string;
    name: string;
    path: string;
    parentPath: string;
    createdAt: string;
}

interface PaginationData {
    page: number;
    limit: number;
    totalFiles: number;
    totalPages: number;
}

type SortKey = 'name' | 'createdAt' | 'uploadDate';

function FileManager() {
    const { t } = useTranslation();
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
    const [files, setFiles] = useState<FileData[]>([]);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [editingNameId, setEditingNameId] = useState<string | null>(null);
    const [newName, setNewName] = useState('');
    const [fileExtension, setFileExtension] = useState('');
    const [username, setUsername] = useState('');
    const [profilePicture, setProfilePicture] = useState<string | null>(null);
    const [sortKey, setSortKey] = useState<SortKey>('uploadDate');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

    // Toast notifications
    const [toast, setToast] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' | 'warning' }>({ open: false, message: '', severity: 'info' });
    const showToast = (message: string, severity: 'success' | 'error' | 'info' | 'warning') => {
        setToast({ open: true, message, severity });
    };
    const closeToast = () => setToast(prev => ({ ...prev, open: false }));

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const [pagination, setPagination] = useState<PaginationData>({ page: 1, limit: 3, totalFiles: 0, totalPages: 1 });

    // Search
    const [searchQuery, setSearchQuery] = useState('');
    const [searchInput, setSearchInput] = useState('');

    // Tabs, trash, confirm dialogs
    const [activeTab, setActiveTab] = useState(0);
    const [trashFiles, setTrashFiles] = useState<TrashFileData[]>([]);
    const [trashLoading, setTrashLoading] = useState(false);
    const [emptyTrashDialogOpen, setEmptyTrashDialogOpen] = useState(false);
    const [permanentDeleteId, setPermanentDeleteId] = useState<string | null>(null);

    // Share dialog
    const [shareDialogOpen, setShareDialogOpen] = useState(false);
    const [shareFileId, setShareFileId] = useState<string>('');

    // Folder navigation
    const [currentFolder, setCurrentFolder] = useState('/');
    const [folders, setFolders] = useState<FolderData[]>([]);
    const [createFolderDialogOpen, setCreateFolderDialogOpen] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');

    // Create blank document dialog
    const [createDocDialogOpen, setCreateDocDialogOpen] = useState(false);
    const [newDocName, setNewDocName] = useState('');

    // Move file dialog
    const [moveDialogOpen, setMoveDialogOpen] = useState(false);
    const [moveFileId, setMoveFileId] = useState<string>('');
    const [allFolders, setAllFolders] = useState<FolderData[]>([]);

    const navigate = useNavigate();

    useEffect(() => {
        fetchFiles();
        fetchFolders();
        fetchProfile();
    }, [currentPage, sortKey, sortDir, searchQuery, currentFolder]);

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
                showToast('Profile picture updated!', 'success');
            } else {
                showToast('Failed to update profile picture', 'error');
            }
        } catch {
            showToast('Network error uploading profile picture', 'error');
        }
    };

    const fetchFiles = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('token');
            const params = new URLSearchParams({
                page: currentPage.toString(),
                limit: '3',
                sortKey,
                sortDir,
                search: searchQuery,
                folder: currentFolder
            });
            const response = await fetch(`/api/files?${params}`, {
                headers: { 'authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (response.ok) {
                setFiles(data.files || []);
                setPagination(data.pagination || { page: 1, limit: 3, totalFiles: 0, totalPages: 1 });
            } else {
                showToast(data.error || 'Failed to fetch files', 'error');
            }
        } catch (err) {
            showToast('Network error while fetching files', 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchFolders = async () => {
        try {
            const token = localStorage.getItem('token');
            const params = new URLSearchParams({ parentPath: currentFolder });
            const response = await fetch(`/api/folders?${params}`, {
                headers: { 'authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setFolders(data.folders || []);
            }
        } catch {
            // Silently fail for folder listing
        }
    };

    const handleSortChange = (key: SortKey) => {
        if (sortKey === key) {
            setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
        setCurrentPage(1); // Reset to first page when sorting changes
    };

    const handleSearch = () => {
        setSearchQuery(searchInput);
        setCurrentPage(1);
    };

    const handleClearSearch = () => {
        setSearchInput('');
        setSearchQuery('');
        setCurrentPage(1);
    };

    const handlePageChange = (_: React.ChangeEvent<unknown>, page: number) => {
        setCurrentPage(page);
    };

    const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files[0]) {
            setSelectedFile(event.target.files[0]);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) { showToast('Please select a file first', 'error'); return; }

        const allowedTypes = ['text/plain', 'text/html', 'text/markdown', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
        if (!allowedTypes.includes(selectedFile.type)) {
            showToast('Only text, PDF, or DOCX files are allowed!', 'error');
            return;
        }

        setUploading(true);

        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('folder', currentFolder);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/files/upload', {
                method: 'POST',
                headers: { 'authorization': `Bearer ${token}` },
                body: formData
            });
            const data = await response.json();
            if (response.ok) {
                showToast('File uploaded successfully!', 'success');
                setSelectedFile(null);
                const fileInput = document.getElementById('file-input') as HTMLInputElement;
                if (fileInput) fileInput.value = '';
                fetchFiles();
            } else {
                showToast(data.error || 'Upload failed', 'error');
            }
        } catch (err) {
            showToast('Network error during upload', 'error');
        } finally {
            setUploading(false);
        }
    };

    const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        if (!event.target.files || !event.target.files[0]) return;
        const file = event.target.files[0];

        if (!file.type.startsWith('image/')) {
            showToast('Only image files are allowed!', 'error');
            return;
        }

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', currentFolder);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/files/upload-image', {
                method: 'POST',
                headers: { 'authorization': `Bearer ${token}` },
                body: formData
            });
            const data = await response.json();
            if (response.ok) {
                showToast('Image uploaded successfully!', 'success');
                fetchFiles();
            } else {
                showToast(data.error || 'Image upload failed', 'error');
            }
        } catch {
            showToast('Network error during image upload', 'error');
        } finally {
            setUploading(false);
            // Reset input
            const input = event.target;
            if (input) input.value = '';
        }
    };

    const handleCreateBlankDoc = async () => {
        const docName = newDocName.trim() || 'Untitled Document';
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/files/create-blank', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'authorization': `Bearer ${token}` },
                body: JSON.stringify({ name: docName, folder: currentFolder })
            });
            const data = await response.json();
            if (response.ok) {
                showToast('Blank document created!', 'success');
                setCreateDocDialogOpen(false);
                setNewDocName('');
                fetchFiles();
            } else {
                showToast(data.error || 'Failed to create document', 'error');
            }
        } catch {
            showToast('Network error creating document', 'error');
        }
    };

    const handleCreateFolder = async () => {
        const folderName = newFolderName.trim();
        if (!folderName) { showToast('Folder name is required', 'error'); return; }

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/folders', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'authorization': `Bearer ${token}` },
                body: JSON.stringify({ name: folderName, parentPath: currentFolder })
            });
            const data = await response.json();
            if (response.ok) {
                showToast('Folder created!', 'success');
                setCreateFolderDialogOpen(false);
                setNewFolderName('');
                fetchFolders();
            } else {
                showToast(data.error || 'Failed to create folder', 'error');
            }
        } catch {
            showToast('Network error creating folder', 'error');
        }
    };

    const handleDeleteFolder = async (folderId: string) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/folders/${folderId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                showToast('Folder deleted', 'success');
                fetchFolders();
                fetchFiles();
            } else {
                const data = await response.json();
                showToast(data.error || 'Failed to delete folder', 'error');
            }
        } catch {
            showToast('Network error', 'error');
        }
    };

    const handleMoveFile = async (targetFolder: string) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/files/${moveFileId}/move`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ targetFolder })
            });
            if (response.ok) {
                showToast('File moved successfully', 'success');
                setMoveDialogOpen(false);
                setMoveFileId('');
                fetchFiles();
            } else {
                const data = await response.json();
                showToast(data.error || 'Failed to move file', 'error');
            }
        } catch {
            showToast('Network error', 'error');
        }
    };

    const fetchAllFolders = async () => {
        try {
            const token = localStorage.getItem('token');
            const allRes = await fetch(`/api/folders?parentPath=/`, {
                headers: { 'authorization': `Bearer ${token}` }
            });
            if (allRes.ok) {
                const data = await allRes.json();
                const rootFolders = data.folders || [];
                // For simplicity, get subfolders too (one level deep)
                const subPromises = rootFolders.map(async (f: FolderData) => {
                    const subRes = await fetch(`/api/folders?parentPath=${encodeURIComponent(f.path)}`, {
                        headers: { 'authorization': `Bearer ${token}` }
                    });
                    if (subRes.ok) {
                        const subData = await subRes.json();
                        return subData.folders || [];
                    }
                    return [];
                });
                const subFolders = (await Promise.all(subPromises)).flat();
                setAllFolders([...rootFolders, ...subFolders]);
            }
        } catch {
            // Silently fail
        }
    };

    const openMoveDialog = (fileId: string) => {
        setMoveFileId(fileId);
        setMoveDialogOpen(true);
        fetchAllFolders();
    };

    const navigateToFolder = (folderPath: string) => {
        setCurrentFolder(folderPath);
        setCurrentPage(1);
    };

    const getBreadcrumbs = () => {
        if (currentFolder === '/') return [{ label: t('fileManager.root'), path: '/' }];
        const parts = currentFolder.split('/').filter(Boolean);
        const crumbs = [{ label: t('fileManager.root'), path: '/' }];
        let accumulated = '';
        for (const part of parts) {
            accumulated += `/${part}`;
            crumbs.push({ label: part, path: accumulated });
        }
        return crumbs;
    };

    const handleDelete = async (fileId: string) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/files/${fileId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                showToast('File moved to recycle bin', 'success');
                fetchFiles();
                if (activeTab === 1) fetchTrash();
            } else {
                const data = await response.json();
                showToast(data.message || 'Failed to delete', 'error');
            }
        } catch (error) {
            showToast('Network error', 'error');
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
            showToast('Failed to load trash', 'error');
        } finally {
            setTrashLoading(false);
        }
    };

    const handleRestore = async (fileId: string) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/files/${fileId}/restore`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                showToast('File restored', 'success');
                fetchTrash();
                fetchFiles();
            } else {
                const data = await response.json();
                showToast(data.message || 'Failed to restore', 'error');
            }
        } catch {
            showToast('Network error', 'error');
        }
    };

    const handlePermanentDelete = async (fileId: string) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/files/${fileId}/permanent`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                showToast('File permanently deleted', 'success');
                fetchTrash();
            } else {
                const data = await response.json();
                showToast(data.message || 'Failed to delete', 'error');
            }
        } catch {
            showToast('Network error', 'error');
        } finally {
            setPermanentDeleteId(null);
        }
    };

    const handleEmptyTrash = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/api/files/trash/empty', {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                showToast(`Trash emptied (${data.count} files removed)`, 'success');
                setTrashFiles([]);
            } else {
                const data = await response.json();
                showToast(data.message || 'Failed to empty trash', 'error');
            }
        } catch {
            showToast('Network error', 'error');
        } finally {
            setEmptyTrashDialogOpen(false);
        }
    };

    const handleClone = async (fileId: string) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/files/${fileId}/clone`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                showToast('Document cloned successfully', 'success');
                fetchFiles();
            } else {
                const data = await response.json();
                showToast(data.message || 'Failed to clone', 'error');
            }
        } catch {
            showToast('Network error', 'error');
        }
    };

    const handleTabChange = (_: React.SyntheticEvent, newValue: number) => {
        setActiveTab(newValue);
        if (newValue === 1) {
            fetchTrash();
        }
    };

    const handleRename = async (fileId: string, name: string) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/files/${fileId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'authorization': `Bearer ${token}` },
                body: JSON.stringify({ newName: name })
            });
            if (response.ok) {
                showToast('File renamed successfully', 'success');
                setEditingNameId(null);
                setNewName('');
                setFileExtension('');
                fetchFiles();
            } else {
                const data = await response.json();
                showToast(data.error || 'Failed to rename file', 'error');
            }
        } catch (err) {
            showToast('Network error during rename', 'error');
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

    return (
        <Box sx={{ width: '100%', maxWidth: 1200, margin: '80px auto 20px', p: { xs: 1, sm: 3 } }}>

            {/* Header with avatar */}
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, mb: 4, flexWrap: 'wrap' }}>
                <Tooltip title={t('fileManager.changeProfilePicture')}>
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
                <Typography variant={isMobile ? 'h5' : 'h4'}>
                    {t('fileManager.hello', { name: username || 'there' })}
                </Typography>
            </Box>

            {/* Upload & Actions Section */}
            <Paper sx={{ p: { xs: 2, sm: 3 }, mb: 4 }}>
                <Typography variant="h6" sx={{ mb: 2 }}>{t('fileManager.actions')}</Typography>

                <Box sx={{ display: 'flex', gap: { xs: 1, sm: 2 }, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Button variant="outlined" component="label" size={isMobile ? 'small' : 'medium'}>
                        {t('fileManager.chooseFile')}
                        <input
                            id="file-input"
                            type="file"
                            accept='.txt,.html,.md,.pdf,.docx'
                            hidden
                            onChange={handleFileSelect}
                        />
                    </Button>
                    {selectedFile && (
                        <Typography sx={{ flex: 1, minWidth: 100 }}>
                            {selectedFile.name} ({formatFileSize(selectedFile.size)})
                        </Typography>
                    )}
                    <Button
                        variant="contained"
                        startIcon={uploading ? <CircularProgress size={20} color="inherit" /> : <CloudUpload />}
                        onClick={handleUpload}
                        disabled={!selectedFile || uploading}
                        size={isMobile ? 'small' : 'medium'}
                    >
                        {uploading ? t('fileManager.uploading') : t('fileManager.upload')}
                    </Button>

                    <Button
                        variant="outlined"
                        startIcon={<Image />}
                        component="label"
                        disabled={uploading}
                        size={isMobile ? 'small' : 'medium'}
                    >
                        {t('fileManager.uploadImage')}
                        <input
                            type="file"
                            accept="image/*"
                            hidden
                            onChange={handleImageUpload}
                        />
                    </Button>

                    <Button
                        variant="contained"
                        color="success"
                        startIcon={<NoteAdd />}
                        onClick={() => setCreateDocDialogOpen(true)}
                        size={isMobile ? 'small' : 'medium'}
                    >
                        {t('fileManager.newDocument')}
                    </Button>

                    <Button
                        variant="outlined"
                        startIcon={<CreateNewFolder />}
                        onClick={() => setCreateFolderDialogOpen(true)}
                        size={isMobile ? 'small' : 'medium'}
                    >
                        {t('fileManager.newFolder')}
                    </Button>
                </Box>
            </Paper>

            <Tabs value={activeTab} onChange={handleTabChange} sx={{ mb: 2 }} variant={isMobile ? 'fullWidth' : 'standard'}>
                <Tab label={t('fileManager.myFiles')} />
                <Tab label={`${t('fileManager.recycleBin')}${trashFiles.length > 0 ? ` (${trashFiles.length})` : ''}`} />
            </Tabs>

            {/* Tab 0: Files list */}
            {activeTab === 0 && (
                <Paper sx={{ p: { xs: 2, sm: 3 }, width: '100%' }}>
                    {/* Breadcrumb navigation */}
                    <Breadcrumbs sx={{ mb: 2 }}>
                        {getBreadcrumbs().map((crumb, index, arr) => (
                            index === arr.length - 1 ? (
                                <Typography key={crumb.path} color="text.primary" fontWeight={600}>
                                    {crumb.label}
                                </Typography>
                            ) : (
                                <Link
                                    key={crumb.path}
                                    component="button"
                                    underline="hover"
                                    color="inherit"
                                    onClick={() => navigateToFolder(crumb.path)}
                                >
                                    {crumb.label}
                                </Link>
                            )
                        ))}
                    </Breadcrumbs>

                    {/* Go back button when inside a folder */}
                    {currentFolder !== '/' && (
                        <Button
                            size="small"
                            startIcon={<ArrowBack />}
                            onClick={() => {
                                const parts = currentFolder.split('/').filter(Boolean);
                                parts.pop();
                                navigateToFolder(parts.length === 0 ? '/' : `/${parts.join('/')}`);
                            }}
                            sx={{ mb: 2 }}
                        >
                            {t('fileManager.back')}
                        </Button>
                    )}

                    {/* Folders */}
                    {folders.length > 0 && (
                        <Box sx={{ mb: 2 }}>
                            {folders.map(folder => (
                                <Paper
                                    key={folder._id}
                                    elevation={1}
                                    sx={{
                                        p: 1.5,
                                        mb: 1,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        cursor: 'pointer',
                                        transition: 'background-color 0.15s',
                                        '&:hover': { backgroundColor: 'action.hover' },
                                        borderLeft: '4px solid',
                                        borderLeftColor: 'primary.main'
                                    }}
                                    onClick={() => navigateToFolder(folder.path)}
                                >
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <Folder color="primary" />
                                        <Typography variant="subtitle1" fontWeight={500}>{folder.name}</Typography>
                                    </Box>
                                    <Tooltip title={t('fileManager.deleteFolder')}>
                                        <IconButton
                                            size="small"
                                            color="error"
                                            onClick={e => { e.stopPropagation(); handleDeleteFolder(folder._id); }}
                                        >
                                            <Delete fontSize="small" />
                                        </IconButton>
                                    </Tooltip>
                                </Paper>
                            ))}
                        </Box>
                    )}

                    {/* Search bar */}
                    <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                        <TextField
                            size="small"
                            placeholder={t('fileManager.searchPlaceholder')}
                            value={searchInput}
                            onChange={e => setSearchInput(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleSearch(); }}
                            sx={{ flex: 1 }}
                            InputProps={{
                                startAdornment: (
                                    <InputAdornment position="start">
                                        <Search fontSize="small" />
                                    </InputAdornment>
                                ),
                            }}
                        />
                        <Button variant="contained" size="small" onClick={handleSearch}>{t('fileManager.search')}</Button>
                        {searchQuery && (
                            <Button variant="outlined" size="small" onClick={handleClearSearch}>{t('fileManager.clear')}</Button>
                        )}
                    </Box>

                    {searchQuery && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            {t('fileManager.showingResults', { query: searchQuery, count: pagination.totalFiles })}
                        </Typography>
                    )}

                    {/* Sort controls */}
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2" color="text.secondary">{t('fileManager.sortBy')}</Typography>
                            <ToggleButtonGroup size="small" exclusive value={sortKey}>
                                <Tooltip title={`${t('fileManager.name')} (${sortKey === 'name' ? sortDir : 'asc'})`}>
                                    <ToggleButton value="name" onClick={() => handleSortChange('name')}>
                                        <SortByAlpha fontSize="small" />
                                        {!isMobile && <Typography variant="caption" sx={{ ml: 0.5 }}>{t('fileManager.name')}</Typography>}
                                        {sortKey === 'name' && (
                                            <Typography variant="caption" sx={{ ml: 0.3 }}>
                                                {sortDir === 'asc' ? '↑' : '↓'}
                                            </Typography>
                                        )}
                                    </ToggleButton>
                                </Tooltip>
                                <Tooltip title={`${t('fileManager.created')} (${sortKey === 'createdAt' ? sortDir : 'asc'})`}>
                                    <ToggleButton value="createdAt" onClick={() => handleSortChange('createdAt')}>
                                        <Schedule fontSize="small" />
                                        {!isMobile && <Typography variant="caption" sx={{ ml: 0.5 }}>{t('fileManager.created')}</Typography>}
                                        {sortKey === 'createdAt' && (
                                            <Typography variant="caption" sx={{ ml: 0.3 }}>
                                                {sortDir === 'asc' ? '↑' : '↓'}
                                            </Typography>
                                        )}
                                    </ToggleButton>
                                </Tooltip>
                                <Tooltip title={`${t('fileManager.modified')} (${sortKey === 'uploadDate' ? sortDir : 'asc'})`}>
                                    <ToggleButton value="uploadDate" onClick={() => handleSortChange('uploadDate')}>
                                        <Edit fontSize="small" />
                                        {!isMobile && <Typography variant="caption" sx={{ ml: 0.5 }}>{t('fileManager.modified')}</Typography>}
                                        {sortKey === 'uploadDate' && (
                                            <Typography variant="caption" sx={{ ml: 0.3 }}>
                                                {sortDir === 'asc' ? '↑' : '↓'}
                                            </Typography>
                                        )}
                                    </ToggleButton>
                                </Tooltip>
                            </ToggleButtonGroup>
                        </Box>
                        <Typography variant="body2" color="text.secondary">
                            {pagination.totalFiles} {pagination.totalFiles !== 1 ? t('fileManager.files_plural', { count: pagination.totalFiles }).replace(String(pagination.totalFiles) + ' ', '') : t('fileManager.files', { count: pagination.totalFiles }).replace(String(pagination.totalFiles) + ' ', '')}
                        </Typography>
                    </Box>

                    {loading ? <CircularProgress /> : files.length === 0 ? (
                        <Typography color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                            {searchQuery ? t('fileManager.noSearchResults') : t('fileManager.noFiles')}
                        </Typography>
                    ) : (
                        files.map(file => {
                            const isEditing = editingNameId === file._id;
                            return (
                                <Paper
                                    key={file._id}
                                    elevation={2}
                                    sx={{
                                        p: { xs: 1.5, sm: 2 },
                                        mb: 1,
                                        display: 'flex',
                                        alignItems: { xs: 'flex-start', sm: 'center' },
                                        flexDirection: { xs: 'column', sm: 'row' },
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
                                                <Button size="small" onClick={() => handleRename(file._id, newName + fileExtension)}>{t('fileManager.save')}</Button>
                                                <Button size="small" onClick={() => setEditingNameId(null)}>{t('fileManager.cancel')}</Button>
                                            </Box>
                                        ) : (
                                            <>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                                                    <Typography variant="subtitle1" sx={{ fontWeight: 500 }} noWrap>
                                                        {file.originalName}
                                                    </Typography>
                                                    <Chip
                                                        label={file.role === 'editor' ? t('fileManager.sharedEditor') : t('fileManager.owner')}
                                                        size="small"
                                                        color={file.role === 'editor' ? 'info' : 'success'}
                                                        variant="outlined"
                                                        sx={{ fontSize: '0.7rem', height: 22 }}
                                                    />
                                                </Box>
                                                <Typography variant="body2" color="text.secondary">
                                                    {t('fileManager.size')}: {formatFileSize(file.size)}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    {t('fileManager.created')}: {formatDate(file.createdAt)}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary">
                                                    {t('fileManager.modified')}: {formatDate(file.uploadDate)}
                                                </Typography>
                                            </>
                                        )}
                                    </Box>
                                    <Box
                                        sx={{ display: 'flex', gap: 0.5 }}
                                        onClick={e => e.stopPropagation()}
                                    >
                                        <Tooltip title={t('fileManager.rename')}>
                                            <IconButton onClick={() => {
                                                const { base: b, ext: e } = splitFileName(file.originalName);
                                                setEditingNameId(file._id);
                                                setNewName(b);
                                                setFileExtension(e);
                                            }}>
                                                <DriveFileRenameOutline fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title={t('fileManager.clone')}>
                                            <IconButton onClick={() => handleClone(file._id)}>
                                                <ContentCopy fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        {file.role !== 'editor' && (
                                            <>
                                                <Tooltip title={t('fileManager.moveToFolder')}>
                                                    <IconButton onClick={() => openMoveDialog(file._id)}>
                                                        <DriveFileMove fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title={t('fileManager.share')}>
                                                    <IconButton onClick={() => {
                                                        setShareFileId(file._id);
                                                        setShareDialogOpen(true);
                                                    }}>
                                                        <Share fontSize="small" />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title={t('fileManager.moveToTrash')}>
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

                    {/* Pagination */}
                    {pagination.totalPages > 1 && (
                        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
                            <Pagination
                                count={pagination.totalPages}
                                page={currentPage}
                                onChange={handlePageChange}
                                color="primary"
                                showFirstButton
                                showLastButton
                            />
                        </Box>
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
                            {t('fileManager.recycleBinEmpty')}
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
                                    <Tooltip title={t('fileManager.restore')}>
                                        <IconButton onClick={() => handleRestore(file._id)} color="primary">
                                            <RestoreFromTrash />
                                        </IconButton>
                                    </Tooltip>
                                    <Tooltip title={t('fileManager.deletePermanently')}>
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
                <DialogTitle>{t('fileManager.deletePermanentlyTitle')}</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {t('fileManager.deletePermanentlyMsg')}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setPermanentDeleteId(null)}>{t('fileManager.cancel')}</Button>
                    <Button onClick={() => permanentDeleteId && handlePermanentDelete(permanentDeleteId)} color="error" variant="contained">
                        {t('fileManager.deleteForever')}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Confirm empty trash dialog */}
            <Dialog open={emptyTrashDialogOpen} onClose={() => setEmptyTrashDialogOpen(false)}>
                <DialogTitle>{t('fileManager.emptyTrashTitle')}</DialogTitle>
                <DialogContent>
                    <DialogContentText>
                        {t('fileManager.emptyTrashMsg')}
                    </DialogContentText>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setEmptyTrashDialogOpen(false)}>{t('fileManager.cancel')}</Button>
                    <Button onClick={handleEmptyTrash} color="error" variant="contained">
                        {t('fileManager.emptyAll')}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Share dialog */}
            <ShareDialog
                open={shareDialogOpen}
                onClose={() => setShareDialogOpen(false)}
                fileId={shareFileId}
            />

            {/* Create blank document dialog */}
            <Dialog open={createDocDialogOpen} onClose={() => setCreateDocDialogOpen(false)}>
                <DialogTitle>{t('fileManager.createBlankDoc')}</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        fullWidth
                        label={t('fileManager.documentName')}
                        value={newDocName}
                        onChange={e => setNewDocName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleCreateBlankDoc(); }}
                        placeholder={t('editor.untitled')}
                        sx={{ mt: 1 }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCreateDocDialogOpen(false)}>{t('fileManager.cancel')}</Button>
                    <Button onClick={handleCreateBlankDoc} variant="contained" color="success">
                        {t('fileManager.create')}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Create folder dialog */}
            <Dialog open={createFolderDialogOpen} onClose={() => setCreateFolderDialogOpen(false)}>
                <DialogTitle>{t('fileManager.createFolder')}</DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        fullWidth
                        label={t('fileManager.folderName')}
                        value={newFolderName}
                        onChange={e => setNewFolderName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); }}
                        sx={{ mt: 1 }}
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCreateFolderDialogOpen(false)}>{t('fileManager.cancel')}</Button>
                    <Button onClick={handleCreateFolder} variant="contained">
                        {t('fileManager.create')}
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Move file dialog */}
            <Dialog open={moveDialogOpen} onClose={() => setMoveDialogOpen(false)} maxWidth="xs" fullWidth>
                <DialogTitle>{t('fileManager.moveFile')}</DialogTitle>
                <DialogContent>
                    <List>
                        <ListItem disablePadding>
                            <ListItemButton
                                onClick={() => handleMoveFile('/')}
                                selected={currentFolder === '/'}
                            >
                                <ListItemIcon><Folder /></ListItemIcon>
                                <ListItemText primary={t('fileManager.rootFolder')} />
                            </ListItemButton>
                        </ListItem>
                        {allFolders.map(folder => (
                            <ListItem key={folder._id} disablePadding>
                                <ListItemButton onClick={() => handleMoveFile(folder.path)}>
                                    <ListItemIcon><Folder /></ListItemIcon>
                                    <ListItemText
                                        primary={folder.name}
                                        secondary={folder.path}
                                    />
                                </ListItemButton>
                            </ListItem>
                        ))}
                    </List>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setMoveDialogOpen(false)}>{t('fileManager.cancel')}</Button>
                </DialogActions>
            </Dialog>

            {/* Toast notification */}
            <ToastNotification
                open={toast.open}
                message={toast.message}
                severity={toast.severity}
                onClose={closeToast}
            />

        </Box>
    );
}

export default FileManager;