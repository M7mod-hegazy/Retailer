import { QueryClient } from "@tanstack/react-query";

// Shared TanStack Query client. Extracted from App.jsx so non-component code
// (e.g. the error fallback) can clear the cache on recovery without importing
// App and creating a circular dependency.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      // PERF (weak devices): treat data as fresh briefly so remounting a page
      // doesn't refire every query and re-render the tree. Mutations still
      // update instantly via explicit invalidateQueries.
      staleTime: 15 * 1000,
    },
  },
});

export default queryClient;
