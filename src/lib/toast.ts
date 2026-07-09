/**
 * Centralized Brutalist Toast Helper Utility
 * Dispatches a custom event to the global app shell to trigger instant user feedback
 */

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

export function showBrutalistToast(
  title: string,
  body: string,
  type: ToastType = 'info',
  icon?: string,
  id?: string
) {
  window.dispatchEvent(
    new CustomEvent('faraflick-toast-trigger', {
      detail: { title, body, type, icon, id },
    })
  );
}
