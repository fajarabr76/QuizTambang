
export interface GameConfig {
  id: number;
  config_key: string;
  config_value: number;
}

export interface QuizQuestion {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: 'A' | 'B' | 'C' | 'D';
  difficulty_level: number;
}

export type ActionState = 'PARRY' | 'P1_ATTACK' | 'P2_ATTACK' | 'ENVIRONMENT_PUNISHMENT' | 'IDLE';

export interface Player {
  id: string;
  nickname: string;
  isGM: boolean;
}

export interface GameState {
  roomId: string;
  p1: string | null;
  p2: string | null;
  p1Nickname: string | null;
  p2Nickname: string | null;
  gmId: string | null;
  gmNickname: string | null;
  tugOfWarPos: number; // -50 to 50, 0 is center. -50 means P1 wins, 50 means P2 wins.
  p1Answer: string | null;
  p2Answer: string | null;
  p1CorrectCount: number;
  p2CorrectCount: number;
  usedQuestionIds: string[];
  currentQuestion: QuizQuestion | null;
  globalTimeRemaining: number;
  state: 'WAITING_ROOM' | 'INIT' | 'QUESTION_BROADCAST' | 'ANSWER_COLLECTION' | 'RESOLUTION' | 'GAME_OVER';
  roundStartTime: number;
}

export interface ServerToClientEvents {
  server_sync_question: (data: {
    roomId: string;
    questionId: string;
    text: string;
    options: string[];
    localTimeLimit: number;
  }) => void;
  server_broadcast_resolution: (data: {
    actionState: ActionState;
    tugOfWarPos: number;
    globalTimeRemaining: number;
    p1Answer: string | null;
    p2Answer: string | null;
    correctAnswer: string;
  }) => void;
  game_over: (data: { winner: string | null; reason: string }) => void;
  match_found: (data: { roomId: string; p1: string; p2: string; side: 'left' | 'right' }) => void;
  waiting_for_opponent: () => void;
  room_info: (data: { 
    players: Player[]; 
    roomId: string;
    canStart: boolean;
  }) => void;
  game_start: (data: { roomId: string }) => void;
}

export interface ClientToServerEvents {
  client_submit_answer: (data: { roomId: string; answer: string }) => void;
  join_matchmaking: (data: { roomId?: string; nickname: string; role: 'GM' | 'PLAYER' }) => void;
  start_game: (data: { roomId: string }) => void;
}
