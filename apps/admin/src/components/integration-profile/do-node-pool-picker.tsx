'use client';

import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useApp } from '@hed-hog/next-app-provider';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

/** Placeholder returned by the backend instead of a stored secret (masked token). */
const SECRET_MASK = '********';

type DoNodePool = {
  id: string;
  name: string;
  size: string;
  count: number;
  nodeCount: number;
};

type DoNodePoolPickerProps = {
  apiToken: string;
  clusterId: string;
  value: string;
  profileId?: number;
  onChange: (name: string) => void;
};

/**
 * Picks the DigitalOcean video node pool by NAME (stable across pool recreations,
 * which change the UUID), loading the pools directly from the DO API with the
 * already-provided token + cluster_id — without the user pasting a UUID. When
 * editing, the token arrives masked: the listing uses profileId instead (token
 * decrypted on the backend). Reused by the profiles page and the integration
 * sheet (autoscaling setting).
 */
export function DoNodePoolPicker({
  apiToken,
  clusterId,
  value,
  profileId,
  onChange,
}: DoNodePoolPickerProps) {
  const t = useTranslations('core.IntegrationProfilePage');
  const { request } = useApp();
  const [pools, setPools] = useState<DoNodePool[]>([]);
  const [loading, setLoading] = useState(false);

  // Masked token (editing) is not a real credential: ignore it and use profileId on the backend.
  const effectiveToken = apiToken === SECRET_MASK ? '' : apiToken;
  const canLoad = Boolean((effectiveToken && clusterId) || profileId);

  const loadPools = async () => {
    setLoading(true);
    try {
      const { data } = await request<DoNodePool[]>({
        url: '/queue/scaling/node-pools',
        method: 'POST',
        data: {
          ...(profileId ? { profileId } : {}),
          ...(effectiveToken ? { api_token: effectiveToken } : {}),
          ...(clusterId ? { cluster_id: clusterId } : {}),
        },
      });
      const list = Array.isArray(data) ? data : [];
      setPools(list);
      if (list.length === 0) toast.warning(t('nodePoolNoneFound'));
    } catch {
      toast.error(t('nodePoolLoadError'));
    } finally {
      setLoading(false);
    }
  };

  // Ensures the stored value appears in the select even before the list loads.
  const options =
    value && !pools.some((p) => p.name === value)
      ? [{ id: value, name: value, size: '', count: 0, nodeCount: 0 }, ...pools]
      : pools;

  return (
    <div className="rounded-lg border">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div>
          <p className="text-sm font-semibold">{t('nodePoolSectionTitle')}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t('nodePoolSectionDescription')}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={loadPools}
          disabled={!canLoad || loading}
        >
          {loading ? t('nodePoolLoading') : t('nodePoolLoad')}
        </Button>
      </div>
      <div className="space-y-2 p-4">
        <Label htmlFor="ip-cfg-video_node_pool_name">
          {t('fieldVideoNodePool')} <span className="text-destructive">*</span>
        </Label>
        <Select value={value || ''} onValueChange={onChange}>
          <SelectTrigger id="ip-cfg-video_node_pool_name" className="w-full">
            <SelectValue placeholder={t('nodePoolPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {options.map((p) => (
              <SelectItem key={p.id} value={p.name}>
                {p.name}
                {p.size ? ` · ${p.size}` : ''}
                {p.nodeCount ? ` · ${p.nodeCount}` : ''}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!canLoad && (
          <p className="text-xs text-muted-foreground">
            {t('nodePoolNeedCreds')}
          </p>
        )}
      </div>
    </div>
  );
}
