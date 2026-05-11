export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);

  if (hours === 0) {
    return `${mins}分钟`;
  }
  if (mins === 0) {
    return `${hours}小时`;
  }
  return `${hours}小时${mins}分钟`;
}

export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export function formatDateShort(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('zh-CN', {
    month: '2-digit',
    day: '2-digit'
  });
}

export function formatRecordingTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const pad = (n: number) => n.toString().padStart(2, '0');

  if (hours > 0) {
    return `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

export function parseTimeString(timeStr: string): { hours: number; minutes: number } | null {
  const patterns = [
    /(\d{1,2}):(\d{2})/,
    /(\d{1,2})点(\d{1,2})?/,
    /(\d{1,2})时(\d{1,2})?/
  ];

  for (const pattern of patterns) {
    const match = timeStr.match(pattern);
    if (match) {
      const hours = parseInt(match[1], 10);
      const minutes = match[2] ? parseInt(match[2], 10) : 0;
      return { hours, minutes };
    }
  }

  return null;
}

export function getDateRange(filter: 'today' | 'week' | 'month' | 'all'): { start: Date; end: Date } {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  let start = new Date(now);
  start.setHours(0, 0, 0, 0);

  switch (filter) {
    case 'today':
      break;
    case 'week':
      start.setDate(start.getDate() - start.getDay() + 1);
      break;
    case 'month':
      start.setDate(1);
      break;
    case 'all':
      start = new Date('1970-01-01');
      break;
  }

  return { start, end };
}

export function isSameDay(date1: Date | string, date2: Date | string): boolean {
  const d1 = typeof date1 === 'string' ? new Date(date1) : date1;
  const d2 = typeof date2 === 'string' ? new Date(date2) : date2;

  return d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate();
}

export function groupByDate<T extends { createdAt: string }>(items: T[]): Map<string, T[]> {
  const groups = new Map<string, T[]>();

  items.forEach(item => {
    const date = new Date(item.createdAt).toDateString();
    const existing = groups.get(date) || [];
    existing.push(item);
    groups.set(date, existing);
  });

  const sortedGroups = new Map<string, T[]>();
  Array.from(groups.keys())
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
    .forEach(key => {
      sortedGroups.set(key, groups.get(key)!);
    });

  return sortedGroups;
}

export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export function getDurationMinutes(start: string, end: string): number {
  const startDate = new Date(start);
  const endDate = new Date(end);
  return Math.round((endDate.getTime() - startDate.getTime()) / 60000);
}

export function getCurrentISODate(): string {
  return new Date().toISOString();
}
