import type { Plant } from '../types/plant.js';

type SeedPlant = Omit<Plant, 'id' | 'priceHistory' | 'bestBid' | 'bestAsk' | 'prevDayClose'>;

export const INITIAL_PLANTS: SeedPlant[] = [
  // Original 8
  { name: 'Jasmine',        ticker: 'JSM', currentPrice: 12, totalSupply: 10000 },
  { name: 'Saffron',        ticker: 'SFR', currentPrice: 95, totalSupply: 2000  },
  { name: 'Vanilla',        ticker: 'VNL', currentPrice: 45, totalSupply: 5000  },
  { name: 'Lotus',          ticker: 'LTS', currentPrice: 22, totalSupply: 8000  },
  { name: 'Lavender',       ticker: 'LVD', currentPrice: 9,  totalSupply: 15000 },
  { name: 'Ginseng',        ticker: 'GNG', currentPrice: 60, totalSupply: 3000  },
  { name: 'Orchid',         ticker: 'ORC', currentPrice: 35, totalSupply: 6000  },
  { name: 'Turmeric',       ticker: 'TRM', currentPrice: 5,  totalSupply: 20000 },
  // New 12
  { name: 'Marigold',       ticker: 'MRG', currentPrice: 3,  totalSupply: 28000 },
  { name: 'Hibiscus',       ticker: 'HBS', currentPrice: 8,  totalSupply: 18000 },
  { name: 'Azalea',         ticker: 'AZL', currentPrice: 14, totalSupply: 11000 },
  { name: 'Gardenia',       ticker: 'GDN', currentPrice: 17, totalSupply: 9000  },
  { name: 'Rose',           ticker: 'ROS', currentPrice: 19, totalSupply: 8500  },
  { name: 'Satsuki',        ticker: 'SAT', currentPrice: 21, totalSupply: 7500  },
  { name: 'Chrysanthemum',  ticker: 'CHR', currentPrice: 26, totalSupply: 7000  },
  { name: 'Camellia',       ticker: 'CAM', currentPrice: 29, totalSupply: 6000  },
  { name: 'Wisteria',       ticker: 'WST', currentPrice: 33, totalSupply: 5500  },
  { name: 'Dahlia',         ticker: 'DHL', currentPrice: 40, totalSupply: 4500  },
  { name: 'Magnolia',       ticker: 'MGL', currentPrice: 50, totalSupply: 4000  },
  { name: 'Peony',          ticker: 'PNY', currentPrice: 58, totalSupply: 3200  },
];
