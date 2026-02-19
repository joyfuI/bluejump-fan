import type { RefObject } from 'react';
import { useEffect, useState } from 'react';

/**
 * IntersectionObserver 훅. Element가 뷰포트에 들어왔는지 감시
 * @param ref 감시할 Element Ref
 * @param options IntersectionObserver 옵션
 * @returns Element가 뷰포트에 들어왔는지 여부
 */
const useIntersectionObserver = (
  ref: RefObject<Element | null>,
  options?: IntersectionObserverInit,
) => {
  const [isIntersecting, setIsIntersecting] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      setIsIntersecting(entry.isIntersecting);
    }, options);
    const dom = ref.current;

    if (dom) {
      observer.observe(dom);
    }

    return () => {
      if (dom) {
        observer.unobserve(dom);
      }
    };
  }, [ref, options]);

  return isIntersecting;
};

export default useIntersectionObserver;
