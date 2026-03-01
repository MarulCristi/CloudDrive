import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Box,
    Typography,
    List,
    ListItem,
    ListItemText,
    IconButton,
    Alert,
    Divider,
    InputAdornment,
    CircularProgress
} from '@mui/material';
import { Delete, ContentCopy, Check } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

interface ShareDialogProps {
    open: boolean;
    onClose: () => void;
    fileId: string;
}

interface Permission {
    _id: string;
    userId?: {
        _id: string;
        username: string;
        email: string;
    };
    permission: 'edit' | 'view';
    sharedLink?: string;
}

function ShareDialog({ open, onClose, fileId }: ShareDialogProps) {
    const [email, setEmail] = useState('');
    const [permissions, setPermissions] = useState<Permission[]>([]);
    const [shareLink, setShareLink] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [copied, setCopied] = useState(false);
    const { t } = useTranslation();

    useEffect(() => {
        if (open) {
            fetchPermissions();
        }
    }, [open, fileId]);

    const fetchPermissions = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/files/${fileId}/permissions`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                const data = await response.json();
                setPermissions(data.permissions);
                
                // Find existing share link
                const linkPerm = data.permissions.find((p: Permission) => p.sharedLink);
                if (linkPerm?.sharedLink) {
                    setShareLink(`${window.location.origin}/share/${linkPerm.sharedLink}`);
                }
            }
        } catch (err) {
            console.error('Failed to fetch permissions', err);
        }
    };

    const handleGrantEditAccess = async () => {
        if (!email.trim()) {
            setError('Please enter an email or username');
            return;
        }

        setLoading(true);
        setError('');
        setSuccess('');

        try {
            const token = localStorage.getItem('token');
            
            // First, find user by email/username
            const userResponse = await fetch(`/api/users/search?query=${email}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!userResponse.ok) {
                setError('User not found');
                setLoading(false);
                return;
            }

            const userData = await userResponse.json();
            const userId = userData.user._id;

            // Grant edit permission
            const response = await fetch(`/api/files/${fileId}/share/edit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ userId })
            });

            if (response.ok) {
                setSuccess(t('shareDialog.editAccessGranted'));
                setEmail('');
                fetchPermissions();
            } else {
                const data = await response.json();
                setError(data.error || t('shareDialog.failedGrantAccess'));
            }
        } catch (err) {
            setError(t('shareDialog.networkError'));
        } finally {
            setLoading(false);
        }
    };

    const handleGenerateShareLink = async () => {
        setLoading(true);
        setError('');

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/files/${fileId}/share/view-link`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setShareLink(data.shareUrl);
                setSuccess(t('shareDialog.shareLinkGenerated'));
                fetchPermissions();
            } else {
                const data = await response.json();
                setError(data.error || t('shareDialog.failedGenerateLink'));
            }
        } catch (err) {
            setError(t('shareDialog.networkError'));
        } finally {
            setLoading(false);
        }
    };

    const handleCopyLink = () => {
        navigator.clipboard.writeText(shareLink);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleRemovePermission = async (permissionId: string) => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`/api/files/${fileId}/permissions/${permissionId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (response.ok) {
                setSuccess(t('shareDialog.permissionRemoved'));
                fetchPermissions();
            }
        } catch (err) {
            setError(t('shareDialog.failedRemovePermission'));
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>{t('shareDialog.title')}</DialogTitle>
            <DialogContent>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

                {/* Grant Edit Access */}
                <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>
                        {t('shareDialog.grantEditAccess')}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                        <TextField
                            fullWidth
                            size="small"
                            placeholder={t('shareDialog.emailPlaceholder')}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleGrantEditAccess()}
                        />
                        <Button
                            variant="contained"
                            onClick={handleGrantEditAccess}
                            disabled={loading}
                        >
                            {t('shareDialog.share')}
                        </Button>
                    </Box>
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* Share Link */}
                <Box sx={{ mb: 3 }}>
                    <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>
                        {t('shareDialog.viewOnlyLink')}
                    </Typography>
                    {shareLink ? (
                        <TextField
                            fullWidth
                            size="small"
                            value={shareLink}
                            InputProps={{
                                readOnly: true,
                                endAdornment: (
                                    <InputAdornment position="end">
                                        <IconButton onClick={handleCopyLink}>
                                            {copied ? <Check color="success" /> : <ContentCopy />}
                                        </IconButton>
                                    </InputAdornment>
                                )
                            }}
                        />
                    ) : (
                        <Button
                            variant="outlined"
                            onClick={handleGenerateShareLink}
                            disabled={loading}
                        >
                            {loading ? <CircularProgress size={20} /> : t('shareDialog.generateLink')}
                        </Button>
                    )}
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* Current Permissions */}
                <Box>
                    <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 'bold' }}>
                        {t('shareDialog.peopleWithAccess')}
                    </Typography>
                    {permissions.length === 0 ? (
                        <Typography color="text.secondary">{t('shareDialog.noAccess')}</Typography>
                    ) : (
                        <List dense>
                            {permissions.map((perm) => (
                                perm.userId && (
                                    <ListItem
                                        key={perm._id}
                                        secondaryAction={
                                            <IconButton
                                                edge="end"
                                                onClick={() => handleRemovePermission(perm._id)}
                                            >
                                                <Delete />
                                            </IconButton>
                                        }
                                    >
                                        <ListItemText
                                            primary={perm.userId.username}
                                            secondary={`${perm.userId.email} • ${perm.permission}`}
                                        />
                                    </ListItem>
                                )
                            ))}
                        </List>
                    )}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>{t('shareDialog.close')}</Button>
            </DialogActions>
        </Dialog>
    );
}

export default ShareDialog;