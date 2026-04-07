
import React, { useEffect, useRef, useState } from 'react';
import { Application, Sprite, Assets, Graphics, Container } from 'pixi.js';
import { ActionState } from '../types';

interface GameCanvasProps {
  actionState: ActionState;
  tugOfWarPos: number;
  side: 'left' | 'right';
}

interface CharacterRig {
  container: Container;
  torsoContainer: Container;
  head: Graphics;
  leftArm: Container;
  rightArm: Container;
  leftForearm: Container;
  rightForearm: Container;
  leftLeg: Container;
  rightLeg: Container;
  leftShin: Container;
  rightShin: Container;
}

const darkenColor = (color: number, amount: number) => {
  const r = (color >> 16) & 0xff;
  const g = (color >> 8) & 0xff;
  const b = color & 0xff;
  return (Math.floor(r * (1 - amount)) << 16) |
         (Math.floor(g * (1 - amount)) << 8) |
         Math.floor(b * (1 - amount));
};

const createCharacter = (mainColor: number, isRight: boolean): CharacterRig => {
  const container = new Container();
  // P2 faces left (mirror)
  if (isRight) {
    container.scale.x = -1;
  }
  const dir = 1; // In local space, forward is always positive X

  const skinColor = 0xF5C5A3;
  const skinHighlight = 0xFFDDC1;
  const pantsColor = isRight ? 0x7F1D1D : 0x1E293B;
  const shoeColor = 0x0F172A;
  const darkMain = darkenColor(mainColor, 0.3);

  // Legs
  const createLeg = () => {
    const legCont = new Container();
    // Pivot at hip
    legCont.pivot.set(0, 0);
    const thigh = new Graphics().roundRect(-8, 0, 16, 48, 8).fill({ color: pantsColor });
    
    const shinCont = new Container();
    // Pivot at knee
    shinCont.y = 40;
    shinCont.pivot.set(0, 0);
    const shin = new Graphics().roundRect(-6.5, 0, 13, 42, 6).fill({ color: skinColor });
    const foot = new Graphics().ellipse(5, 40, 22, 12).fill({ color: shoeColor });
    
    shinCont.addChild(shin, foot);
    legCont.addChild(thigh, shinCont);
    return { legCont, shinCont };
  };

  const leftLegData = createLeg();
  const rightLegData = createLeg();
  
  leftLegData.legCont.x = -15;
  rightLegData.legCont.x = 15;
  leftLegData.legCont.y = 60;
  rightLegData.legCont.y = 60;

  // Torso Container
  const torsoContainer = new Container();
  // Pivot at pelvis/hips for leaning
  torsoContainer.pivot.set(0, 65);
  torsoContainer.y = 65;
  
  const pelvis = new Graphics().rect(-22, 55, 44, 18).fill({ color: pantsColor });
  
  const torso = new Graphics();
  // Main torso trapezoid
  torso.poly([-30, 0, 30, 0, 22, 65, -22, 65]).fill({ color: mainColor });
  // Shading
  torso.poly([-30, 0, -22, 0, -16, 65, -22, 65]).fill({ color: darkMain });
  
  const neck = new Graphics().rect(-5, -10, 10, 15).fill({ color: skinColor });
  
  const head = new Container();
  const headBase = new Graphics().ellipse(0, -35, 28, 32).fill({ color: skinColor });
  const faceHighlight = new Graphics().circle(-12, -45, 8).fill({ color: skinHighlight, alpha: 0.4 });
  const leftEye = new Graphics().circle(-10 * dir, -40, 3).fill({ color: 0x000000 });
  const rightEye = new Graphics().circle(10 * dir, -40, 3).fill({ color: 0x000000 });
  head.addChild(headBase, faceHighlight, leftEye, rightEye);

  // Arms
  const createArm = (isBack: boolean) => {
    const armCont = new Container();
    // Pivot at shoulder
    armCont.pivot.set(0, 0);
    const color = isBack ? darkMain : mainColor;
    const upperArm = new Graphics().roundRect(-6, 0, 12, 45, 6).fill({ color });
    
    const forearmCont = new Container();
    // Pivot at elbow
    forearmCont.y = 40;
    forearmCont.pivot.set(0, 0);
    const forearm = new Graphics().roundRect(-5, 0, 10, 38, 5).fill({ color: skinColor });
    const hand = new Graphics().ellipse(0, 35, 12, 10).fill({ color: skinColor });
    
    forearmCont.addChild(forearm, hand);
    armCont.addChild(upperArm, forearmCont);
    return { armCont, forearmCont };
  };

  const leftArmData = createArm(true);
  const rightArmData = createArm(false);
  
  leftArmData.armCont.position.set(-30, 5);
  rightArmData.armCont.position.set(30, 5);

  torsoContainer.addChild(neck, head, torso, pelvis, leftArmData.armCont, rightArmData.armCont);
  
  container.addChild(leftLegData.legCont, rightLegData.legCont, torsoContainer);

  return {
    container,
    torsoContainer,
    head: headBase,
    leftArm: leftArmData.armCont,
    rightArm: rightArmData.armCont,
    leftForearm: leftArmData.forearmCont,
    rightForearm: rightArmData.forearmCont,
    leftLeg: leftLegData.legCont,
    rightLeg: rightLegData.legCont,
    leftShin: leftLegData.shinCont,
    rightShin: rightLegData.shinCont
  };
};

