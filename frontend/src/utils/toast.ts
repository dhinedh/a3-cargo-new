// Non-blocking Toast Notification Utility
type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: number;
  message: string;
  type: ToastType;
}

let listeners: ((toasts: ToastMessage[]) => void)[] = [];
let toasts: ToastMessage[] = [];
let nextId = 1;

export const toast = {
  show: (message: string, type: ToastType = 'info') => {
    const id = nextId++;
    const newToast: ToastMessage = { id, message, type };
    toasts = [...toasts, newToast];
    listeners.forEach(l => l(toasts));

    setTimeout(() => {
      toasts = toasts.filter(t => t.id !== id);
      listeners.forEach(l => l(toasts));
    }, 3500);
  },
  success: (message: string) => toast.show(message, 'success'),
  error: (message: string) => toast.show(message, 'error'),
  info: (message: string) => toast.show(message, 'info'),
  subscribe: (listener: (toasts: ToastMessage[]) => void) => {
    listeners.push(listener);
    return () => {
      listeners = listeners.filter(l => l !== listener);
    };
  }
};

// Override native window.alert to completely eliminate blocking browser alert boxes
if (typeof window !== 'undefined') {
  window.alert = (msg: any) => {
    const text = String(msg || '');
    if (
      text.toLowerCase().includes('fail') ||
      text.toLowerCase().includes('error') ||
      text.toLowerCase().includes('please') ||
      text.toLowerCase().includes('required')
    ) {
      toast.error(text);
    } else {
      toast.success(text);
    }
  };
}
