-- Historical observations table
CREATE TABLE IF NOT EXISTS observations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  station_id TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  temperature REAL,
  humidity REAL,
  wind_speed REAL,
  wind_gust REAL,
  wind_direction INTEGER,
  pressure REAL,
  rain_rate REAL,
  rain_total REAL,
  uv REAL,
  solar_radiation REAL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(station_id, timestamp)
);

CREATE INDEX IF NOT EXISTS idx_observations_station_time
  ON observations(station_id, timestamp);

-- Daily summaries for range queries
CREATE TABLE IF NOT EXISTS daily_summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  station_id TEXT NOT NULL,
  date TEXT NOT NULL,
  temp_high REAL,
  temp_low REAL,
  temp_avg REAL,
  humidity_avg REAL,
  wind_max REAL,
  gust_max REAL,
  rain_total REAL,
  pressure_avg REAL,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(station_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_station_date
  ON daily_summaries(station_id, date);
