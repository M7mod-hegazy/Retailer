import { QueryClient } from "@tanstack/react-query";

// Shared TanStack Query client. Extracted from App.jsx so non-component code
// (e.g. the error fallback) can clear the cache on recovery without importing
// App and creating a circular dependency.
export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

export default queryClient;
