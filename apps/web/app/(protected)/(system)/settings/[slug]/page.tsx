'use client';

import { useSystem } from '@/components/provider/system-provider';
import { Setting } from '@/types/Setting';
import { useQuery } from '@tanstack/react-query';
import { SettingGroup, SettingItem, SettingsSection } from '../components/settings-section';
import { use, useCallback, useEffect, useState } from 'react';
import { SettingGroup as SettingGroupType } from '@/types/SettingGroup';
import { SettingComponentEnum } from '@/enums/SettingComponentEnum';
import { Input } from '@/components/ui/input';
import { useSettings } from '../context/settings-context';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ColorSelector } from '../components/color-selector';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';

export default function Page({ params }: { params: { slug: string } }) {

  const { request, token } = useSystem();
  const [settingGroup, setSettingGroup] = useState<SettingGroupType>({} as SettingGroupType);
  const [settings, setSettings] = useState<Setting[]>([]);
  const {
    setHasUnsavedChanges,
  } = useSettings();

  const usedParams = use(params as any) as any;

  const { data: settingsData, refetch: refecthSettingsData } = useQuery<{ data: Setting[] }>({
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

      setHasUnsavedChanges(true);

      request({
        url,
        method: 'PUT',
        data: setting,
      })
        .then(() => {

          setHasUnsavedChanges(false);

          refetchSettings();
          refecthSettingsData();

        })
        .catch((err) => {
          console.error('Error saving setting:', err);
        });

    } catch (error) {
      console.error('Error saving setting:', error);
    }

  }, [settings, refetchSettings]);

  const getValueFromSetting = useCallback((setting: Setting) => {

    if (setting.setting_user && setting.setting_user.length > 0) {

      const userSetting = setting.setting_user.find((item) => item.setting_id === setting.id);

      return userSetting ? userSetting.value : setting.value;

    }

    return setting.value;

  }, []);

  return (
    <>
      <SettingsSection
        title={settingGroup?.name ?? ''}
        description={settingGroup?.description ?? ''}
      >
        <SettingGroup>
          {(settings ?? []).map((item) => (
            item.component && [SettingComponentEnum.checkbox].includes(item.component) ? (
              <>
                {item.component && item.component === SettingComponentEnum.checkbox && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`checkbox-${item.id}`}
                      checked={item.value === 'true'}
                      onCheckedChange={(checked) => handleSave({
                        ...item,
                        value: String(checked),
                      })}
                    />
                    <div className="grid gap-1.5 leading-none">
                      <label
                        htmlFor={`checkbox-${item.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {item.name ?? ''}
                      </label>
                      <p className="text-xs text-muted-foreground">
                        {item.description ?? ''}
                      </p>
                    </div>
                  </div>
                )}

              </>
            ) : (
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
                      value={getValueFromSetting(item)}
                      onChange={(e) => handleChange(item, e.target.value)}
                      onBlur={() => handleSave(item)}
                    />
                  )}

                {item.component && item.component === SettingComponentEnum.comboBox && (
                  <Select
                    value={getValueFromSetting(item)}
                    onValueChange={(value) => handleSave({
                      ...item,
                      value,
                    })}
                  >
                    <SelectTrigger className="w-[150px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {item.setting_list?.map((listItem) => (
                        <SelectItem
                          key={listItem.id}
                          value={listItem.value}
                        >
                          {listItem.value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {item.component && item.component === SettingComponentEnum.radio && (
                  <RadioGroup
                    value={getValueFromSetting(item)}
                    onValueChange={(value) => handleSave({
                      ...item,
                      value,
                    })}
                    className="flex gap-6"
                  >
                    {item.setting_list?.map((listItem) => (
                      <div
                        className="flex items-center space-x-2"
                        key={listItem.id}
                      >
                        <RadioGroupItem
                          value={listItem.value}
                          id={`date-${listItem.id}`}
                        />
                        <Label htmlFor={`date-${listItem.id}`}>{listItem.value}</Label>
                      </div>
                    ))}

                  </RadioGroup>
                )}

                {item.component && item.component === SettingComponentEnum.colorPicker && (
                  <ColorSelector
                    colors={item.setting_list?.map((it) => it.value) ?? []}
                    selectedColor={getValueFromSetting(item) ?? ''}
                    onColorChange={(value) => handleSave({
                      ...item,
                      value,
                    })}
                  />
                )}

                {item.component && item.component === SettingComponentEnum.switch && (
                  <Switch
                    checked={item.value === 'true'}
                    onCheckedChange={(checked) => handleSave({
                      ...item,
                      value: String(checked),
                    })}
                  />
                )}

              </SettingItem>
            )
          ))}
        </SettingGroup>
      </SettingsSection>
    </>
  );
}
