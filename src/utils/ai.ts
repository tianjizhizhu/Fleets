import type { AIAnalysisResult, WorkCategory, WorkRecord, Cluster } from '@/types';
import { generateId } from './storage';
import { getDurationMinutes } from './time';

export async function analyzeText(
  text: string,
  categories: WorkCategory[]
): Promise<AIAnalysisResult> {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(9, 0, 0, 0);

  const duration = estimateDurationFromText(text);
  const endTime = new Date(startOfDay.getTime() + duration * 60000);

  const summary = extractSummary(text);
  const suggestedCategory = findMatchingCategory(text, categories);
  const confidence = calculateConfidence(text, categories);

  return {
    startTime: startOfDay.toISOString(),
    endTime: endTime.toISOString(),
    duration,
    summary,
    suggestedCategory: suggestedCategory?.name || null,
    suggestedCategoryId: suggestedCategory?.id || null,
    confidence
  };
}

function estimateDurationFromText(text: string): number {
  const timePatterns = [
    /(\d+)\s*小时/,
    /(\d+)\s*h/,
    /(\d+)\s*分钟/,
    /(\d+)\s*min/,
    /大概\s*(\d+)\s*/
  ];

  for (const pattern of timePatterns) {
    const match = text.match(pattern);
    if (match) {
      return parseInt(match[1], 10);
    }
  }

  if (text.includes('半天') || text.includes('上午') || text.includes('下午')) {
    return 240;
  }

  if (text.includes('一整天') || text.includes('全天')) {
    return 480;
  }

  if (text.includes('开会') || text.includes('会议')) {
    return 60;
  }

  return 30;
}

function extractSummary(text: string): string {
  let summary = text
    .replace(/\d{1,2}[点时:：]\d{0,2}/g, '')
    .replace(/从|到|在|做|了|的|是/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (summary.length > 50) {
    summary = summary.substring(0, 50) + '...';
  }

  return summary || '工作记录';
}

function findMatchingCategory(
  text: string,
  categories: WorkCategory[]
): WorkCategory | null {
  if (categories.length === 0) return null;

  const lowerText = text.toLowerCase();

  for (const category of categories) {
    if (category.keywords.length > 0) {
      for (const keyword of category.keywords) {
        if (lowerText.includes(keyword.toLowerCase())) {
          return category;
        }
      }
    }

    if (lowerText.includes(category.name.toLowerCase())) {
      return category;
    }
  }

  return null;
}

function calculateConfidence(
  text: string,
  categories: WorkCategory[]
): number {
  if (categories.length === 0) return 0.5;

  const matched = findMatchingCategory(text, categories);
  if (matched) {
    return 0.7 + Math.random() * 0.25;
  }

  return 0.3 + Math.random() * 0.2;
}

export function runClustering(
  records: WorkRecord[],
  categories: WorkCategory[]
): Cluster[] {
  const confirmedRecords = records.filter(r => r.annotationStatus === 'confirmed');
  const clusters: Cluster[] = [];

  categories.forEach(category => {
    const categoryRecords = confirmedRecords.filter(r => r.categoryId === category.id);

    if (categoryRecords.length === 0) return;

    const workTypes = groupByWorkType(categoryRecords);

    Object.entries(workTypes).forEach(([type, typeRecords]) => {
      const totalDuration = typeRecords.reduce((sum, r) => sum + r.duration, 0);

      clusters.push({
        id: generateId(),
        categoryId: category.id,
        name: type,
        recordIds: typeRecords.map(r => r.id),
        totalDuration,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    });
  });

  return clusters;
}

function groupByWorkType(records: WorkRecord[]): Record<string, WorkRecord[]> {
  const groups: Record<string, WorkRecord[]> = {};

  records.forEach(record => {
    const words = record.summary.split(/[\s,，、]/).filter(w => w.length > 2);

    let groupKey = '其他工作';

    if (words.length > 0) {
      const firstWord = words[0];
      if (['调试', '维护', '检查', '测试'].some(k => record.summary.includes(k))) {
        groupKey = '设备维护';
      } else if (['会议', '讨论', '汇报'].some(k => record.summary.includes(k))) {
        groupKey = '会议讨论';
      } else if (['清洁', '打扫', '擦拭'].some(k => record.summary.includes(k))) {
        groupKey = '清洁工作';
      } else if (['飞行', '无人机'].some(k => record.summary.includes(k))) {
        groupKey = '无人机作业';
      } else {
        groupKey = firstWord.length > 6 ? firstWord.substring(0, 6) : firstWord;
      }
    }

    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(record);
  });

  return groups;
}

export async function suggestCategories(
  records: WorkRecord[],
  existingCategories: WorkCategory[]
): Promise<string[]> {
  const suggestions: Set<string> = new Set();

  records.slice(0, 20).forEach(record => {
    const words = record.summary.split(/[\s,，、]/).filter(w => w.length >= 2);
    words.slice(0, 3).forEach(word => suggestions.add(word));
  });

  const existingNames = new Set(existingCategories.map(c => c.name));
  return Array.from(suggestions).filter(s => !existingNames.has(s)).slice(0, 5);
}
