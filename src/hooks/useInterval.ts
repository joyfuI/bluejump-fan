import { useEffect, useEffectEvent } from 'react';

/**
 * setInterval 훅. setInterval과 다르게 최초에 callback을 한번 실행하고 반복함
 * @param callback 반복 실행할 함수
 * @param ms ms마다 반복
 */
const useInterval = (callback: () => void, ms: number) => {
  const func = useEffectEvent(callback);

  useEffect(() => {
    const timer = setInterval(func, ms);
    func(); // 즉시 1회 호출
    return () => clearInterval(timer);
  }, [ms]);
};

export default useInterval;
