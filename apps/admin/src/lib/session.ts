export function parseDeviceType(ua?: string) {
  const s = (ua ?? '').toLowerCase();
  if (/tablet|ipad|playbook|silk/.test(s)) return 'tablet';
  if (
    /mobile|android|iphone|ipod|blackberry|bb10|opera mini|iemobile|windows phone/.test(
      s
    )
  )
    return 'mobile';
  return 'desktop';
}

export function parseOS(ua?: string) {
  const u = ua ?? '';
  if (!u) return 'Unknown';
  if (/Windows NT 10\.0/.test(u)) return 'Windows 10';
  if (/Windows NT 6\.3/.test(u)) return 'Windows 8.1';
  if (/Windows NT 6\.2/.test(u)) return 'Windows 8';
  if (/Windows NT 6\.1/.test(u)) return 'Windows 7';
  const mac = u.match(/Mac OS X (\d+[._]\d+([._]\d+)?)/);
  /* v8 ignore next */
  if (mac) return `macOS ${(mac[1] ?? '').replace(/_/g, '.')}`;
  const android = u.match(/Android\s+([\d.]+)/);
  if (android) return `Android ${android[1]}`;
  if (/\biPhone\b|\biPad\b|\biPod\b/.test(u)) {
    const ios = u.match(/OS (\d+[_\d]*)/);
    /* v8 ignore next */
    return ios ? `iOS ${(ios[1] ?? '').replace(/_/g, '.')}` : 'iOS';
  }
  if (/Linux/.test(u)) return 'Linux';
  return 'Unknown';
}

export function parseBrowser(ua?: string) {
  const u = ua ?? '';
  if (!u) return 'Unknown';
  const edge = u.match(/Edg\/([\d.]+)/);
  if (edge) return `Edge ${edge[1]}`;
  const opr = u.match(/OPR\/([\d.]+)|Opera\/([\d.]+)/);
  if (opr) return `Opera ${opr[1] ?? opr[2]}`;
  const chrome = u.match(/Chrome\/([\d.]+)/);
  if (chrome && !/Edg\/|OPR\//.test(u)) return `Chrome ${chrome[1]}`;
  const crios = u.match(/CriOS\/([\d.]+)/);
  if (crios) return `Chrome iOS ${crios[1]}`;
  const firefox = u.match(/Firefox\/([\d.]+)/);
  if (firefox) return `Firefox ${firefox[1]}`;
  const safari = u.match(/Version\/([\d.]+).*Safari\/[\d.]+/);
  if (safari) return `Safari ${safari[1]}`;
  return 'Unknown';
}
