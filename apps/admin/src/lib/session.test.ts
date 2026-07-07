import { describe, expect, it } from 'vitest';

import { parseBrowser, parseDeviceType, parseOS } from './session';

describe('session parsers', () => {
  it('detecta tipo de dispositivo por user-agent', () => {
    expect(parseDeviceType('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)')).toBe(
      'tablet',
    );
    expect(parseDeviceType('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe(
      'mobile',
    );
    expect(parseDeviceType('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe(
      'desktop',
    );
    expect(parseDeviceType()).toBe('desktop');
  });

  it('detecta sistemas operacionais conhecidos e usa fallback', () => {
    expect(parseOS('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe(
      'Windows 10',
    );
    expect(parseOS('Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2_1)')).toBe(
      'macOS 14.2.1',
    );
    expect(parseOS('Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toBe(
      'Android 14',
    );
    expect(parseOS('Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X)')).toBe(
      'iOS 17.2',
    );
    expect(parseOS('Mozilla/5.0 (X11; Linux x86_64)')).toBe('Linux');
    expect(parseOS()).toBe('Unknown');
    expect(parseOS('Unknown Agent')).toBe('Unknown');
  });

  it('detecta versões antigas do Windows', () => {
    expect(parseOS('Mozilla/5.0 (Windows NT 6.3; Win64; x64)')).toBe(
      'Windows 8.1',
    );
    expect(parseOS('Mozilla/5.0 (Windows NT 6.2; Win64; x64)')).toBe(
      'Windows 8',
    );
    expect(parseOS('Mozilla/5.0 (Windows NT 6.1; Win64; x64)')).toBe(
      'Windows 7',
    );
  });

  it('usa fallback iOS quando o user-agent não expõe a versão do sistema', () => {
    expect(parseOS('Mozilla/5.0 (iPhone) AppleWebKit/605.1.15')).toBe('iOS');
  });

  it('detecta browsers conhecidos e usa fallback', () => {
    expect(parseBrowser('Mozilla/5.0 Chrome/121.0.0.0 Safari/537.36 Edg/121.0')).toBe(
      'Edge 121.0',
    );
    expect(parseBrowser('Mozilla/5.0 Chrome/121.0.0.0 Safari/537.36')).toBe(
      'Chrome 121.0.0.0',
    );
    expect(parseBrowser('Mozilla/5.0 CriOS/120.1 Mobile/15E148 Safari/604.1')).toBe(
      'Chrome iOS 120.1',
    );
    expect(parseBrowser('Mozilla/5.0 Firefox/122.0')).toBe('Firefox 122.0');
    expect(parseBrowser('Mozilla/5.0 Version/17.2 Safari/605.1.15')).toBe(
      'Safari 17.2',
    );
    expect(parseBrowser('Mozilla/5.0 OPR/99.0')).toBe('Opera 99.0');
    expect(parseBrowser('Mozilla/5.0 Opera/12.0')).toBe('Opera 12.0');
    expect(parseBrowser()).toBe('Unknown');
    expect(parseBrowser('Mozilla/5.0 (compatible; SomeBot/1.0)')).toBe(
      'Unknown',
    );
  });
});
