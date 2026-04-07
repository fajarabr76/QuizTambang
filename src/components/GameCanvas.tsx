
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
  // Flip P2 to face left
  if (isRight) {
    container.scale.x = -1;
  }
  const dir = 1; // Always face "forward" in local space

  const skinColor = 0xF5C5A3;
  const skinHighlight = 0xFFDDC1;
  const pantsColor = isRight ? 0x7F1D1D : 0x1E293B;
  const shoeColor = 0x0F172A;
  const darkMain = darkenColor(mainColor, 0.3);

  // Legs
  const createLeg = () => {
    const legCont = new Container();
    const thigh = new Graphics().roundRect(-8, 0, 16, 48, 8).fill({ color: pantsColor });
    
    const shinCont = new Container();
    shinCont.y = 40;
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
    const color = isBack ? darkMain : mainColor;
    const upperArm = new Graphics().roundRect(-6, 0, 12, 45, 6).fill({ color });
    
    const forearmCont = new Container();
    forearmCont.y = 40;
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
        p1.container.y = 220;
        app.stage.addChild(p1.container);
        p1Ref.current = p1;

        // P2 Character
        const p2 = createCharacter(0xDC2626, true); // Red
        p2.container.x = 650;
        p2.container.y = 220;
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

    const setStance = (char: CharacterRig, action: ActionState, isRight: boolean, pullStrength: number) => {
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

      if (action === 'ENVIRONMENT_PUNISHMENT') {
        char.container.rotation = Math.sin(Date.now() / 20) * 0.1;
        char.leftArm.rotation = -Math.PI * 0.8;
        char.rightArm.rotation = -Math.PI * 0.8;
        return;
      }

      const isPulling = (action === 'P1_ATTACK' && !isRight) || (action === 'P2_ATTACK' && isRight);
      const isBeingPulled = (action === 'P1_ATTACK' && isRight) || (action === 'P2_ATTACK' && !isRight);

      if (isPulling) {
        // Dramatic lean back
        char.torsoContainer.rotation = -0.6 - (pullStrength * 0.3);
        
        // Arms reaching forward to hold rope
        char.leftArm.rotation = 1.4;
        char.leftForearm.rotation = 0.2;
        char.rightArm.rotation = 1.5;
        char.rightForearm.rotation = 0.1;
        
        // Strong leg stance (kuda-kuda)
        char.leftLeg.rotation = 0.8; // Front leg
        char.leftShin.rotation = -0.4;
        char.rightLeg.rotation = -0.6; // Back leg
        char.rightShin.rotation = 0.3;
      } else if (isBeingPulled) {
        // Lean forward (struggling)
        char.torsoContainer.rotation = 0.3;
        
        char.leftArm.rotation = 1.1;
        char.rightArm.rotation = 1.2;
        
        char.leftLeg.rotation = -0.3;
        char.rightLeg.rotation = 0.2;
      } else {
        // Idle / Default Tug Stance
        const breathe = Math.sin(Date.now() / 500) * 0.05;
        char.torsoContainer.rotation = -0.3 + breathe;
        
        // Hold rope at waist height
        char.leftArm.rotation = 1.3;
        char.rightArm.rotation = 1.4;
        
        char.leftLeg.rotation = 0.4;
        char.rightLeg.rotation = -0.3;
      }
    };

    const animate = () => {
      const now = Date.now();
      const elapsed = (now - startTime) / 1000; // seconds
      
      let p1Pull = 0;
      let p2Pull = 0;

      const pullStrength = 20;
      const pullFreq = 15;

      // Rope Y position at waist height
      const ropeY = 250;

      switch (actionState) {
        case 'P1_ATTACK':
          if (elapsed < 0.8) {
            const pull = Math.sin(elapsed * pullFreq);
            p1Pull = Math.max(0, pull);
            p1.container.x = targetP1X - p1Pull * pullStrength;
            p2.container.x = targetP2X - p1Pull * pullStrength - 10;
            drawRope(p1.container.x + 40, p2.container.x - 40, ropeY, p1Pull * 5);
          } else {
            p1.container.x = targetP1X;
            p2.container.x = targetP2X;
            drawRope(p1.container.x + 40, p2.container.x - 40, ropeY);
          }
          break;

        case 'P2_ATTACK':
          if (elapsed < 0.8) {
            const pull = Math.sin(elapsed * pullFreq);
            p2Pull = Math.max(0, pull);
            p2.container.x = targetP2X + p2Pull * pullStrength;
            p1.container.x = targetP1X + p2Pull * pullStrength + 10;
            drawRope(p1.container.x + 40, p2.container.x - 40, ropeY, p2Pull * 5);
          } else {
            p1.container.x = targetP1X;
            p2.container.x = targetP2X;
            drawRope(p1.container.x + 40, p2.container.x - 40, ropeY);
          }
          break;

        case 'PARRY':
          if (elapsed < 0.8) {
            const shake = Math.sin(elapsed * 50) * 5;
            p1.container.x = targetP1X + shake;
            p2.container.x = targetP2X - shake;
            p1Pull = 0.5;
            p2Pull = 0.5;
            drawRope(p1.container.x + 40, p2.container.x - 40, ropeY, Math.sin(elapsed * 30) * 10);
            
            fx.clear();
            fx.circle(400 + offset, ropeY, 30 + Math.random()*20).fill({ color: 0xffffff, alpha: 0.3 });
          } else {
            p1.container.x = targetP1X;
            p2.container.x = targetP2X;
            drawRope(p1.container.x + 40, p2.container.x - 40, ropeY);
            fx.clear();
          }
          break;

        case 'ENVIRONMENT_PUNISHMENT':
          if (elapsed < 1.2) {
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
            drawRope(p1.container.x + 40, p2.container.x - 40, ropeY, 20);
          } else {
            p1.container.x = targetP1X;
            p2.container.x = targetP2X;
            drawRope(p1.container.x + 40, p2.container.x - 40, ropeY);
            fx.clear();
          }
          break;

        default:
          p1.container.x = targetP1X;
          p2.container.x = targetP2X;
          drawRope(p1.container.x + 40, p2.container.x - 40, ropeY);
          fx.clear();
          break;
      }

      setStance(p1, actionState, false, p1Pull);
      setStance(p2, actionState, true, p2Pull);

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
