import type { Perspective } from '../types'
export type AnalysisRange = 'current' | 'last15' | 'last30'
export type Confidence = 'high' | 'medium' | 'low' | 'unknown'
export type TeamColor = '濃色' | '淡色'
export type CompetitionLevel = '小学生' | '中学生' | '高校生' | '大学' | '一般'
export interface ExtractedFrame { timestamp: number; image: string; team: TeamColor; perspective: Perspective }
export interface AnalysisItem { text: string; confidence: Confidence }
export interface Evidence { timestamp: number; tag: 'AI GOOD' | 'AI CHECK' | 'AI FIX' | 'AI KEY PLAY'; description: string; confidence: Confidence }
export interface CoachingBreakdown {
  level: CompetitionLevel
  goodPlay: AnalysisItem[]
  weakPlay: AnalysisItem[]
  correction: AnalysisItem[]
  technical: AnalysisItem[]
  mental: AnalysisItem[]
  substitution: AnalysisItem[]
  opponentPlayer: AnalysisItem[]
}
export interface AiAnalysis {
  summary: string; confidence: Confidence
  working: AnalysisItem[]; priorityFix: AnalysisItem[]
  opponentCounter: AnalysisItem[]; continueOffense: AnalysisItem[]
  offense: { working: AnalysisItem[]; problems: AnalysisItem[]; scoringSources: AnalysisItem[]; repeatPatterns: AnalysisItem[] }
  defense: { working: AnalysisItem[]; problems: AnalysisItem[]; keyOpponent: AnalysisItem | null; recommendations: AnalysisItem[] }
  nextThreePossessions: AnalysisItem[]; timeoutMessage: string; evidence: Evidence[]
  coaching?: CoachingBreakdown
}
export interface AnalysisRequest { team: TeamColor; perspective: Perspective; range: { start: number; end: number }; frames: ExtractedFrame[] }
