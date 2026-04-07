
import React, { useEffect, useRef } from 'react';
import { Application, Sprite, Assets, Graphics, Container } from 'pixi.js';
import { ActionState } from '../types';

interface GameCanvasProps {
  actionState: ActionState;
  tugOfWarPos: number;
  side: 'left' | 'right';
}

const createCharacter = (color: number, isRight: boolean) => {
  const container = new Container();
  
  const legBack = new Graphics().roundRect(-8, 0, 16, 50, 8).fill({ color: 0x555555 });
  legBack.pivot.set(0, 5);
  legBack.position.set(isRight ? 10 : -10, 10);

  const legFront = new Graphics().roundRect(-8, 0, 16, 50, 8).fill({ color });
  legFront.pivot.set(0, 5);
  legFront.position.set(isRight ? -10 : 10, 10);

  const body = new Graphics().roundRect(-15, -50, 30, 60, 10).fill({ color });
  body.pivot.set(0, 10);
  body.position.set(0, 0);

  const head = new Graphics().circle(0, -70, 22).fill({ color });

  const armBack = new Graphics().roundRect(-6, 0, 12, 45, 6).fill({ color: 0x555555 });
  armBack.pivot.set(0, 5);
  armBack.position.set(isRight ? 15 : -15, -40);

  const armFront = new Graphics().roundRect(-6, 0, 12, 45, 6).fill({ color });
  armFront.pivot.set(0, 5);
  armFront.position.set(isRight ? -15 : 15, -40);

  container.addChild(legBack, armBack, body, head, legFront, armFront);

  return { container, head, body, armFront, armBack, legFront, legBack };
};

