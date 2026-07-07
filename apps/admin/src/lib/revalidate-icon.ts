/**
 * Forces revalidation of the system icon cache.
 * Call this function after updating the 'icon-url' setting.
 *
 * @example
 * ```tsx
 * import { revalidateSystemIcon } from '@/lib/revalidate-icon';
 *
 * // After saving the settings
 * await revalidateSystemIcon();
 * ```
 */
export async function revalidateSystemIcon(): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const response = await fetch('/api/revalidate-icon', {
      method: 'POST',
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Failed to revalidate icon');
    }

    return {
      success: true,
      message: 'Icon cache cleared successfully',
    };
  } catch (error) {
    console.error('Error revalidating icon:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
