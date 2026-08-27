import { createContext, useContext, useState, useMemo, ReactNode } from 'react';

/**
 * Hover state lives in its own context on purpose.
 *
 * It changes on every mouse move across the map, so keeping it in MapContext
 * meant each hover invalidated the map data context and re-rendered every
 * consumer of it. Isolated here, a hover only re-renders the map layer that
 * actually reads it.
 */
interface HoverState {
    hoveredCityId: number | null;
    highlightedCityIds: Set<number>;
    setHoveredCityId: (id: number | null) => void;
    setHighlightedCityIds: (ids: Set<number>) => void;
}

const HoverContext = createContext<HoverState | undefined>(undefined);

// Shared empty set so clearing the highlight keeps a stable identity.
export const EMPTY_HIGHLIGHT: Set<number> = new Set();

export const HoverProvider = ({ children }: { children: ReactNode }) => {
    const [hoveredCityId, setHoveredCityId] = useState<number | null>(null);
    const [highlightedCityIds, setHighlightedCityIds] = useState<Set<number>>(EMPTY_HIGHLIGHT);

    const value = useMemo(() => ({
        hoveredCityId,
        highlightedCityIds,
        setHoveredCityId,
        setHighlightedCityIds,
    }), [hoveredCityId, highlightedCityIds]);

    return <HoverContext.Provider value={value}>{children}</HoverContext.Provider>;
};

export const useHover = () => {
    const context = useContext(HoverContext);
    if (context === undefined) {
        throw new Error('useHover must be used within a HoverProvider');
    }
    return context;
};
