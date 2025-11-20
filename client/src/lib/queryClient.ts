import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
    });

    // On 401, clear the auth cache to trigger re-auth check and redirect
    // Skip cache clearing if this IS the auth query to prevent infinite refetch loop
    if (res.status === 401) {
      const isAuthQuery = queryKey[0] === "/api/auth/user";
      
      if (!isAuthQuery) {
        // When any non-auth query returns 401 (session expired), clear the auth cache
        // This triggers useAuth to return isAuthenticated=false, redirecting to login
        // Note: We use setQueryData (not invalidateQueries) to avoid refetch loop
        // Auth cache repopulates after login via full page reload (window.location.href)
        const { queryClient } = await import("./queryClient");
        queryClient.setQueryData(["/api/auth/user"], null);
      }
      
      if (unauthorizedBehavior === "returnNull") {
        return null;
      }
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
