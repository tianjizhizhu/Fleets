export interface WorkRecord {
  id: string;
  startTime: string;
  endTime: string;
  duration: number;
  rawText: string;
  summary: string;
  categoryId: string | null;
  clusterId: string | null;
  confidence: number;
  annotationStatus: 'pending' | 'confirmed' | 'rejected';
  createdAt: string;
  updatedAt: string;
}

export interface WorkCategory {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  usageCount: number;
  createdAt: string;
}

export interface Cluster {
  id: string;
  categoryId: string;
  name: string;
  recordIds: string[];
  totalDuration: number;
  createdAt: string;
  updatedAt: string;
}

export interface UserConfig {
  hasCompletedOnboarding: boolean;
  categories: WorkCategory[];
  firstUseDate: string;
  totalRecords: number;
  annotationProgress: {
    total: number;
    annotated: number;
  };
}

export interface AIAnalysisResult {
  startTime: string;
  endTime: string;
  duration: number;
  summary: string;
  suggestedCategory: string | null;
  suggestedCategoryId: string | null;
  confidence: number;
}

export interface RecordingState {
  isRecording: boolean;
  duration: number;
  audioLevel: number;
  transcript: string;
  status: 'idle' | 'recording' | 'processing' | 'done' | 'error';
}

export interface ClusterStats {
  totalDuration: number;
  totalRecords: number;
  categoryStats: CategoryStat[];
  dailyStats: DailyStat[];
}

export interface CategoryStat {
  categoryId: string;
  categoryName: string;
  totalDuration: number;
  recordCount: number;
  percentage: number;
}

export interface DailyStat {
  date: string;
  totalDuration: number;
  categoryDurations: Record<string, number>;
}

export type DateFilter = 'all' | 'today' | 'week' | 'month' | 'custom';

export type TimeGranularity = 'day' | 'week' | 'month';

export interface ExportData {
  version: string;
  exportDate: string;
  config: UserConfig;
  records: WorkRecord[];
  clusters: Cluster[];
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
  duration?: number;
}