const GameCanvas: React.FC<GameCanvasProps> = ({ actionState, tugOfWarPos, side }) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const p1Ref = useRef<any>(null);
  const p2Ref = useRef<any>(null);
  const ropeRef = useRef<Graphics | null>(null);
  const fxRef = useRef<Graphics | null>(null);

  useEffect(() => {
    let active = true;
    const app = new Application();

    const init = async () => {
      try {
        await app.init({ 
          width: 800, 
          height: 400, 
          backgroundColor: 0x000000,
          resolution: window.devicePixelRatio || 1,
          autoDensity: true,
        });
        
        if (!active) {
          app.destroy({ removeView: true });
          return;
        }

        if (canvasRef.current) {
          canvasRef.current.appendChild(app.canvas);
          app.canvas.style.width = '100%';
          app.canvas.style.height = '100%';
          app.canvas.style.display = 'block';
        }
        appRef.current = app;

        // Load Background
        let bgTexture;
        try {
          bgTexture = await Assets.load('https://picsum.photos/seed/battleground/800/400?blur=2');
        } catch (e) {
          if (app.renderer) {
            const g = new Graphics().rect(0, 0, 100, 100).fill(0x333333);
            bgTexture = app.renderer.generateTexture(g);
          }
        }

        if (!active) return;

        if (bgTexture) {
          const background = new Sprite(bgTexture);
          background.width = 800;
          background.height = 400;
          background.alpha = 0.5;
          app.stage.addChild(background);
        }

        // Floor
        const floor = new Graphics()
          .rect(0, 320, 800, 80)
          .fill({ color: 0x222222, alpha: 0.8 });
        app.stage.addChild(floor);

        // P1 Character
        const p1 = createCharacter(0x3b82f6, false); // Blue
        p1.container.x = 150;
        p1.container.y = 300;
        app.stage.addChild(p1.container);
        p1Ref.current = p1;

        // P2 Character
        const p2 = createCharacter(0xef4444, true); // Red
        p2.container.x = 650;
        p2.container.y = 300;
        app.stage.addChild(p2.container);
        p2Ref.current = p2;

        // Rope
        const rope = new Graphics();
        app.stage.addChild(rope);
        ropeRef.current = rope;

        // FX layer
        const fx = new Graphics();
        app.stage.addChild(fx);
        fxRef.current = fx;
      } catch (err) {
        console.error("PixiJS Init Error:", err);
      }
    };

    init();

    return () => {
      active = false;
      if (appRef.current) {
        appRef.current.destroy({ removeView: true });
        appRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!p1Ref.current || !p2Ref.current || !fxRef.current || !appRef.current || !ropeRef.current) return;

    const p1 = p1Ref.current;
    const p2 = p2Ref.current;
    const fx = fxRef.current;
    const rope = ropeRef.current;
    const app = appRef.current;

    // Base positions
    const baseP1X = 150;
    const baseP2X = 650;
    const offset = tugOfWarPos * 4;

    const targetP1X = baseP1X + offset;
    const targetP2X = baseP2X + offset;

    let animationId: number | null = null;
    const startTime = Date.now();

    const drawRope = (x1: number, x2: number, y: number, sag: number = 0) => {
      rope.clear();
      rope.moveTo(x1, y);
      if (sag !== 0) {
        rope.quadraticCurveTo((x1 + x2) / 2, y + sag, x2, y);
      } else {
        rope.lineTo(x2, y);
      }
      rope.stroke({ color: 0x8b4513, width: 8 }); // Brown rope
      rope.stroke({ color: 0xa0522d, width: 2, alpha: 0.5 });
      
      const midX = (x1 + x2) / 2;
      rope.circle(midX, y + sag/2, 10).fill({ color: 0xff0000 });
    };

    const setStance = (p: any, isRight: boolean, pullAmount: number, isShocked: boolean = false) => {
      const dir = isRight ? -1 : 1;
      
      if (isShocked) {
        p.container.rotation = Math.sin(Date.now() / 20) * 0.1;
        p.armFront.rotation = Math.PI;
        p.armBack.rotation = Math.PI;
        p.legFront.rotation = 0;
        p.legBack.rotation = 0;
        return;
      }

      // Lean back
      p.container.rotation = -0.2 * dir - (pullAmount * 0.2 * dir);
      
      // Arms forward to hold rope
      p.armFront.rotation = 1.2 * dir + (pullAmount * 0.3 * dir);
      p.armBack.rotation = 1.3 * dir + (pullAmount * 0.3 * dir);
      
      // Legs planted
      p.legFront.rotation = 0.3 * dir + (pullAmount * 0.2 * dir);
      p.legBack.rotation = -0.4 * dir - (pullAmount * 0.2 * dir);
    };

    const animate = () => {
      const now = Date.now();
      const elapsed = (now - startTime) / 1000; // seconds
      
      let p1Pull = 0;
      let p2Pull = 0;
      let isShocked = false;

      const pullStrength = 20;
      const pullFreq = 15;

      switch (actionState) {
        case 'P1_ATTACK':
          if (elapsed < 0.8) {
            const pull = Math.sin(elapsed * pullFreq);
            p1Pull = Math.max(0, pull);
            p1.container.x = targetP1X - p1Pull * pullStrength;
            p2.container.x = targetP2X - p1Pull * pullStrength - 10;
            drawRope(p1.container.x + 30, p2.container.x - 30, 260, p1Pull * 5);
          } else {
            p1.container.x = targetP1X;
            p2.container.x = targetP2X;
            drawRope(p1.container.x + 30, p2.container.x - 30, 260);
          }
          break;

        case 'P2_ATTACK':
          if (elapsed < 0.8) {
            const pull = Math.sin(elapsed * pullFreq);
            p2Pull = Math.max(0, pull);
            p2.container.x = targetP2X + p2Pull * pullStrength;
            p1.container.x = targetP1X + p2Pull * pullStrength + 10;
            drawRope(p1.container.x + 30, p2.container.x - 30, 260, p2Pull * 5);
          } else {
            p1.container.x = targetP1X;
            p2.container.x = targetP2X;
            drawRope(p1.container.x + 30, p2.container.x - 30, 260);
          }
          break;

        case 'PARRY':
          if (elapsed < 0.8) {
            const shake = Math.sin(elapsed * 50) * 5;
            p1.container.x = targetP1X + shake;
            p2.container.x = targetP2X - shake;
            p1Pull = 0.5;
            p2Pull = 0.5;
            drawRope(p1.container.x + 30, p2.container.x - 30, 260, Math.sin(elapsed * 30) * 10);
            
            fx.clear();
            fx.circle(400 + offset, 260, 30 + Math.random()*20).fill({ color: 0xffffff, alpha: 0.3 });
          } else {
            p1.container.x = targetP1X;
            p2.container.x = targetP2X;
            drawRope(p1.container.x + 30, p2.container.x - 30, 260);
            fx.clear();
          }
          break;

        case 'ENVIRONMENT_PUNISHMENT':
          if (elapsed < 1.2) {
            isShocked = true;
            const shake = Math.sin(elapsed * 80) * 5;
            p1.container.x = targetP1X + shake;
            p2.container.x = targetP2X + shake;
            
            fx.clear();
            for(let i=0; i<2; i++) {
              let curX1 = p1.container.x;
              let curX2 = p2.container.x;
              fx.moveTo(curX1 + Math.random()*60 - 30, 0);
              for(let j=1; j<=5; j++) {
                fx.lineTo(curX1 + Math.random()*40 - 20, (300/5)*j);
              }
              fx.stroke({ color: 0xffffff, width: 2 });
              fx.stroke({ color: 0x00ffff, width: 6, alpha: 0.3 });

              fx.moveTo(curX2 + Math.random()*60 - 30, 0);
              for(let j=1; j<=5; j++) {
                fx.lineTo(curX2 + Math.random()*40 - 20, (300/5)*j);
              }
              fx.stroke({ color: 0xffffff, width: 2 });
              fx.stroke({ color: 0x00ffff, width: 6, alpha: 0.3 });
            }
            drawRope(p1.container.x + 30, p2.container.x - 30, 260, 20);
          } else {
            p1.container.x = targetP1X;
            p2.container.x = targetP2X;
            drawRope(p1.container.x + 30, p2.container.x - 30, 260);
            fx.clear();
          }
          break;

        default:
          p1.container.x = targetP1X;
          p2.container.x = targetP2X;
          drawRope(p1.container.x + 30, p2.container.x - 30, 260);
          fx.clear();
          break;
      }

      setStance(p1, false, p1Pull, isShocked);
      setStance(p2, true, p2Pull, isShocked);

      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [actionState, tugOfWarPos]);

  return (
    <div ref={canvasRef} className="w-full h-full" />
  );
};

export default GameCanvas;
