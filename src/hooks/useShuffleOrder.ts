import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import { buildShuffleSeed, createShuffledIndexOrder } from "../lib/shuffle";

interface UseShuffleOrderOptions {
  isAbortError: (error: unknown) => boolean;
  onComplete: () => void;
  onError: (message: string) => void;
  onStart: () => void;
}

export function useShuffleOrder({
  isAbortError,
  onComplete,
  onError,
  onStart,
}: UseShuffleOrderOptions) {
  const [displayOrder, setDisplayOrder] = useState<Uint32Array | null>(null);
  const [shuffleCount, setShuffleCount] = useState(0);
  const [isShuffling, setIsShuffling] = useState(false);
  const shuffleControllerRef = useRef<AbortController | null>(null);

  const resetShuffle = useCallback(() => {
    shuffleControllerRef.current?.abort();
    shuffleControllerRef.current = null;
    setDisplayOrder(null);
    setShuffleCount(0);
    setIsShuffling(false);
  }, []);

  useEffect(() => {
    return () => {
      shuffleControllerRef.current?.abort();
    };
  }, []);

  const shuffleRows = useCallback(
    (totalRows: number, userSeed: number) => {
      if (totalRows === 0 || isShuffling) {
        return;
      }

      shuffleControllerRef.current?.abort();

      const controller = new AbortController();
      const nextShuffleCount = shuffleCount + 1;
      shuffleControllerRef.current = controller;
      setIsShuffling(true);
      onStart();

      createShuffledIndexOrder(
        totalRows,
        buildShuffleSeed(totalRows, nextShuffleCount, userSeed),
        controller.signal
      )
        .then((nextOrder) => {
          if (controller.signal.aborted) {
            return;
          }

          startTransition(() => {
            setDisplayOrder(nextOrder);
            setShuffleCount(nextShuffleCount);
            onComplete();
          });
        })
        .catch((error: unknown) => {
          if (isAbortError(error)) {
            return;
          }

          onError(
            error instanceof Error
              ? error.message
              : "No se pudieron chocolatear las filas."
          );
        })
        .finally(() => {
          if (shuffleControllerRef.current === controller) {
            shuffleControllerRef.current = null;
          }

          if (!controller.signal.aborted) {
            setIsShuffling(false);
          }
        });
    },
    [isAbortError, isShuffling, onComplete, onError, onStart, shuffleCount]
  );

  return {
    displayOrder,
    shuffleCount,
    isShuffling,
    resetShuffle,
    shuffleRows,
  };
}
