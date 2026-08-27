import React, { useMemo } from 'react';
import { Polyline } from 'react-leaflet';
import { Voronoi } from 'd3-delaunay';
import { City } from '../../types';
import L from "leaflet";

interface VoronoiBordersProps {
    voronoi: Voronoi<[number, number]>;
    cities: City[];
    mapImageBounds: [[number, number], [number, number]];
}

type Point = [number, number];

/**
 * Builds an order-independent key for an undirected edge. Both cells sharing an
 * edge emit the exact same circumcenter coordinates, so plain string keys match.
 */
const edgeKey = (a: Point, b: Point) =>
    a[0] < b[0] || (a[0] === b[0] && a[1] <= b[1])
        ? `${a[0]},${a[1]}|${b[0]},${b[1]}`
        : `${b[0]},${b[1]}|${a[0]},${a[1]}`;

const VoronoiBorders: React.FC<VoronoiBordersProps> = ({ voronoi, cities, mapImageBounds }) => {
    const borders = useMemo(() => {
        if (!voronoi) return [];

        // Bucket every cell edge by its key in a single pass. An edge listed by
        // two cells is a real border between them; an edge listed by only one
        // cell lies on the clipping box (the map outline), not between nations.
        //
        // This replaces a nested scan that re-derived each edge's neighbour by
        // comparing it against every other cell's every edge — O(N^2 * E^2),
        // ~150k cellPolygon() calls and ~77ms for 270 cities, re-run on every
        // delta update from the game server.
        const edges = new Map<string, { a: Point; b: Point; owners: number[] }>();

        for (let i = 0; i < cities.length; i++) {
            const cell = voronoi.cellPolygon(i);
            if (!cell) continue;

            for (let j = 0; j < cell.length - 1; j++) {
                const a = cell[j] as Point;
                const b = cell[j + 1] as Point;
                const key = edgeKey(a, b);

                const existing = edges.get(key);
                if (existing) existing.owners.push(i);
                else edges.set(key, { a, b, owners: [i] });
            }
        }

        const lines: {
            id: string;
            positions: [number, number][];
            weight: number;
            color: string;
            opacity: number;
        }[] = [];

        for (const { a, b, owners } of edges.values()) {
            // Single owner => map outline rather than a border between two
            // nations. The old code failed to find a neighbour for these and
            // drew them as thick white national borders around the map edge.
            if (owners.length < 2) continue;

            const nation1 = cities[owners[0]]?.control_nation?.id;
            const nation2 = cities[owners[1]]?.control_nation?.id;
            const isExternal = nation1 !== nation2;

            // Leaflet coordinates are [y, x]
            lines.push({
                id: `border-${lines.length}`,
                positions: [
                    [mapImageBounds[1][0] - a[1], a[0]],
                    [mapImageBounds[1][0] - b[1], b[0]],
                ],
                weight: isExternal ? 2.5 : 0.5,
                color: isExternal ? '#FFFFFF' : '#000000',
                opacity: isExternal ? 0.6 : 0.3,
            });
        }

        return lines;
    }, [voronoi, cities, mapImageBounds]);

    return (
        <>
            {borders.map(border => (
                <Polyline
                    key={border.id}
                    positions={border.positions as L.LatLngExpression[]}
                    pathOptions={{
                        color: border.color,
                        weight: border.weight,
                        opacity: border.opacity,
                        lineCap: 'round',
                        lineJoin: 'round',
                    }}
                />
            ))}
        </>
    );
};

export default VoronoiBorders;
