import type { WorkCategory } from '@/types';

const API_URL = 'https://api.siliconflow.cn/v1/chat/completions';
const API_KEY_STORAGE_KEY = 'worktime_api_key';

export function getApiKey(): string | null {
  return localStorage.getItem(API_KEY_STORAGE_KEY);
}

export function setApiKey(key: string): void {
  localStorage.setItem(API_KEY_STORAGE_KEY, key);
}

export function hasApiKey(): boolean {
  return !!getApiKey();
}

export interface AnalysisResult {
  startTime: string;
  endTime: string;
  duration: number;
  summary: string;
  suggestedCategory: string | null;
  suggestedCategoryId: string | null;
  suggestedNewCategory: string | null;
  confidence: number;
}

export async function analyzeWorkText(
  text: string,
  categories: WorkCategory[]
): Promise<AnalysisResult> {
  const apiKey = getApiKey();

  if (!apiKey) {
    return fallbackAnalysis(text, categories);
  }

  const hasCategories = categories.length > 0;
  const categoryList = hasCategories
    ? categories.map(c => `- ${c.name}`).join('\n')
    : '（用户尚未设置任何工作类别，请将这个工作作为新的工作类别）';

  const prompt = `你是一个工作时间分析助手。用户会输入一段描述自己工作的文字，请从中提取信息并判断是否需要创建新的工作类别。

当前用户已有的工作类别：
${categoryList}

请分析以下用户输入：
"${text}"

分析要求：
1. 提取工作的开始时间和结束时间（24小时制，格式HH:MM）
2. 提取工作内容的简短摘要（不超过50字）
3. 如果用户已有工作类别，判断这个工作最匹配哪个已有类别
4. 如果用户没有任何工作类别，或者工作明显不属于任何已有类别，则将此工作识别为新类别，提取工作名称作为"建议新类别"

请以JSON格式返回结果：
{
  "startTime": "09:00",
  "endTime": "11:30",
  "duration": 150,
  "summary": "清洁机器人调试工作",
  "suggestedCategory": "清洁机器人",
  "suggestedCategoryId": "xxx",
  "suggestedNewCategory": "文档整理",
  "confidence": 0.85
}

注意：
${hasCategories ? `
- 如果工作匹配某个已有类别，suggestedNewCategory应为null
- 如果工作明显不属于任何已有类别，suggestedNewCategory应包含新类别名称
- 如果用户输入中包含"新增"、"新工作"等关键词，应提取后面的工作名称作为新类别
` : `
- 由于用户还没有设置任何工作类别，请将这个工作的主要内容提取为"建议新类别"
`}
- 只返回JSON，不要有其他内容。`;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'Qwen/Qwen2.5-7B-Instruct',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.1,
        max_tokens: 600
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('API Error:', response.status, errorData);
      throw new Error(`API请求失败: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || '';

    console.log('AI原始响应:', content);

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('无法从响应中提取JSON:', content);
      return fallbackAnalysis(text, categories);
    }

    let result;
    try {
      result = JSON.parse(jsonMatch[0]);
      console.log('AI解析结果:', result);
    } catch (e) {
      console.error('JSON解析失败:', e);
      return fallbackAnalysis(text, categories);
    }

    const now = new Date();
    const [startHour, startMin] = (result.startTime || '09:00').split(':').map(Number);
    const [endHour, endMin] = (result.endTime || '10:00').split(':').map(Number);

    const startDate = new Date(now);
    startDate.setHours(startHour || 9, startMin || 0, 0, 0);

    const endDate = new Date(now);
    endDate.setHours(endHour || 10, endMin || 0, 0, 0);

    if (endDate <= startDate) {
      endDate.setDate(endDate.getDate() + 1);
    }

    const suggestedCategory = result.suggestedCategory
      ? categories.find(c => c.name === result.suggestedCategory)
      : null;

    return {
      startTime: startDate.toISOString(),
      endTime: endDate.toISOString(),
      duration: result.duration || Math.round((endDate.getTime() - startDate.getTime()) / 60000),
      summary: result.summary || text,
      suggestedCategory: suggestedCategory?.name || null,
      suggestedCategoryId: suggestedCategory?.id || null,
      suggestedNewCategory: result.suggestedNewCategory || null,
      confidence: result.confidence || 0.5
    };

  } catch (error) {
    console.error('AI分析失败，使用备用方案:', error);
    return fallbackAnalysis(text, categories);
  }
}

function fallbackAnalysis(
  text: string,
  categories: WorkCategory[]
): AnalysisResult {
  const now = new Date();
  let duration = 30;

  const hourMatch = text.match(/(\d+)\s*小时/);
  if (hourMatch) {
    duration = parseInt(hourMatch[1], 10) * 60;
  }

  const minuteMatch = text.match(/(\d+)\s*分钟/);
  if (minuteMatch) {
    duration = parseInt(minuteMatch[1], 10);
  }

  if (text.includes('半小时') || text.includes('30分钟')) {
    duration = 30;
  }

  let startHour = 9;
  const timePattern = text.match(/(\d{1,2})\s*[点时:：]/);
  if (timePattern) {
    startHour = parseInt(timePattern[1], 10);
    if (startHour < 6) startHour += 12;
    if (startHour > 22) startHour = 22;
  }

  const startDate = new Date(now);
  startDate.setHours(startHour, 0, 0, 0);

  const endDate = new Date(startDate.getTime() + duration * 60000);

  let summary = text
    .replace(/\d{1,2}[点时:：]\d{0,2}/g, '')
    .replace(/从|到|在|做|了|的|是/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (summary.length > 50) {
    summary = summary.substring(0, 50) + '...';
  }

  if (!summary) {
    summary = '工作记录';
  }

  let suggestedCategory: WorkCategory | null = null;
  const lowerText = text.toLowerCase();

  for (const category of categories) {
    if (lowerText.includes(category.name.toLowerCase())) {
      suggestedCategory = category;
      break;
    }
    for (const keyword of category.keywords || []) {
      if (lowerText.includes(keyword.toLowerCase())) {
        suggestedCategory = category;
        break;
      }
    }
    if (suggestedCategory) break;
  }

  const newCategoryKeywords = ['新增', '新工作', '写', '整理', '开会', '讨论', '培训', '学习', '汇报', '对接', '沟通', '审核'];
  let suggestedNewCategory: string | null = null;

  if (!suggestedCategory) {
    for (const keyword of newCategoryKeywords) {
      if (text.includes(keyword)) {
        if (keyword === '新增' || keyword === '新工作') {
          const afterNew = text.split(keyword)[1]?.trim();
          if (afterNew) {
            suggestedNewCategory = afterNew.substring(0, 15).replace(/[，。,、]/g, '');
          }
        } else {
          const match = text.match(new RegExp(`${keyword}[^，。,\\n]{0,10}`));
          if (match) {
            suggestedNewCategory = match[0].substring(0, 15);
          }
        }
        break;
      }
    }
  }

  return {
    startTime: startDate.toISOString(),
    endTime: endDate.toISOString(),
    duration,
    summary,
    suggestedCategory: suggestedCategory?.name || null,
    suggestedCategoryId: suggestedCategory?.id || null,
    suggestedNewCategory,
    confidence: suggestedCategory ? 0.7 : 0.3
  };
}

export async function clusterWorkRecords(
  records: Array<{ summary: string; categoryId: string; duration: number }>,
  categories: WorkCategory[]
): Promise<Array<{ name: string; categoryId: string; recordIndices: number[]; totalDuration: number }>> {
  const apiKey = getApiKey();

  if (!apiKey) {
    return simpleClustering(records, categories);
  }

  const prompt = `你是一个工作内容聚类助手。请将以下工作记录按内容和性质进行聚类分组。

工作记录（JSON数组，每项包含summary和categoryId）：
${JSON.stringify(records, null, 2)}

工作类别：
${categories.map(c => `- ${c.name} (ID: ${c.id})`).join('\n')}

请分析这些记录的相似性，将内容相近的记录归为一组。每个聚类需要：
1. 生成一个简洁的聚类名称（不超过10个字）
2. 识别该聚类属于哪个工作类别

请以JSON格式返回聚类结果：
[{
  "name": "聚类名称",
  "categoryId": "工作类别ID",
  "recordIndices": [0, 1, 2],
  "totalDuration": 总时长（分钟）
}]

只返回JSON数组，不要有其他内容。`;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'Qwen/Qwen2.5-7B-Instruct',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`API请求失败: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || '';

    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return simpleClustering(records, categories);
    }

    return JSON.parse(jsonMatch[0]);

  } catch (error) {
    console.error('聚类分析失败，使用简单聚类:', error);
    return simpleClustering(records, categories);
  }
}

function simpleClustering(
  records: Array<{ summary: string; categoryId: string; duration: number }>,
  categories: WorkCategory[]
): Array<{ name: string; categoryId: string; recordIndices: number[]; totalDuration: number }> {
  const clusters: Map<string, { indices: number[]; totalDuration: number }> = new Map();

  records.forEach((record, index) => {
    const words = record.summary.split(/[\s,，、./]/).filter(w => w.length >= 2);
    const key = words[0] || '其他';

    if (!clusters.has(record.categoryId)) {
      clusters.set(record.categoryId, { indices: [], totalDuration: 0 });
    }

    const cluster = clusters.get(record.categoryId)!;
    cluster.indices.push(index);
    cluster.totalDuration += record.duration;
  });

  return Array.from(clusters.entries()).map(([categoryId, data]) => {
    const category = categories.find(c => c.id === categoryId);
    return {
      name: category?.name || '未分类',
      categoryId,
      recordIndices: data.indices,
      totalDuration: data.totalDuration
    };
  });
}
