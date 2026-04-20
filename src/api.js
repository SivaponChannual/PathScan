const BASE = '/rain-api/v2';

async function get(path) {
  const res = await fetch(BASE + path);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export const fetchBasins            = ()          => get('/basins');
export const fetchBasin             = (id)        => get(`/basins/${id}`);
export const fetchStations          = (basinId)   => get(`/basins/${basinId}/stations`);
export const fetchAllRainfalls      = (basinId)   => get(`/basins/${basinId}/allAnnualRainfalls`);
export const fetchRainfallByYear    = (basinId, year) => get(`/basins/${basinId}/annualRainfalls/${year}`);
