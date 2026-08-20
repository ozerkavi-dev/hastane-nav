import { useRef, useState, useEffect, useCallback } from 'react';
import { getProjection, screenToWorld, applyTransform, invertTransform } from './svgProjection';

const MIN_SCALE = 0.4;
const MAX_SCALE = 6;
const IDENTITY = { scale: 1, rotateDeg: 0, tx: 0, ty: 0 };

function clampScale(s) {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));
}

function angleBetweenDeg(p1, p2) {
  return (Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180) / Math.PI;
}

function distanceBetween(p1, p2) {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

/**
 * Tek parmak: pan. İki parmak: pinch-zoom + rotate, ikisi de doğru merkezden
 * (parmakların ortasından) çalışır — o an parmakların altındaki içerik
 * noktası, parmaklar hareket etse bile hep aynı ekran noktasında kalır.
 *
 * viewBox: {minX, minY, width, height} — kata göre sabit, dıştaki <svg>'nin
 * viewBox'ı ile aynı olmalı. onDoubleTap: çift dokunmada çağrılır (genelde
 * "konuma göre ortala" için kullanılır).
 */
export function usePanZoom({ viewBox, onDoubleTap }) {
  const containerRef = useRef(null);
  const [transform, setTransformState] = useState(IDENTITY);

  const transformRef = useRef(transform);
  const viewBoxRef = useRef(viewBox);
  viewBoxRef.current = viewBox;

  // Her pointermove'da React state güncellemesi yerine, bir sonraki
  // animasyon karesine kadar bekletip tek seferde uyguluyoruz — parmakla
  // sürüklerken/pinch yaparken daha akıcı olsun diye.
  const pendingRef = useRef(null);
  const rafRef = useRef(null);

  const flush = useCallback(() => {
    rafRef.current = null;
    if (pendingRef.current) {
      transformRef.current = pendingRef.current;
      setTransformState(pendingRef.current);
      pendingRef.current = null;
    }
  }, []);

  const scheduleUpdate = useCallback(
    (next) => {
      pendingRef.current = next;
      if (rafRef.current == null) {
        rafRef.current = requestAnimationFrame(flush);
      }
    },
    [flush]
  );

  // Programatik/anlık set (örn. "konuma göre ortala") — rAF beklemeden hemen uygular.
  const setTransform = useCallback((next) => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    pendingRef.current = null;
    transformRef.current = next;
    setTransformState(next);
  }, []);

  const pointers = useRef(new Map());
  const gesture = useRef(null);
  const lastTapRef = useRef(0);

  // onDoubleTap her render'da yeni bir fonksiyon referansı olabilir; hook'un
  // event listener'larını yeniden bağlamasına gerek kalmadan hep en güncel
  // callback'i çağırmak için bir ref üzerinden dolaylı çağırıyoruz.
  const onDoubleTapRef = useRef(onDoubleTap);
  onDoubleTapRef.current = onDoubleTap;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    function getProj() {
      const rect = el.getBoundingClientRect();
      return getProjection(viewBoxRef.current, rect);
    }

    function localPoint(e) {
      const rect = el.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function startPan() {
      const [p] = pointers.current.values();
      gesture.current = {
        type: 'pan',
        startScreen: p,
        startTransform: transformRef.current,
        proj: getProj(),
      };
    }

    function startPinch() {
      const pts = Array.from(pointers.current.values());
      const proj = getProj();
      const midScreen = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      const midWorld = screenToWorld(proj, midScreen);
      // Parmakların şu an tam olarak hangi içerik noktasının üstünde
      // olduğunu buluyoruz — gesture boyunca bu nokta parmaklara "yapışık" kalacak.
      const anchorContent = invertTransform(transformRef.current, midWorld);

      gesture.current = {
        type: 'pinch',
        proj,
        anchorContent,
        startDistance: distanceBetween(pts[0], pts[1]),
        startAngle: angleBetweenDeg(pts[0], pts[1]),
        startScale: transformRef.current.scale,
        startRotate: transformRef.current.rotateDeg,
      };
    }

    function onPointerDown(e) {
      el.setPointerCapture(e.pointerId);
      pointers.current.set(e.pointerId, localPoint(e));

      if (pointers.current.size === 1) startPan();
      else if (pointers.current.size === 2) startPinch();
    }

    function onPointerMove(e) {
      if (!pointers.current.has(e.pointerId)) return;
      pointers.current.set(e.pointerId, localPoint(e));

      const g = gesture.current;
      if (!g) return;

      if (g.type === 'pan' && pointers.current.size === 1) {
        const [p] = pointers.current.values();
        const dxScreen = p.x - g.startScreen.x;
        const dyScreen = p.y - g.startScreen.y;
        // Ekran pikseli -> world birimi dönüşümü (proj.k ile bölünerek)
        scheduleUpdate({
          ...g.startTransform,
          tx: g.startTransform.tx + dxScreen / g.proj.k,
          ty: g.startTransform.ty + dyScreen / g.proj.k,
        });
      } else if (g.type === 'pinch' && pointers.current.size === 2) {
        const pts = Array.from(pointers.current.values());
        const dist = distanceBetween(pts[0], pts[1]);
        const angle = angleBetweenDeg(pts[0], pts[1]);
        const midScreen = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
        const midWorld = screenToWorld(g.proj, midScreen);

        const newScale = clampScale(g.startScale * (dist / g.startDistance));
        const newRotate = g.startRotate + (angle - g.startAngle);

        // anchorContent'i yeni scale/rotate ile "geçici" olarak dönüştürüp,
        // sonucu şu anki parmak-ortası ekran noktasına denk getirecek
        // tx/ty'yi geriye doğru çözüyoruz.
        const rotated = applyTransform(
          { scale: newScale, rotateDeg: newRotate, tx: 0, ty: 0 },
          g.anchorContent
        );

        scheduleUpdate({
          scale: newScale,
          rotateDeg: newRotate,
          tx: midWorld.x - rotated.x,
          ty: midWorld.y - rotated.y,
        });
      }
    }

    function onPointerUp(e) {
      pointers.current.delete(e.pointerId);

      if (pointers.current.size === 0) {
        gesture.current = null;

        const now = Date.now();
        if (now - lastTapRef.current < 300) {
          onDoubleTapRef.current && onDoubleTapRef.current();
        }
        lastTapRef.current = now;
      } else if (pointers.current.size === 1) {
        // İki parmaktan biri kalktı, kalan parmakla pan'a devam
        startPan();
      }
    }

    function onWheel(e) {
      // Masaüstünde fare tekerleği — imlecin altındaki noktayı sabit tutarak zoom
      e.preventDefault();
      const proj = getProj();
      const screenPoint = localPoint(e);
      const worldPoint = screenToWorld(proj, screenPoint);
      const anchorContent = invertTransform(transformRef.current, worldPoint);

      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = clampScale(transformRef.current.scale * factor);

      const rotated = applyTransform(
        { scale: newScale, rotateDeg: transformRef.current.rotateDeg, tx: 0, ty: 0 },
        anchorContent
      );

      setTransform({
        scale: newScale,
        rotateDeg: transformRef.current.rotateDeg,
        tx: worldPoint.x - rotated.x,
        ty: worldPoint.y - rotated.y,
      });
    }

    el.addEventListener('pointerdown', onPointerDown);
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerup', onPointerUp);
    el.addEventListener('pointercancel', onPointerUp);
    el.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      el.removeEventListener('pointerdown', onPointerDown);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointercancel', onPointerUp);
      el.removeEventListener('wheel', onWheel);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [scheduleUpdate, setTransform]);

  return { containerRef, transform, setTransform };
}
