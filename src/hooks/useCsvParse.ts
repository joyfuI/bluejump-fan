import Papa from 'papaparse';
import { useEffect, useMemo, useState } from 'react';

const useCsvParse = <T>(
  filePath: string,
  config?: Papa.ParseRemoteConfig<T>,
) => {
  const [results, setResults] = useState<Papa.ParseResult<T>>({
    data: [],
    errors: [],
    meta: {
      delimiter: '',
      linebreak: '',
      aborted: false,
      truncated: false,
      cursor: 0,
    },
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    Papa.parse<T>(`${location.origin}${filePath}`, {
      download: true,
      header: true,
      dynamicTyping: false,
      worker: true,
      skipEmptyLines: true,
      ...config,
      complete: (results) => {
        setResults(results);
        setIsLoading(false);
      },
    });
  }, [filePath, config]);

  return useMemo(() => ({ isLoading, ...results }), [isLoading, results]);
};

export default useCsvParse;
