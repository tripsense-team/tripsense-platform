"use client";

import * as React from "react";
import type {
  OpenPlaceDetailTarget,
  PlaceMentionTarget,
} from "./chat-place-resolver";

/**
 * Shared context connecting AI message text links, `ItineraryPreview`, and
 * `PlaceCards` to ChatShell's right-side `PlaceDetailOverlay` drawer without
 * destabilizing `Streamdown` or `PreviewMessage` memo comparators.
 */
export interface PlaceDetailActionContextValue {
  openPlaceDetail: ((target: OpenPlaceDetailTarget) => void) | null;
  placeMentionTargets: ReadonlyArray<PlaceMentionTarget>;
  excludedPlaceNames: ReadonlyArray<string>;
}

const DEFAULT_CONTEXT_VALUE: PlaceDetailActionContextValue = {
  openPlaceDetail: null,
  placeMentionTargets: [],
  excludedPlaceNames: [],
};

const PlaceDetailActionContext =
  React.createContext<PlaceDetailActionContextValue>(DEFAULT_CONTEXT_VALUE);

export function PlaceDetailActionProvider({
  openPlaceDetail,
  placeMentionTargets,
  excludedPlaceNames,
  children,
}: {
  openPlaceDetail?: ((target: OpenPlaceDetailTarget) => void) | null;
  placeMentionTargets?: ReadonlyArray<PlaceMentionTarget>;
  excludedPlaceNames?: ReadonlyArray<string>;
  children?: React.ReactNode;
}) {
  const openRef = React.useRef(openPlaceDetail);
  React.useEffect(() => {
    openRef.current = openPlaceDetail;
  }, [openPlaceDetail]);

  const stableOpenPlaceDetail = React.useCallback(
    (target: OpenPlaceDetailTarget) => {
      openRef.current?.(target);
    },
    [],
  );

  const hasHandler = Boolean(openPlaceDetail);

  const value = React.useMemo<PlaceDetailActionContextValue>(
    () => ({
      openPlaceDetail: hasHandler ? stableOpenPlaceDetail : null,
      placeMentionTargets: placeMentionTargets ?? DEFAULT_CONTEXT_VALUE.placeMentionTargets,
      excludedPlaceNames: excludedPlaceNames ?? DEFAULT_CONTEXT_VALUE.excludedPlaceNames,
    }),
    [hasHandler, stableOpenPlaceDetail, placeMentionTargets, excludedPlaceNames],
  );

  return (
    <PlaceDetailActionContext.Provider value={value}>
      {children}
    </PlaceDetailActionContext.Provider>
  );
}

/**
 * Returns the nearest place-detail drawer action context, or safe null defaults
 * when rendered standalone outside `Messages` / `ChatShell`.
 */
export function usePlaceDetailAction(): PlaceDetailActionContextValue {
  return React.useContext(PlaceDetailActionContext);
}
