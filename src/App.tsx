import { useEffect, useRef, useState } from 'react';
import { Game, type GamePublicState } from './game/Game';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<Game | null>(null);
  const [state, setState] = useState<GamePublicState>({
    status: 'menu',
    score: 0,
    highScore: 0,
    lives: 3,
    level: 1,
    isBonusStage: false,
    enemiesRemaining: 0,
    message: '',
    messageTimer: 0,
    isFullscreen: false,
  });
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const game = new Game(canvas, (newState) => {
      setState(newState);
    });
    gameRef.current = game;
    game.run();

    return () => {
      game.destroy();
      gameRef.current = null;
    };
  }, []);

  const handleStart = () => {
    gameRef.current?.start();
  };

  const toggleFullscreen = () => {
    gameRef.current?.toggleFullscreen();
  };

  const toggleMusic = () => {
    gameRef.current?.toggleMusic();
  };

  const hearts = '❤'.repeat(Math.max(0, state.lives));

  return (
    <div className="min-h-screen w-full bg-black flex flex-col items-center justify-center overflow-hidden select-none font-mono">
      <div className="relative w-full max-w-3xl aspect-[3/4] max-h-screen">
        <canvas
          ref={canvasRef}
          className="w-full h-full block rounded-lg shadow-[0_0_60px_rgba(255,0,204,0.4)] bg-[#050510] touch-none"
        />

        {/* HUD */}
        <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start pointer-events-none">
          <div className="flex flex-col gap-1">
            <div className="text-cyan-400 text-sm tracking-widest drop-shadow-[0_0_8px_rgba(0,240,255,0.8)]">
              SCORE
            </div>
            <div className="text-white text-xl tracking-wider">
              {state.score.toString().padStart(7, '0')}
            </div>
          </div>

          <div className="flex flex-col items-center gap-1">
            <div className="text-fuchsia-400 text-xs tracking-widest uppercase drop-shadow-[0_0_8px_rgba(255,0,204,0.8)]">
              {state.isBonusStage ? 'Bonus' : `Niveau ${state.level}`}
            </div>
            {state.status === 'playing' && !state.isBonusStage && (
              <div className="text-white/70 text-xs">
                Ennemis: {state.enemiesRemaining}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-1 items-end">
            <div className="text-cyan-400 text-sm tracking-widest drop-shadow-[0_0_8px_rgba(0,240,255,0.8)]">
              TOP
            </div>
            <div className="text-white text-xl tracking-wider">
              {Math.max(state.score, state.highScore).toString().padStart(7, '0')}
            </div>
          </div>
        </div>

        {/* Top-right controls */}
        <div className="absolute top-4 right-4 flex flex-col gap-2 pointer-events-auto z-10">
          <button
            onClick={toggleMusic}
            className="p-2 rounded-full bg-black/40 backdrop-blur-sm hover:bg-white/20 text-white/80 transition-colors border border-white/10"
            title="Musique"
          >
            <span className="sr-only">Musique</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-full bg-black/40 backdrop-blur-sm hover:bg-white/20 text-white/80 transition-colors border border-white/10"
            title={state.isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}
          >
            <span className="sr-only">{state.isFullscreen ? 'Quitter le plein écran' : 'Plein écran'}</span>
            {state.isFullscreen ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3"/><path d="M21 8h-3a2 2 0 0 1-2-2V3"/><path d="M3 16h3a2 2 0 0 1 2 2v3"/><path d="M16 21v-3a2 2 0 0 1 2-2h3"/></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg>
            )}
          </button>
          <button
            onClick={() => setShowInfo(true)}
            className="p-2 rounded-full bg-black/40 backdrop-blur-sm hover:bg-white/20 text-white/80 transition-colors border border-white/10"
            title="Comment ce jeu a été fait"
          >
            <span className="sr-only">Infos</span>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
          </button>
        </div>

        {/* Lives */}
        <div className="absolute bottom-4 left-4 pointer-events-none">
          <div className="text-red-500 text-2xl drop-shadow-[0_0_10px_rgba(255,0,0,0.8)] tracking-widest">
            {hearts}
          </div>
        </div>

        {/* Controls hint */}
        <div className="absolute bottom-4 right-4 pointer-events-none text-right">
          <div className="text-white/40 text-xs leading-relaxed">
            <div>Déplacer: ← → / Q D</div>
            <div>Tirer: ESPACE / Z</div>
            <div>Pause: P</div>
          </div>
        </div>

        {/* Menu / Game Over overlay button */}
        {(state.status === 'menu' || state.status === 'gameover') && (
          <div className="absolute inset-0 flex flex-col items-center justify-end pb-36 pointer-events-auto gap-4">
            <button
              onClick={handleStart}
              className="px-12 py-4 bg-gradient-to-r from-fuchsia-600 via-purple-600 to-cyan-600 text-white font-bold text-xl rounded-full shadow-[0_0_40px_rgba(255,0,204,0.6)] hover:scale-105 active:scale-95 transition-transform border border-white/30 animate-pulse"
            >
              {state.status === 'gameover' ? 'REJOUER' : 'JOUER'}
            </button>
            {state.status === 'menu' && (
              <div className="text-white/40 text-xs">Appuyez sur ENTRÉE pour commencer</div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="w-full max-w-3xl px-4 py-2 flex justify-between items-center text-white/40 text-xs">
        <span>Créateur: <span className="text-cyan-400">Hylst - Geoffroy</span> avec l'aide d'une IA</span>
        <span className="hidden md:inline text-fuchsia-400">Galaga Legacy</span>
      </div>

      {showInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4" onClick={() => setShowInfo(false)}>
          <div className="w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-white/10 bg-[#0a0510] shadow-[0_0_60px_rgba(255,0,204,0.2)]" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 space-y-3.5 text-sm leading-relaxed text-white/80">
              <h3 className="text-xl font-bold text-fuchsia-300">Comment ce jeu a été fait</h3>
              <p><strong className="text-white">Stack :</strong> React 19, TypeScript 5.9, Tailwind CSS 4, Vite 7, compilé en un seul fichier HTML, aucune dépendance chargée depuis l'extérieur.</p>
              <p><strong className="text-white">Graphismes :</strong> tout est dessiné en Canvas 2D à chaque image (vaisseaux, formations, tirs), aucun sprite ni image externe.</p>
              <p><strong className="text-white">Musique &amp; sons :</strong> synthétisés en direct avec l'API Web Audio, aucun fichier audio chargé.</p>
              <p><strong className="text-white">Interactions :</strong> flèches ou Q/D pour se déplacer, espace ou Z pour tirer, P pour mettre en pause.</p>
              <p><strong className="text-white">Architecture :</strong> toute la logique de jeu vit dans une classe <code>Game</code> pilotant sa propre boucle Canvas, qui notifie React de l'état public (score, vies, niveau) uniquement quand il change.</p>
              <p><strong className="text-white">Algorithmes notables :</strong> chaque ennemi suit une machine à états (en formation, piqué vers le joueur, capture au rayon tracteur, retour en formation) fidèle au genre, avec des niveaux bonus intercalés entre les vagues classiques.</p>
            </div>
            <div className="border-t border-white/10 p-4 text-center">
              <button onClick={() => setShowInfo(false)} className="px-6 py-2.5 rounded-full font-bold text-white bg-gradient-to-r from-fuchsia-600 via-purple-600 to-cyan-600 hover:brightness-110 active:scale-95 transition-all">Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