const GameCanvas: React.FC<GameCanvasProps> = ({ actionState, tugOfWarPos, side }) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  const p1Ref = useRef<CharacterRig | null>(null);
  const p2Ref = useRef<CharacterRig | null>(null);
  const ropeRef = useRef<Graphics | null>(null);
  const fxRef = useRef<Graphics | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

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
        const p1 = createCharacter(0x2563EB, false); // Blue
        p1.container.x = 150;
        p1.container.y = 180;
        app.stage.addChild(p1.container);
        p1Ref.current = p1;

        // P2 Character
        const p2 = createCharacter(0xDC2626, true); // Red
        p2.container.x = 650;
        p2.container.y = 180;
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

        setIsInitialized(true);
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
    if (!isInitialized || !p1Ref.current || !p2Ref.current || !fxRef.current || !appRef.current || !ropeRef.current) return;

    const p1 = p1Ref.current;
    const p2 = p2Ref.current;
    const fx = fxRef.current;
    const rope = ropeRef.current;

    // Base positions
    const baseP1X = 150;
    const baseP2X = 650;
    const offset = tugOfWarPos * 4;

    // Clamp positions
    const targetP1X = Math.max(100, Math.min(700, baseP1X + offset));
    const targetP2X = Math.max(100, Math.min(700, baseP2X + offset));

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

    const setTugStance = (
      char: CharacterRig,
      mode: 'pulling' | 'pulled' | 'idle' | 'shocked',
      elapsed: number
    ) => {
      // Reset rotations
      char.container.rotation = 0;
      char.torsoContainer.rotation = 0;
      char.leftArm.rotation = 0;
      char.rightArm.rotation = 0;
      char.leftForearm.rotation = 0;
      char.rightForearm.rotation = 0;
      char.leftLeg.rotation = 0;
      char.rightLeg.rotation = 0;
      char.leftShin.rotation = 0;
      char.rightShin.rotation = 0;

      const breathe = Math.sin(elapsed * 2.5) * 0.03;

      switch(mode) {
        case 'pulling':
          char.torsoContainer.rotation = -0.65;
          char.leftArm.rotation  = -1.65;
          char.leftForearm.rotation  = 0.15;
          char.rightArm.rotation = -1.55;
          char.rightForearm.rotation = 0.1;
          char.leftLeg.rotation  = -0.65;
          char.leftShin.rotation =  0.50;
          char.rightLeg.rotation =  0.55;
          char.rightShin.rotation = -0.25;
          break;

        case 'pulled':
          char.torsoContainer.rotation =  0.40;
          char.leftArm.rotation  = -1.25;
          char.leftForearm.rotation = -0.25;
          char.rightArm.rotation = -1.15;
          char.rightForearm.rotation = -0.20;
          char.leftLeg.rotation  =  0.55;
          char.leftShin.rotation = -0.45;
          char.rightLeg.rotation = -0.50;
          char.rightShin.rotation =  0.1;
          break;

        case 'idle':
          char.torsoContainer.rotation = -0.35 + breathe;
          char.leftArm.rotation  = -1.45;
          char.leftForearm.rotation = -0.05;
          char.rightArm.rotation = -1.35;
          char.rightForearm.rotation = 0.0;
          char.leftLeg.rotation  = -0.45;
          char.leftShin.rotation =  0.35;
          char.rightLeg.rotation =  0.40;
          char.rightShin.rotation = -0.18;
          break;

        case 'shocked':
          char.container.rotation = Math.sin(elapsed * 90) * 0.12;
          char.torsoContainer.rotation = -0.2 + Math.sin(elapsed * 70) * 0.15;
          char.leftArm.rotation = -1.8;
          char.rightArm.rotation = -2.0;
          char.leftForearm.rotation = 1.2;
          char.rightForearm.rotation = 0.9;
          char.leftLeg.rotation = -0.3;
          char.rightLeg.rotation = 0.3;
          break;
      }
    };

    const animate = () => {
      const now = Date.now();
      const elapsed = (now - startTime) / 1000; // seconds
      
      const offset = tugOfWarPos * 4;

      // Rope Y position at waist height
      const ROPE_Y = 196;

      switch (actionState) {
        case 'P1_ATTACK': {
          setTugStance(p1, 'pulling', elapsed);
          setTugStance(p2, 'pulled', elapsed);
          const burst = elapsed < 0.8 ? Math.max(0, Math.sin(elapsed * 14)) * (1 - elapsed * 1.2) : 0;
          p1.container.x = targetP1X - burst * 15;
          p2.container.x = targetP2X - burst * 10;
          drawRope(p1.container.x + 54, p2.container.x - 54, ROPE_Y, 6 + burst * 12);
          break;
        }
        case 'P2_ATTACK': {
          setTugStance(p1, 'pulled', elapsed);
          setTugStance(p2, 'pulling', elapsed);
          const burst = elapsed < 0.8 ? Math.max(0, Math.sin(elapsed * 14)) * (1 - elapsed * 1.2) : 0;
          p2.container.x = targetP2X + burst * 15;
          p1.container.x = targetP1X + burst * 10;
          drawRope(p1.container.x + 54, p2.container.x - 54, ROPE_Y, 6 + burst * 12);
          break;
        }
        case 'PARRY': {
          setTugStance(p1, 'pulling', elapsed);
          setTugStance(p2, 'pulling', elapsed);
          const shake = elapsed < 0.8 ? Math.sin(elapsed * 55) * 4 : 0;
          p1.container.x = targetP1X + shake;
          p2.container.x = targetP2X - shake;
          drawRope(p1.container.x + 54, p2.container.x - 54, ROPE_Y, 4 + Math.abs(shake));
          
          fx.clear();
          if (elapsed < 0.8) {
            fx.circle(400 + offset, ROPE_Y, 30 + Math.random()*20).fill({ color: 0xffffff, alpha: 0.3 });
          }
          break;
        }
        case 'ENVIRONMENT_PUNISHMENT': {
          setTugStance(p1, 'shocked', elapsed);
          setTugStance(p2, 'shocked', elapsed);
          drawRope(p1.container.x + 54, p2.container.x - 54, ROPE_Y, 22);
          
          if (elapsed < 1.2) {
            const shakeEnv = Math.sin(elapsed * 80) * 5;
            p1.container.x = targetP1X + shakeEnv;
            p2.container.x = targetP2X + shakeEnv;
            
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
          } else {
            p1.container.x = targetP1X;
            p2.container.x = targetP2X;
            fx.clear();
          }
          break;
        }
        default: {
          setTugStance(p1, 'idle', elapsed);
          setTugStance(p2, 'idle', elapsed);
          p1.container.x = targetP1X;
          p2.container.x = targetP2X;
          drawRope(p1.container.x + 54, p2.container.x - 54, ROPE_Y, 8);
          fx.clear();
          break;
        }
      }

      animationIdRef.current = requestAnimationFrame(animate);
    };

    animationIdRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current);
    };
  }, [actionState, tugOfWarPos, isInitialized]);

  return (
    <div ref={canvasRef} className="w-full h-full" />
  );
};

export default GameCanvas;
