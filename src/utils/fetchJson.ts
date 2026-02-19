const fetchJson = async <T>(
  input: string | URL | Request,
  init?: RequestInit,
): Promise<T> => {
  const res = await fetch(input, init);
  if (!res.ok) {
    throw new Error(res.statusText, { cause: res });
  }

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new Error(res.statusText, { cause: res });
  }

  return json as T;
};

export default fetchJson;
