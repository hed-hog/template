import { Setting } from './Setting';

export type SettingList = {
    id: number;
    setting_id?: number;
    order: number;
    value: string;
    created_at?: string;
    updated_at?: string;
    setting?: Setting;
}