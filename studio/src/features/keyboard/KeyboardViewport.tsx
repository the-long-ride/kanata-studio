import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type WheelEvent } from 'react';
import type { UiMode } from '../../lib/types';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.1;
const KEEP_VISIBLE = 80;

type ViewState = { zoom: number; x: number; y: number };
type DragState = { pointerId: number; x: number; y: number; startX: number; startY: number };

const clampZoom = (zoom: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));

export function KeyboardViewport({
  boardWidth,
  boardHeight,
  viewMode = 'Beginner',
  resetKey = 'default',
  children,
}: {
  boardWidth: number;
  boardHeight: number;
  viewMode?: UiMode;
  resetKey?: string;
  children: ReactNode;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | undefined>(undefined);
  const previousMode = useRef<UiMode>(viewMode);
  const views = useRef<Record<UiMode, ViewState>>({
    Beginner: { zoom: 1, x: 0, y: 0 },
    Advanced: { zoom: 1, x: 0, y: 0 },
  });
  const [view, setView] = useState<ViewState>(() => views.current[viewMode]);
  const [panning, setPanning] = useState(false);

  const viewportSize = useCallback(() => {
    const node = viewportRef.current;
    if (!node) return { width: 0, height: 0, left: 0, top: 0 };
    const rect = node.getBoundingClientRect();
    return {
      width: node.clientWidth || rect.width,
      height: node.clientHeight || rect.height,
      left: rect.left,
      top: rect.top,
    };
  }, []);

  const clampPan = useCallback((next: ViewState) => {
    const size = viewportSize();
    if (!size.width || !size.height) return next;
    const scaledWidth = boardWidth * next.zoom;
    const scaledHeight = boardHeight * next.zoom;
    const minX = KEEP_VISIBLE - scaledWidth;
    const maxX = size.width - KEEP_VISIBLE;
    const minY = KEEP_VISIBLE - scaledHeight;
    const maxY = size.height - KEEP_VISIBLE;
    return {
      ...next,
      x: Math.max(minX, Math.min(maxX, next.x)),
      y: Math.max(minY, Math.min(maxY, next.y)),
    };
  }, [boardHeight, boardWidth, viewportSize]);

  const commit = useCallback((next: ViewState) => {
    const clamped = clampPan(next);
    views.current[viewMode] = clamped;
    setView(clamped);
  }, [clampPan, viewMode]);

  const fitState = useCallback((): ViewState => {
    const size = viewportSize();
    if (!size.width || !size.height || !boardWidth || !boardHeight) return { zoom: 1, x: 0, y: 0 };
    const padding = 36;
    const zoom = clampZoom(Math.min(
      (size.width - padding * 2) / boardWidth,
      (size.height - padding * 2) / boardHeight,
    ));
    return {
      zoom,
      x: (size.width - boardWidth * zoom) / 2,
      y: (size.height - boardHeight * zoom) / 2,
    };
  }, [boardHeight, boardWidth, viewportSize]);

  const fit = useCallback(() => commit(fitState()), [commit, fitState]);

  useEffect(() => {
    if (previousMode.current === viewMode) return;
    views.current[previousMode.current] = view;
    previousMode.current = viewMode;
    setView(views.current[viewMode]);
  }, [view, viewMode]);

  useLayoutEffect(() => {
    const next = fitState();
    views.current.Beginner = next;
    views.current.Advanced = next;
    setView(next);
  }, [fitState, resetKey]);

  const zoomTo = (zoom: number, clientX?: number, clientY?: number) => {
    const nextZoom = clampZoom(zoom);
    if (nextZoom === view.zoom) return;
    const size = viewportSize();
    const screenX = clientX === undefined ? size.width / 2 : clientX - size.left;
    const screenY = clientY === undefined ? size.height / 2 : clientY - size.top;
    const localX = (screenX - view.x) / view.zoom;
    const localY = (screenY - view.y) / view.zoom;
    commit({
      zoom: nextZoom,
      x: screenX - localX * nextZoom,
      y: screenY - localY * nextZoom,
    });
  };

  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    zoomTo(view.zoom + (event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP), event.clientX, event.clientY);
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement;
    const overKey = Boolean(target.closest('.keyboard-key'));
    const canStart = event.button === 1 || (event.button === 0 && !overKey);
    if (!canStart) return;
    event.preventDefault();
    dragRef.current = { pointerId: event.pointerId, x: view.x, y: view.y, startX: event.clientX, startY: event.clientY };
    setPanning(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = useCallback((event: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    commit({
      ...view,
      x: drag.x + event.clientX - drag.startX,
      y: drag.y + event.clientY - drag.startY,
    });
  }, [commit, view]);

  const stopPan = useCallback((event: PointerEvent) => {
    if (!dragRef.current || dragRef.current.pointerId !== event.pointerId) return;
    dragRef.current = undefined;
    setPanning(false);
  }, []);

  useEffect(() => {
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', stopPan);
    window.addEventListener('pointercancel', stopPan);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', stopPan);
      window.removeEventListener('pointercancel', stopPan);
    };
  }, [onPointerMove, stopPan]);

  return <div className="keyboard-viewport-shell">
    <div className="keyboard-zoom-toolbar" role="group" aria-label="Keyboard zoom">
      <button type="button" aria-label="Zoom out" onClick={() => zoomTo(view.zoom - ZOOM_STEP)}>−</button>
      <span>{Math.round(view.zoom * 100)}%</span>
      <button type="button" aria-label="Zoom in" onClick={() => zoomTo(view.zoom + ZOOM_STEP)}>+</button>
      <button type="button" aria-label="Fit keyboard" onClick={fit}>Fit</button>
    </div>
    <div
      ref={viewportRef}
      className={`keyboard-viewport ${panning ? 'panning' : ''}`}
      data-testid="keyboard-viewport"
      onWheel={onWheel}
      onPointerDown={onPointerDown}
      onDoubleClick={event => {
        if (!(event.target as HTMLElement).closest('.keyboard-key')) fit();
      }}
    >
      <div
        className="keyboard-transform"
        data-testid="keyboard-transform"
        style={{
          width: boardWidth,
          height: boardHeight,
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
        }}
      >{children}</div>
    </div>
  </div>;
}
