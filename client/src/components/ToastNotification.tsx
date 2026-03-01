import { Snackbar, Alert } from '@mui/material';

interface ToastNotificationProps {
    open: boolean;
    message: string;
    severity: 'success' | 'error' | 'info' | 'warning';
    onClose: () => void;
    duration?: number;
}

function ToastNotification({ open, message, severity, onClose, duration = 4000 }: ToastNotificationProps) {
    return (
        <Snackbar
            open={open}
            autoHideDuration={duration}
            onClose={onClose}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
            <Alert
                onClose={onClose}
                severity={severity}
                variant="filled"
                elevation={6}
                sx={{ width: '100%', minWidth: 280 }}
            >
                {message}
            </Alert>
        </Snackbar>
    );
}

export default ToastNotification;
