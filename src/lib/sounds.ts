
const SOUNDS = {
  CORRECT: 'https://assets.mixkit.co/active_storage/sfx/600/600-preview.mp3',
  INCORRECT: 'https://assets.mixkit.co/active_storage/sfx/603/603-preview.mp3',
  ATTACK: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
  PARRY: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3',
  AZAB: 'https://assets.mixkit.co/active_storage/sfx/1185/1185-preview.mp3',
  GAME_OVER: 'https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3',
  GAME_START: 'https://assets.mixkit.co/active_storage/sfx/1103/1103-preview.mp3',
  CLICK: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3'
};

class SoundManager {
  private audios: Map<string, HTMLAudioElement> = new Map();
  private enabled: boolean = true;

  constructor() {
    // Preload
    Object.entries(SOUNDS).forEach(([key, url]) => {
      const audio = new Audio(url);
      audio.preload = 'auto';
      this.audios.set(key, audio);
    });
  }

  play(key: keyof typeof SOUNDS) {
    if (!this.enabled) return;
    const audio = this.audios.get(key);
    if (audio) {
      audio.currentTime = 0;
      audio.play().catch(e => console.warn('Audio play failed:', e));
    }
  }

  toggle(state?: boolean) {
    this.enabled = state !== undefined ? state : !this.enabled;
  }
}

export const soundManager = new SoundManager();
