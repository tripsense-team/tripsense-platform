import { QueryClient, isServer } from "@tanstack/react-query";

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000, // Data remains fresh for 1 minute
        gcTime: 5 * 60 * 1000, // Garbage collection cache kept for 5 minutes
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined = undefined;

export function getQueryClient(): QueryClient {
  if (isServer) {
    // Server: always make a new query client
    return makeQueryClient();
  }
  // Browser: make a new query client if we don't already have one
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}

export const tripQueryKeys = {
  all: ["trips"] as const,
  userTrips: () => [...tripQueryKeys.all, "user"] as const,
  detail: (tripId: string) => [...tripQueryKeys.all, "detail", tripId] as const,
};
