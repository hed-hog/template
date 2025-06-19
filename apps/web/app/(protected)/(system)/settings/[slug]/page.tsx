'use client';

import { useSystem } from '@/components/provider/system-provider';
import { Setting } from '@/types/Setting';
import { useQuery } from '@tanstack/react-query';
import { SettingGroup, SettingItem, SettingsSection } from '../components/settings-section';
import { use, useCallback, useEffect, useState } from 'react';
import { SettingGroup as SettingGroupType } from '@/types/SettingGroup';
import { SettingComponentEnum } from '@/enums/SettingComponentEnum';
import { Input } from '@/components/ui/input';

export default function Page({ params }: { params: { slug: string } }) {

  const { request, token } = useSystem();
  const [settingGroup, setSettingGroup] = useState<SettingGroupType>({} as SettingGroupType);
  const [settings, setSettings] = useState<Setting[]>([]);

  const usedParams = use(params as any) as any;

  const { data: settingsData } = useQuery<{ data: Setting[] }>({
    queryKey: ['settings', usedParams.slug],
    queryFn: () =>
      request({
        url: `/setting/group/${usedParams.slug}`,
      }),
    enabled: token !== null,
  });

  const { data: settingsGroups, refetch: refetchSettings } = useQuery<{ data: SettingGroupType[] }>({
    queryKey: ['settings-group', usedParams.slug],
    queryFn: () =>
      request({
        url: `/setting/group`,
      }),
    enabled: token !== null,
  });

  useEffect(() => {

    setSettings(settingsData?.data ?? []);

  }, [settingsData]);

  useEffect(() => {

    if (settingsGroups?.data) {
      const group = settingsGroups.data.find(
        (group) => group.slug === usedParams.slug
      );
      if (group && settingGroup.slug !== group.slug) {
        setSettingGroup(group);
      } else {
        console.error(`Setting group with slug "${usedParams.slug}" not found.`);
      }
    }

  }, [settingsGroups, usedParams.slug]);

  const handleChange = useCallback((setting: Setting, value: string) => {

    setSettings(settings.map((item) => {
      if (item.id === setting.id) {
        return { ...item, value };
      }
      return item;
    }));

  }, [settings]);

  const handleSave = useCallback((setting: Setting) => {

    const url = setting.user_override ? `/setting/user/${setting.slug}` : `/setting/${setting.slug}`;

    try {

      request({
        url,
        method: 'PUT',
        data: setting,
      })
        .then(() => {

          refetchSettings();

        })
        .catch((err) => {
          console.error('Error saving setting:', err);
        });

    } catch (error) {
      console.error('Error saving setting:', error);
    }

  }, [settings, refetchSettings]);

  return (
    <>
      <SettingsSection
        title={settingGroup?.name ?? ''}
        description={settingGroup?.description ?? ''}
      >
        <SettingGroup>
          {(settings ?? []).map((item) => (
            <SettingItem
              title={item.name ?? ''}
              description={item.description ?? ''}
              key={item.id}
            >
              {item.component && [
                SettingComponentEnum.inputText,
                SettingComponentEnum.inputNumber,
              ].includes(item.component) && (
                  <Input
                    type={item.component === SettingComponentEnum.inputText ? 'text' : 'number'}
                    value={item.value ?? ''}
                    onChange={(e) => handleChange(item, e.target.value)}
                    onBlur={() => handleSave(item)}
                  />
                )}
            </SettingItem>
          ))}
        </SettingGroup>
      </SettingsSection>
    </>
  );
}
