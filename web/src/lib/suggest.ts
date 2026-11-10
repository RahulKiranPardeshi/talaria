// What the type-ahead fields offer as you type.

import { searchPlaces } from '@shared/places';
import type { Option } from '@/components/ui';

/** Continents, regions, countries and cities, forgiving typos ("netherlnds" finds the Netherlands). */
export const placeOptions = (q: string): Option[] => searchPlaces(q).map(p => ({ value: p.name, hint: p.hint }));

/** Countries and regions only, for fields that ask where in the world rather than which city. */
export const countryOptions = (q: string): Option[] =>
  searchPlaces(q, 12)
    .filter(p => p.kind !== 'city')
    .slice(0, 8)
    .map(p => ({ value: p.name, hint: p.hint }));
