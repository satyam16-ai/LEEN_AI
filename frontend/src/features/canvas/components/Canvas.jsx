import '@fontsource/kalam/400.css';

import {
  Download,
  Gauge,
  Maximize,
  MessageSquareText,
  Minimize,
  Pause,
  Play,
  RotateCcw,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/utils/cn';

import { SPEEDS } from '../constants';
import { BOARD_THEMES } from '../engine/board';
import { cameraTransform } from '../engine/camera';
import { CiteLayer } from './CiteLayer';
import { MathText } from './MathText';
import { NarrationMenu } from './NarrationMenu';
import { PageStrip } from './PageStrip';

const FRAME_COLORS = { light: '#d9dde5', dark: '#5b4129' };

function boardBackground(theme) {
  const { background, grid } = BOARD_THEMES[theme];
  return {
    backgroundColor: background,
    backgroundImage: [
      'radial-gradient(ellipse at 50% 40%, rgba(255,255,255,0.05), transparent 70%)',
      `linear-gradient(${grid} 1px, transparent 1px)`,
      `linear-gradient(90deg, ${grid} 1px, transparent 1px)`,
    ].join(', '),
    backgroundSize: '100% 100%, 4% 7.111%, 4% 7.111%',
  };
}

function StatusPill({ status }) {
  if (!status) return null;
  const { label, tone, icon: Icon, spin } = status;
  return (
    <div
      className={cn(
        'absolute top-2 right-2 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur sm:top-3 sm:right-3',
        tone === 'danger'
          ? 'bg-destructive/90 text-white'
          : tone === 'success'
            ? 'bg-success/90 text-white'
            : 'bg-card/90 text-foreground'
      )}
    >
      <Icon className={cn('size-3.5', spin && 'animate-spin')} aria-hidden="true" />
      {label}
    </div>
  );
}

function CaptionBar({ caption }) {
  return (
    <div
      className="flex min-h-16 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-xs"
      aria-live="polite"
    >
      <MessageSquareText className="size-5 shrink-0 text-primary" aria-hidden="true" />
      {caption ? (
        <p key={caption} className="animate-fade-in text-[15px] leading-relaxed sm:text-base">
          <MathText text={caption} />
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Captions appear here while your AI teacher explains.
        </p>
      )}
    </div>
  );
}

function useFullscreen(ref) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    const onChange = () => setActive(document.fullscreenElement === ref.current);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [ref]);
  const toggle = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else ref.current?.requestFullscreen?.();
  };
  return [active, toggle];
}

/**
 * The whiteboard: three stacked canvases (ink, animated scene, pencil overlay) driven by a
 * BoardPlayer, with live captions and playback controls underneath. `onOpenCite` makes the
 * board's page citations clickable.
 */
export function Canvas({ player, board, status, label, canReplay, onOpenCite, children }) {
  const frameRef = useRef(null);
  const surfaceRef = useRef(null);
  const inkRef = useRef(null);
  const sceneRef = useRef(null);
  const overlayRef = useRef(null);
  const { resolvedTheme } = useTheme();
  const [fullscreen, toggleFullscreen] = useFullscreen(frameRef);

  useEffect(() => {
    player.attach(inkRef.current, sceneRef.current, overlayRef.current);
    const observer = new ResizeObserver(([entry]) => player.resize(entry.contentRect.width));
    observer.observe(surfaceRef.current);
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    player.setInstant(Boolean(reducedMotion?.matches));
    return () => {
      observer.disconnect();
      player.detach();
    };
  }, [player]);

  useEffect(() => player.setTheme(resolvedTheme), [player, resolvedTheme]);

  const { status: playerStatus, captions, speed, pages, pageTitle, camera, cites } = board;
  const zoom = cameraTransform(camera);
  const playing = playerStatus === 'playing' || playerStatus === 'waiting';
  const hasBoard = playerStatus !== 'idle';

  const cycleSpeed = () => player.setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]);

  const download = async () => {
    const blob = await player.toBlob();
    if (!blob) return;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'leen-whiteboard.png';
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div
      ref={frameRef}
      className="space-y-3 [&:fullscreen]:flex [&:fullscreen]:flex-col [&:fullscreen]:justify-center [&:fullscreen]:bg-background [&:fullscreen]:p-4"
    >
      <div
        className="relative mx-auto w-full overflow-hidden rounded-xl border-[5px] shadow-soft sm:border-[7px] [:fullscreen_&]:w-[min(100%,calc((100vh-10rem)*16/9))]"
        style={{ borderColor: FRAME_COLORS[resolvedTheme] }}
      >
        <div ref={surfaceRef} className="relative aspect-video w-full">
          <div
            className="absolute inset-0 transition-transform duration-600 ease-in-out motion-reduce:transition-none"
            style={{
              ...boardBackground(resolvedTheme),
              transform: `translate(${zoom.tx}%, ${zoom.ty}%) scale(${zoom.scale})`,
            }}
          >
            <canvas
              ref={inkRef}
              className="absolute inset-0 size-full"
              role="img"
              aria-label={label ? `Whiteboard explanation: ${label}` : 'Whiteboard'}
            />
            <canvas
              ref={sceneRef}
              className="pointer-events-none absolute inset-0 size-full"
              aria-hidden="true"
            />
            <canvas
              ref={overlayRef}
              className="pointer-events-none absolute inset-0 size-full"
              aria-hidden="true"
            />
            {onOpenCite && <CiteLayer cites={cites} onOpen={onOpenCite} />}
          </div>
          {!hasBoard && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-4 text-center sm:gap-2 sm:p-6">
              <p
                className="font-hand text-xl sm:text-4xl"
                style={{ color: BOARD_THEMES[resolvedTheme].colors.ink }}
              >
                Ask me any doubt ✏️
              </p>
              <p
                className="font-hand text-sm opacity-80 sm:text-xl"
                style={{ color: BOARD_THEMES[resolvedTheme].colors.blue }}
              >
                I'll explain it right here, step by step.
              </p>
              {children && <div className="mt-2 sm:mt-4">{children}</div>}
            </div>
          )}
          <StatusPill status={status} />
        </div>
      </div>

      <div className="mx-auto w-full space-y-3 [:fullscreen_&]:w-[min(100%,calc((100vh-10rem)*16/9))]">
        <CaptionBar caption={captions.at(-1)} />
        <PageStrip pages={pages} current={pageTitle} />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={() => (playing ? player.pause() : player.play())}
              disabled={!(playing || playerStatus === 'paused')}
            >
              {playing ? (
                <Pause className="size-4" aria-hidden="true" />
              ) : (
                <Play className="size-4" aria-hidden="true" />
              )}
              {playing ? 'Pause' : 'Play'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => player.replay()} disabled={!canReplay}>
              <RotateCcw className="size-4" aria-hidden="true" />
              <span className="sr-only sm:not-sr-only">Replay</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={cycleSpeed}
              aria-label={`Playback speed ${speed}×. Change speed`}
            >
              <Gauge className="size-4" aria-hidden="true" />
              {speed}×
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <NarrationMenu player={player} />
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={download}
              disabled={!hasBoard}
              aria-label="Download the board as an image"
              title="Download PNG"
            >
              <Download className="size-4" aria-hidden="true" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={toggleFullscreen}
              aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}
              title={fullscreen ? 'Exit full screen' : 'Full screen'}
            >
              {fullscreen ? (
                <Minimize className="size-4" aria-hidden="true" />
              ) : (
                <Maximize className="size-4" aria-hidden="true" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
