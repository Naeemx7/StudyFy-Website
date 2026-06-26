import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export type BadgeAction =
  | 'QUIZ_COMPLETED'
  | 'QUIZ_PERFECT_SCORE'
  | 'FILE_UPLOADED'
  | 'SUMMARY_GENERATED'
  | 'FLASHCARDS_GENERATED'
  | 'CHAT_MESSAGE_SENT'
  | 'WORKSPACE_CREATED'
  | 'MASTERY_ACHIEVED';

export type BadgeTier = 'LOCKED' | 'BRONZE' | 'SILVER' | 'GOLD';

export const TIER_COLORS: Record<BadgeTier, string> = {
  LOCKED: '#9CA3AF',
  BRONZE: '#CD7F32',
  SILVER: '#8A93A1',
  GOLD:   '#DAA520',
};

export interface BadgeStatus {
  id: string;
  name: string;
  emoji: string;
  description: string;
  action: BadgeAction;
  tier: BadgeTier;
  count: number;
  progressPercent: number;
  /** threshold for the NEXT tier, or null when already GOLD */
  nextThreshold: number | null;
  tierColor: string;
  thresholds: { bronze: number; silver: number; gold: number };
}

interface BadgeDef {
  id: string;
  name: string;
  emoji: string;
  description: string;
  action: BadgeAction;
  thresholds: { bronze: number; silver: number; gold: number };
}

const BADGE_DEFS: BadgeDef[] = [
  {
    id: 'quiz_whiz', name: 'Quiz Whiz', emoji: '🧠',
    description: 'Complete quizzes to test your knowledge',
    action: 'QUIZ_COMPLETED',
    thresholds: { bronze: 5, silver: 25, gold: 100 },
  },
  {
    id: 'perfect_score', name: 'Perfectionist', emoji: '💯',
    description: 'Score 100% on a quiz',
    action: 'QUIZ_PERFECT_SCORE',
    thresholds: { bronze: 1, silver: 5, gold: 20 },
  },
  {
    id: 'bookworm', name: 'Bookworm', emoji: '📚',
    description: 'Upload study files to your spaces',
    action: 'FILE_UPLOADED',
    thresholds: { bronze: 5, silver: 20, gold: 50 },
  },
  {
    id: 'summary_pro', name: 'Summary Pro', emoji: '📝',
    description: 'Generate AI summaries',
    action: 'SUMMARY_GENERATED',
    thresholds: { bronze: 3, silver: 15, gold: 50 },
  },
  {
    id: 'flash_master', name: 'Flash Master', emoji: '⚡️',
    description: 'Generate flashcard decks',
    action: 'FLASHCARDS_GENERATED',
    thresholds: { bronze: 3, silver: 15, gold: 50 },
  },
  {
    id: 'curious_mind', name: 'Curious Mind', emoji: '💬',
    description: 'Ask questions in AI chat',
    action: 'CHAT_MESSAGE_SENT',
    thresholds: { bronze: 10, silver: 50, gold: 200 },
  },
  {
    id: 'architect', name: 'Architect', emoji: '🏗',
    description: 'Create knowledge spaces',
    action: 'WORKSPACE_CREATED',
    thresholds: { bronze: 2, silver: 5, gold: 15 },
  },
  {
    id: 'scholar', name: 'Scholar', emoji: '🎓',
    description: 'Achieve 80%+ mastery in a space',
    action: 'MASTERY_ACHIEVED',
    thresholds: { bronze: 1, silver: 3, gold: 10 },
  },
];

const STORAGE_KEY = 'asc_badge_counts';

@Injectable({ providedIn: 'root' })
export class BadgeService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  /**
   * Call this every time a tracked action occurs.
   * count is the number of actions performed in one batch (e.g. 3 files uploaded).
   * Automatically calls assign-badges when counts cross BRONZE/SILVER/GOLD thresholds.
   */
  trackAction(action: BadgeAction, count = 1): void {
    const userId = this.auth.getCurrentUserId();
    if (!userId) return;

    const badge = BADGE_DEFS.find(b => b.action === action);
    if (!badge) return;

    const counts = this.loadCounts();
    const prev = counts[action] ?? 0;
    const next = prev + count;
    counts[action] = next;
    this.saveCounts(counts);

    const toAssign = this.newTiersBetween(badge, prev, next);
    if (toAssign.length > 0) {
      this.callAssignBadges(userId, toAssign);
    }
  }

  /** Returns the current status of all badges based on localStorage counts. */
  getAllBadgeStatuses(): BadgeStatus[] {
    const counts = this.loadCounts();
    return BADGE_DEFS.map(def => this.computeStatus(def, counts[def.action] ?? 0));
  }

  /** Returns the raw action count for one action (useful for debug / display). */
  getActionCount(action: BadgeAction): number {
    return this.loadCounts()[action] ?? 0;
  }

  private computeStatus(def: BadgeDef, count: number): BadgeStatus {
    const { bronze, silver, gold } = def.thresholds;

    let tier: BadgeTier;
    let progressPercent: number;
    let nextThreshold: number | null;

    if (count >= gold) {
      tier = 'GOLD';
      progressPercent = 100;
      nextThreshold = null;
    } else if (count >= silver) {
      tier = 'SILVER';
      progressPercent = Math.round(((count - silver) / (gold - silver)) * 100);
      nextThreshold = gold;
    } else if (count >= bronze) {
      tier = 'BRONZE';
      progressPercent = Math.round(((count - bronze) / (silver - bronze)) * 100);
      nextThreshold = silver;
    } else {
      tier = 'LOCKED';
      progressPercent = Math.round((count / bronze) * 100);
      nextThreshold = bronze;
    }

    return {
      id: def.id,
      name: def.name,
      emoji: def.emoji,
      description: def.description,
      action: def.action,
      tier,
      count,
      progressPercent,
      nextThreshold,
      tierColor: TIER_COLORS[tier],
      thresholds: def.thresholds,
    };
  }

  private newTiersBetween(def: BadgeDef, prev: number, next: number): string[] {
    const names: string[] = [];
    const tiers: Array<{ label: string; threshold: number }> = [
      { label: 'bronze', threshold: def.thresholds.bronze },
      { label: 'silver', threshold: def.thresholds.silver },
      { label: 'gold',   threshold: def.thresholds.gold   },
    ];
    for (const { label, threshold } of tiers) {
      if (prev < threshold && next >= threshold) {
        names.push(`${def.id}_${label}`);
      }
    }
    return names;
  }

  private callAssignBadges(userId: string, badgeNames: string[]): void {
    this.http
      .post<{ isSuccess: boolean }>(
        `${environment.apiUrl}/users/${userId}/assign-badges`,
        { badgeNames }
      )
      .subscribe({
        next: () => console.log('[Badges] assigned:', badgeNames),
        error: err => console.warn('[Badges] assignment failed:', err.message),
      });
  }

  private loadCounts(): Record<string, number> {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, number>;
    } catch {
      return {};
    }
  }

  private saveCounts(counts: Record<string, number>): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(counts));
  }
}
