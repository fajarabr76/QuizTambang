
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { 
  ClientToServerEvents, 
  ServerToClientEvents, 
  GameState, 
  QuizQuestion, 
  ActionState 
} from './src/types';

const db = new Database('game.db');

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS game_configs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_key TEXT UNIQUE,
    config_value INTEGER,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS quiz_questions (
    id TEXT PRIMARY KEY,
    question_text TEXT,
    option_a TEXT,
    option_b TEXT,
    option_c TEXT,
    option_d TEXT,
    correct_option TEXT,
    difficulty_level INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
`);

// Seed initial data if empty
const configCount = db.prepare('SELECT count(*) as count FROM game_configs').get() as { count: number };
if (configCount.count === 0) {
  db.prepare('INSERT INTO game_configs (config_key, config_value) VALUES (?, ?)').run('match_duration', 60);
  db.prepare('INSERT INTO game_configs (config_key, config_value) VALUES (?, ?)').run('question_timeout', 10);
}

// Ensure tug of war configs exist (migration)
const stepConfig = db.prepare('SELECT count(*) as count FROM game_configs WHERE config_key = ?').get('tug_of_war_step') as { count: number };
if (stepConfig.count === 0) {
  db.prepare('INSERT INTO game_configs (config_key, config_value) VALUES (?, ?)').run('tug_of_war_step', 10);
}

const limitConfig = db.prepare('SELECT count(*) as count FROM game_configs WHERE config_key = ?').get('tug_of_war_limit') as { count: number };
if (limitConfig.count === 0) {
  db.prepare('INSERT INTO game_configs (config_key, config_value) VALUES (?, ?)').run('tug_of_war_limit', 50);
}

const questionCount = db.prepare('SELECT count(*) as count FROM quiz_questions').get() as { count: number };
if (questionCount.count === 0) {
  const questions = [
    { id: uuidv4(), text: 'Apa ibukota Indonesia?', a: 'Jakarta', b: 'Bandung', c: 'Surabaya', d: 'Medan', correct: 'A', diff: 1 },
    { id: uuidv4(), text: 'Siapa penemu lampu pijar?', a: 'Nikola Tesla', b: 'Thomas Edison', c: 'Albert Einstein', d: 'Isaac Newton', correct: 'B', diff: 1 },
    { id: uuidv4(), text: 'Berapakah 5 + 7?', a: '10', b: '11', c: '12', d: '13', correct: 'C', diff: 1 },
    { id: uuidv4(), text: 'Planet terdekat dari matahari?', a: 'Venus', b: 'Mars', c: 'Merkurius', d: 'Jupiter', correct: 'C', diff: 1 },
    { id: uuidv4(), text: 'Warna bendera Indonesia?', a: 'Merah Putih', b: 'Putih Merah', c: 'Merah Biru', d: 'Kuning Hijau', correct: 'A', diff: 1 },
  ];
  const stmt = db.prepare('INSERT INTO quiz_questions (id, question_text, option_a, option_b, option_c, option_d, correct_option, difficulty_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
  questions.forEach(q => stmt.run(q.id, q.text, q.a, q.b, q.c, q.d, q.correct, q.diff));
}

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: { origin: "*" }
  });

  const PORT = 3000;

  app.use(express.json());

  // Admin API Endpoints
  app.get('/api/v1/admin/questions', (req, res) => {
    const questions = db.prepare('SELECT * FROM quiz_questions').all();
    res.json(questions);
  });

  app.post('/api/v1/admin/questions', (req, res) => {
    const { question_text, option_a, option_b, option_c, option_d, correct_option, difficulty_level } = req.body;
    const id = uuidv4();
    db.prepare(`
      INSERT INTO quiz_questions (id, question_text, option_a, option_b, option_c, option_d, correct_option, difficulty_level)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, question_text, option_a, option_b, option_c, option_d, correct_option, difficulty_level || 1);
    res.json({ id, status: 'success' });
  });

  app.delete('/api/v1/admin/questions/:id', (req, res) => {
    db.prepare('DELETE FROM quiz_questions WHERE id = ?').run(req.params.id);
    res.json({ status: 'success' });
  });

  app.get('/api/v1/admin/configs', (req, res) => {
    const configs = db.prepare('SELECT * FROM game_configs').all();
    res.json(configs);
  });

  app.patch('/api/v1/admin/configs', (req, res) => {
    const updates = req.body;
    const stmt = db.prepare('UPDATE game_configs SET config_value = ? WHERE config_key = ?');
    for (const [key, value] of Object.entries(updates)) {
      stmt.run(value, key);
    }
    res.json({ status: 'success' });
  });

  // Game state management
  const rooms = new Map<string, GameState>();
  const waitingPlayers = new Map<string, { socketId: string; nickname: string }>(); // roomId -> { socketId, nickname }

  const getConfig = (key: string) => {
    const row = db.prepare('SELECT config_value FROM game_configs WHERE config_key = ?').get(key) as { config_value: number };
    return row?.config_value || 0;
  };

  const getRandomQuestion = (usedIds: string[] = []) => {
    if (usedIds.length > 0) {
      const placeholders = usedIds.map(() => '?').join(',');
      return db.prepare(`SELECT * FROM quiz_questions WHERE id NOT IN (${placeholders}) ORDER BY RANDOM() LIMIT 1`).get(...usedIds) as QuizQuestion | undefined;
    }
    return db.prepare('SELECT * FROM quiz_questions ORDER BY RANDOM() LIMIT 1').get() as QuizQuestion;
  };

  const broadcastRoomInfo = (roomId: string) => {
    const room = rooms.get(roomId);
    if (!room) return;

    const players = [];
    if (room.gmId) players.push({ id: room.gmId, nickname: room.gmNickname!, isGM: true });
    if (room.p1) players.push({ id: room.p1, nickname: room.p1Nickname!, isGM: false });
    if (room.p2) players.push({ id: room.p2, nickname: room.p2Nickname!, isGM: false });

    io.to(roomId).emit('room_info', {
      players,
      roomId,
      canStart: room.p1 !== null && room.p2 !== null && room.state === 'WAITING_ROOM'
    });
  };

  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join_matchmaking', (data) => {
      const targetRoomId = data?.roomId || 'global';
      const nickname = data?.nickname || `Player_${socket.id.slice(0, 4)}`;
      const role = data?.role || 'PLAYER';
      const isGlobal = targetRoomId === 'global';
      
      if (isGlobal) {
        // Global Matchmaking logic (always as PLAYER)
        if (waitingPlayers.get('global')?.socketId === socket.id) return;
        const waiting = waitingPlayers.get('global');

        if (waiting && io.sockets.sockets.has(waiting.socketId)) {
          waitingPlayers.delete('global');
          const p1Id = waiting.socketId;
          const p2Id = socket.id;
          const gameRoomId = uuidv4();
          const matchDuration = getConfig('match_duration');

          const gameState: GameState = {
            roomId: gameRoomId,
            p1: p1Id,
            p2: p2Id,
            p1Nickname: waiting.nickname,
            p2Nickname: nickname,
            gmId: null, // Global games might not have a spectator GM
            gmNickname: null,
            tugOfWarPos: 0,
            p1Answer: null,
            p2Answer: null,
            p1CorrectCount: 0,
            p2CorrectCount: 0,
            usedQuestionIds: [],
            currentQuestion: null,
            globalTimeRemaining: matchDuration,
            state: 'INIT', // Start immediately for global
            roundStartTime: Date.now()
          };

          rooms.set(gameRoomId, gameState);
          const p1Socket = io.sockets.sockets.get(p1Id);
          const p2Socket = io.sockets.sockets.get(p2Id);
          if (p1Socket) p1Socket.join(gameRoomId);
          if (p2Socket) p2Socket.join(gameRoomId);
          
          startGameLoop(gameRoomId);
        } else {
          waitingPlayers.set('global', { socketId: socket.id, nickname });
          socket.emit('waiting_for_opponent');
        }
      } else {
        // Private Room logic
        let room = rooms.get(targetRoomId);
        const initialHp = getConfig('initial_hp');
        const matchDuration = getConfig('match_duration');

        if (!room) {
          // Create new private room (usually as GM)
          room = {
            roomId: targetRoomId,
            p1: role === 'PLAYER' ? socket.id : null,
            p2: null,
            p1Nickname: role === 'PLAYER' ? nickname : null,
            p2Nickname: null,
            gmId: role === 'GM' ? socket.id : null,
            gmNickname: role === 'GM' ? nickname : null,
            tugOfWarPos: 0,
            p1Answer: null,
            p2Answer: null,
            p1CorrectCount: 0,
            p2CorrectCount: 0,
            usedQuestionIds: [],
            currentQuestion: null,
            globalTimeRemaining: matchDuration,
            state: 'WAITING_ROOM',
            roundStartTime: Date.now()
          };
          rooms.set(targetRoomId, room);
          socket.join(targetRoomId);
          broadcastRoomInfo(targetRoomId);
        } else {
          // Join existing private room
          if (role === 'GM') {
            if (!room.gmId) {
              room.gmId = socket.id;
              room.gmNickname = nickname;
            } else if (room.gmId !== socket.id) {
              socket.emit('game_over', { winner: null, reason: 'Room already has a Game Master' });
              return;
            }
          } else {
            if (!room.p1) {
              room.p1 = socket.id;
              room.p1Nickname = nickname;
            } else if (!room.p2 && room.p1 !== socket.id) {
              room.p2 = socket.id;
              room.p2Nickname = nickname;
            } else if (room.p1 === socket.id || room.p2 === socket.id) {
              // Already in
            } else {
              socket.emit('game_over', { winner: null, reason: 'Room is full' });
              return;
            }
          }
          socket.join(targetRoomId);
          broadcastRoomInfo(targetRoomId);
        }
      }
    });

    socket.on('start_game', ({ roomId }) => {
      const room = rooms.get(roomId);
      if (!room || room.gmId !== socket.id || room.state !== 'WAITING_ROOM') return;

      if (room.p1 && room.p2) {
        room.state = 'INIT';
        io.to(roomId).emit('game_start', { roomId });
        startGameLoop(roomId);
      }
    });

    socket.on('client_submit_answer', ({ roomId, answer }) => {
      const room = rooms.get(roomId);
      if (!room || room.state !== 'ANSWER_COLLECTION') return;

      if (socket.id === room.p1) room.p1Answer = answer;
      if (socket.id === room.p2) room.p2Answer = answer;

      // If both answered, we can resolve early if we want, but let's wait for timeout for simplicity
      // or check if both answered
      if (room.p1Answer && room.p2Answer) {
        // We could trigger resolution here, but the loop handles it
      }
    });

    socket.on('disconnect', () => {
      console.log('User disconnected:', socket.id);
      
      // Remove from waiting players
      waitingPlayers.forEach((info, roomId) => {
        if (info.socketId === socket.id) waitingPlayers.delete(roomId);
      });

      // Handle room departures
      rooms.forEach((room, roomId) => {
        if (room.p1 === socket.id || room.p2 === socket.id) {
          if (room.state === 'WAITING_ROOM') {
            // If GM leaves, maybe close room or assign new GM
            if (room.gmId === socket.id) {
              io.to(roomId).emit('game_over', { winner: null, reason: 'Game Master disconnected' });
              rooms.delete(roomId);
            } else {
              // P2 left
              room.p2 = null;
              room.p2Nickname = null;
              broadcastRoomInfo(roomId);
            }
          } else {
            // In-game disconnect
            io.to(roomId).emit('game_over', { winner: null, reason: 'Opponent disconnected' });
            rooms.delete(roomId);
          }
        }
      });
    });
  });

  function startGameLoop(roomId: string) {
    const interval = setInterval(() => {
      const room = rooms.get(roomId);
      if (!room) {
        clearInterval(interval);
        return;
      }

      // Global timer
      room.globalTimeRemaining -= 1;
      const limit = getConfig('tug_of_war_limit');
      if (room.globalTimeRemaining <= 0 || Math.abs(room.tugOfWarPos) >= limit) {
        let winner = null;
        if (room.tugOfWarPos <= -limit) winner = room.p1;
        else if (room.tugOfWarPos >= limit) winner = room.p2;
        else if (room.globalTimeRemaining <= 0) {
          // Time's up: use position first, then correct counts as tie-breaker
          if (room.tugOfWarPos < 0) winner = room.p1;
          else if (room.tugOfWarPos > 0) winner = room.p2;
          else {
            // Perfect center: use correct counts
            if (room.p1CorrectCount > room.p2CorrectCount) winner = room.p1;
            else if (room.p2CorrectCount > room.p1CorrectCount) winner = room.p2;
          }
        }
        
        io.to(roomId).emit('game_over', { winner, reason: 'Game ended' });
        rooms.delete(roomId);
        clearInterval(interval);
        return;
      }

      // State machine
      switch (room.state) {
        case 'INIT':
          room.state = 'QUESTION_BROADCAST';
          break;

        case 'QUESTION_BROADCAST':
          const nextQuestion = getRandomQuestion(room.usedQuestionIds);
          if (!nextQuestion) {
            // No more questions! Determine winner by correct counts
            let winner = null;
            if (room.p1CorrectCount > room.p2CorrectCount) winner = room.p1;
            else if (room.p2CorrectCount > room.p1CorrectCount) winner = room.p2;
            else {
              // If correct counts are equal, use position
              if (room.tugOfWarPos < 0) winner = room.p1;
              else if (room.tugOfWarPos > 0) winner = room.p2;
            }
            
            io.to(roomId).emit('game_over', { winner, reason: 'Pertanyaan habis! Pemenang ditentukan dari jumlah jawaban benar.' });
            rooms.delete(roomId);
            clearInterval(interval);
            return;
          }

          room.currentQuestion = nextQuestion;
          room.usedQuestionIds.push(nextQuestion.id);
          room.p1Answer = null;
          room.p2Answer = null;
          room.state = 'ANSWER_COLLECTION';
          room.roundStartTime = Date.now();
          
          io.to(roomId).emit('server_sync_question', {
            roomId,
            questionId: room.currentQuestion.id,
            text: room.currentQuestion.question_text,
            options: [
              room.currentQuestion.option_a,
              room.currentQuestion.option_b,
              room.currentQuestion.option_c,
              room.currentQuestion.option_d
            ],
            localTimeLimit: getConfig('question_timeout')
          });
          break;

        case 'ANSWER_COLLECTION':
          const elapsed = (Date.now() - room.roundStartTime) / 1000;
          if (elapsed >= getConfig('question_timeout') || (room.p1Answer && room.p2Answer)) {
            room.state = 'RESOLUTION';
            resolveRound(room);
          }
          break;

        case 'RESOLUTION':
          // Wait a bit for animations on client (e.g. 3 seconds)
          const resElapsed = (Date.now() - room.roundStartTime) / 1000;
          if (resElapsed >= 4) { // 4 seconds for animation
            room.state = 'QUESTION_BROADCAST';
          }
          break;
      }
    }, 1000);
  }

  function resolveRound(room: GameState) {
    const correct = room.currentQuestion!.correct_option;
    const p1Correct = room.p1Answer === correct;
    const p2Correct = room.p2Answer === correct;

    if (p1Correct) room.p1CorrectCount++;
    if (p2Correct) room.p2CorrectCount++;

    let actionState: ActionState = 'IDLE';
    const step = getConfig('tug_of_war_step');

    if (p1Correct && p2Correct) {
      actionState = 'PARRY';
      // No movement
    } else if (p1Correct && !p2Correct) {
      actionState = 'P1_ATTACK';
      room.tugOfWarPos -= step;
    } else if (!p1Correct && p2Correct) {
      actionState = 'P2_ATTACK';
      room.tugOfWarPos += step;
    } else {
      actionState = 'ENVIRONMENT_PUNISHMENT';
      // No movement (no punishment as requested)
    }

    room.roundStartTime = Date.now(); // Reset for resolution wait time
    io.to(room.roomId).emit('server_broadcast_resolution', {
      actionState,
      tugOfWarPos: room.tugOfWarPos,
      globalTimeRemaining: room.globalTimeRemaining,
      p1Answer: room.p1Answer,
      p2Answer: room.p2Answer,
      correctAnswer: correct
    });
  }

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
