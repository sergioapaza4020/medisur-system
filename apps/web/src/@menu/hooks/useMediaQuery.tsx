'use client';

// React Imports
import { useCallback, useSyncExternalStore } from 'react';

const useMediaQuery = (breakpoint?: string): boolean => {
  const subscribe = useCallback(
    (listener: () => void) => {
      if (breakpoint && breakpoint !== 'always') {
        const media = window.matchMedia(`(max-width: ${breakpoint})`);

        media.addEventListener('change', listener);
        return () => media.removeEventListener('change', listener);
      }
      return () => {};
    },
    [breakpoint],
  );

  const getSnapshot = () =>
    breakpoint === 'always' || Boolean(breakpoint && window.matchMedia(`(max-width: ${breakpoint})`).matches);

  return useSyncExternalStore(subscribe, getSnapshot, () => breakpoint === 'always');
};

export default useMediaQuery;
