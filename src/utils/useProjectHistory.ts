import { useState, useCallback, useRef } from 'react';
import type { VisualStackProject } from '../types/project';

const MAX_HISTORY_LENGTH = 35;

export function useProjectHistory(initialProject: VisualStackProject) {
  const [project, setProjectInternal] = useState<VisualStackProject>(initialProject);
  const [past, setPast] = useState<VisualStackProject[]>([]);
  const [future, setFuture] = useState<VisualStackProject[]>([]);

  const lastSnapshotRef = useRef<string>(JSON.stringify(initialProject));
  const debounceTimerRef = useRef<number | null>(null);

  const updateProject = useCallback((updater: (prev: VisualStackProject) => VisualStackProject) => {
    setProjectInternal((current) => {
      const next = updater(current);
      const nextStr = JSON.stringify(next);

      // Avoid duplicate history entries
      if (nextStr === lastSnapshotRef.current) {
        return current;
      }

      // Debounce rapid continuous drags into a single history snapshot
      if (debounceTimerRef.current) {
        window.clearTimeout(debounceTimerRef.current);
      }

      const snapshotBeforeChange = current;

      debounceTimerRef.current = window.setTimeout(() => {
        setPast((prev) => [...prev.slice(-MAX_HISTORY_LENGTH), snapshotBeforeChange]);
        setFuture([]);
        lastSnapshotRef.current = nextStr;
      }, 200);

      return next;
    });
  }, []);

  const undo = useCallback(() => {
    setPast((prevPast) => {
      if (prevPast.length === 0) return prevPast;
      const previousState = prevPast[prevPast.length - 1];
      const newPast = prevPast.slice(0, prevPast.length - 1);

      setProjectInternal((current) => {
        setFuture((prevFuture) => [current, ...prevFuture]);
        lastSnapshotRef.current = JSON.stringify(previousState);
        return previousState;
      });

      return newPast;
    });
  }, []);

  const redo = useCallback(() => {
    setFuture((prevFuture) => {
      if (prevFuture.length === 0) return prevFuture;
      const nextState = prevFuture[0];
      const newFuture = prevFuture.slice(1);

      setProjectInternal((current) => {
        setPast((prevPast) => [...prevPast, current]);
        lastSnapshotRef.current = JSON.stringify(nextState);
        return nextState;
      });

      return newFuture;
    });
  }, []);

  return {
    project,
    updateProject,
    setProjectDirect: (p: VisualStackProject) => {
      setProjectInternal(p);
      lastSnapshotRef.current = JSON.stringify(p);
      setPast([]);
      setFuture([]);
    },
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0
  };
}