import { create } from 'zustand';

export type ToastKind = 'success' | 'error' | 'info';

export type ToastItem = {
  id: string;
  kind: ToastKind;
  title: string;
  message?: string;
  createdAt: number;
  timeoutMs: number;
};

function id() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

type ToastState = {
  toasts: ToastItem[];
  push: (t: Omit<ToastItem, 'id' | 'createdAt'>) => string;
  dismiss: (id: string) => void;
  clear: () => void;
};

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push: (t) => {
    const item: ToastItem = {
      id: id(),
      createdAt: Date.now(),
      ...t,
    };
    set((s) => ({ toasts: [item, ...s.toasts].slice(0, 4) }));
    return item.id;
  },
  dismiss: (toastId) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== toastId) })),
  clear: () => set({ toasts: [] }),
}));

export const toast = {
  success: (title: string, message?: string, timeoutMs = 4500) =>
    useToastStore.getState().push({ kind: 'success', title, message, timeoutMs }),
  error: (title: string, message?: string, timeoutMs = 6500) =>
    useToastStore.getState().push({ kind: 'error', title, message, timeoutMs }),
  info: (title: string, message?: string, timeoutMs = 4500) =>
    useToastStore.getState().push({ kind: 'info', title, message, timeoutMs }),
  dismiss: (id: string) => useToastStore.getState().dismiss(id),
  clear: () => useToastStore.getState().clear(),
};

