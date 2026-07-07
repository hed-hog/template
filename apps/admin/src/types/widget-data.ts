export interface SecurityCheck {
  id: string;
  labelKey: string;
  descriptionKey: string;
  enabled: boolean;
  mfaTypes?: string[];
}

export interface AccountSecurityData {
  score: number;
  checks: SecurityCheck[];
}

export interface ActivityEvent {
  id: number;
  action: string;
  created_at: string;
}

export interface LoginDay {
  day: string;
  logins: number;
  failed: number;
}

export interface ProfileData {
  id: number;
  name: string;
  photo_id: number | null;
  email: string;
  role: string;
  memberSince: string;
  lastLogin: string;
  totalSessions: number;
  totalRoles: number;
}

export interface QuickStatsData {
  onlineTime: string;
  actionsToday: number;
  consecutiveDays: number;
  securityLevel: number;
}

export interface RoleData {
  id: number;
  slug: string;
  name: string;
}

export interface SessionData {
  id: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  expires_at: string;
}

export interface EmailNotificationsCardsData {
  received: number;
  read: number;
  unread: number;
  error: number;
}

export interface EmailNotificationsChartPoint {
  date: string;
  received: number;
  read: number;
}

export interface EmailNotificationsData {
  cards: EmailNotificationsCardsData;
  chart: EmailNotificationsChartPoint[];
}

export interface DashboardCoreConfigStatus {
  isConfigured: boolean;
}

export interface LocaleConfigWidgetData {
  status: DashboardCoreConfigStatus & {
    enabledLocaleCount: number;
    disabledLocaleCount: number;
  };
  settings: {
    dateFormat: string | null;
    timeFormat: string | null;
    timezone: string | null;
  };
  locales: Array<{
    id: number;
    code: string;
    region: string;
    name: string;
    enabled: boolean;
  }>;
}

export interface MailConfigProviderOverview {
  id: string;
  label: string;
  selected: boolean;
  configured: boolean;
  missingKeys: string[];
}

export interface MailConfigWidgetData {
  status: DashboardCoreConfigStatus & {
    selectedProvider: string | null;
    configuredProvider: string | null;
  };
  sender: {
    from: string | null;
  };
  metrics: {
    templateCount: number;
    sentCount: number;
    sentLast30Days: number;
  };
  providers: MailConfigProviderOverview[];
}

export interface OAuthConfigProviderOverview {
  id: string;
  label: string;
  enabled: boolean;
  configured: boolean;
  missingKeys: string[];
  scopesCount: number;
  connectedUsers: number;
}

export interface OAuthConfigWidgetData {
  status: DashboardCoreConfigStatus & {
    enabledProviderCount: number;
    configuredProviderCount: number;
    connectedAccountCount: number;
  };
  providers: OAuthConfigProviderOverview[];
}

export interface StorageConfigProviderOverview {
  providerType: string;
  total: number;
  active: number;
  defaults: number;
}

export interface StorageConfigProfileOverview {
  id: number;
  name: string;
  providerType: string;
  bucketName: string;
  region: string | null;
  endpointUrl: string | null;
  basePath: string | null;
  pathTemplate: string | null;
  forcePathStyle: boolean;
  isDefault: boolean;
  isActive: boolean;
  testStatus: string;
  lastTestedAt: string | null;
  updatedAt: string;
}

export interface StorageConfigWidgetData {
  status: DashboardCoreConfigStatus & {
    totalProfiles: number;
    activeProfiles: number;
    defaultProfileId: number | null;
  };
  providers: StorageConfigProviderOverview[];
  profiles: StorageConfigProfileOverview[];
}

export interface ThemePaletteMode {
  primary: string | null;
  primaryForeground: string | null;
  secondary: string | null;
  secondaryForeground: string | null;
  accent: string | null;
  accentForeground: string | null;
  muted: string | null;
  mutedForeground: string | null;
  background: string | null;
  backgroundForeground: string | null;
  card: string | null;
  cardForeground: string | null;
}

export interface ThemeConfigWidgetData {
  status: DashboardCoreConfigStatus & {
    configuredTokenCount: number;
  };
  branding: {
    systemName: string | null;
    systemSlogan: string | null;
    iconUrl: string | null;
    imageUrl: string | null;
  };
  presentation: {
    mode: string | null;
    font: string | null;
    textSize: string | null;
    radius: string | null;
  };
  palette: {
    light: ThemePaletteMode;
    dark: ThemePaletteMode;
  };
}

export interface DashboardCoreConfigOverviewData {
  localeConfig: LocaleConfigWidgetData;
  mailConfig: MailConfigWidgetData;
  oauthConfig: OAuthConfigWidgetData;
  storageConfig: StorageConfigWidgetData;
  themeConfig: ThemeConfigWidgetData;
}

export interface AllWidgetsData {
  accountSecurity: AccountSecurityData;
  activityTimeline: ActivityEvent[];
  emailNotifications: EmailNotificationsData;
  loginHistory: LoginDay[];
  profile: ProfileData;
  quickStats: QuickStatsData;
  userRoles: RoleData[];
  userSessions: SessionData[];
}
