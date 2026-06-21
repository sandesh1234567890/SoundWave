import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

// Connection Pool Configuration
const connectionString = process.env.DATABASE_URL;
const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL === '1';

const pool = connectionString
  ? new Pool({ connectionString, ssl: { rejectUnauthorized: false } })
  : new Pool({
      host: isProduction ? 'aws-0-ap-northeast-1.pooler.supabase.com' : (process.env.DB_HOST || 'db.obziwglqklrzsfhpwscm.supabase.co'),
      port: isProduction ? 6543 : parseInt(process.env.DB_PORT || '5432'),
      user: isProduction ? 'postgres.obziwglqklrzsfhpwscm' : (process.env.DB_USER || 'postgres'),
      password: process.env.DB_PASSWORD || 'IN6UIr8IUujht187',
      database: process.env.DB_DATABASE || 'postgres',
      ssl: { rejectUnauthorized: false }
    });



// Initial default seed data
const seedTracks = [
  {
    id: "seed-1",
    title: "Summer Breeze",
    artist: "Lofi Dreamer",
    duration: 145,
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    thumbnail: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&auto=format&fit=crop&q=60",
    source: "upload",
    uploadedBy: "system"
  },
  {
    id: "seed-2",
    title: "Cyberpunk Horizon",
    artist: "Synthwave Rider",
    duration: 172,
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    thumbnail: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&auto=format&fit=crop&q=60",
    source: "upload",
    uploadedBy: "system"
  },
  {
    id: "seed-3",
    title: "Acoustic Journey",
    artist: "Guitar Nomad",
    duration: 218,
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
    thumbnail: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=300&auto=format&fit=crop&q=60",
    source: "upload",
    uploadedBy: "system"
  }
];

const seedPlaylists = [
  {
    id: "seed-playlist-1",
    name: "System Essentials",
    description: "Welcome to SoundWave! Enjoy this curation of royalty-free beats.",
    isPublic: true,
    createdBy: "system",
    creatorName: "SoundWave System",
    trackIds: ["seed-1", "seed-2", "seed-3"]
  }
];

// Initialize Database Tables
export async function initDb() {
  try {
    // 1. Create Users Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(255) PRIMARY KEY,
        username VARCHAR(255) UNIQUE NOT NULL,
        display_name VARCHAR(255),
        password VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'USER',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 2. Create Tracks Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tracks (
        id VARCHAR(255) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        artist VARCHAR(255),
        duration INTEGER,
        url VARCHAR(1024),
        thumbnail VARCHAR(1024),
        source VARCHAR(50),
        youtube_id VARCHAR(50),
        is_public BOOLEAN DEFAULT false,
        uploaded_by VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 3. Create Playlists Table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS playlists (
        id VARCHAR(255) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        is_public BOOLEAN DEFAULT false,
        created_by VARCHAR(255),
        creator_name VARCHAR(255),
        track_ids TEXT[] DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    console.log("Supabase PostgreSQL tables initialized successfully.");

    // Seed default admin user if not exists
    const adminCheck = await pool.query("SELECT * FROM users WHERE role = 'ADMIN' OR username = 'admin' OR username = 'admin@soundwave.com'");
    if (adminCheck.rows.length === 0) {
      await pool.query(`
        INSERT INTO users (id, username, display_name, password, role)
        VALUES ($1, $2, $3, $4, $5)
      `, ['user-admin', 'admin@soundwave.com', 'System Administrator', 'admin123', 'ADMIN']);
      console.log("Seeded default admin account: admin@soundwave.com / admin123");
    }

    // Seed default tracks
    const tracksCheck = await pool.query("SELECT * FROM tracks");
    if (tracksCheck.rows.length === 0) {
      for (const t of seedTracks) {
        await pool.query(`
          INSERT INTO tracks (id, title, artist, duration, url, thumbnail, source, is_public, uploaded_by)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        `, [t.id, t.title, t.artist, t.duration, t.url, t.thumbnail, t.source, true, t.uploadedBy]);
      }
      console.log("Seeded default royalty-free tracks.");
    }

    // Seed default playlists
    const playlistsCheck = await pool.query("SELECT * FROM playlists");
    if (playlistsCheck.rows.length === 0) {
      for (const p of seedPlaylists) {
        await pool.query(`
          INSERT INTO playlists (id, name, description, is_public, created_by, creator_name, track_ids)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [p.id, p.name, p.description, p.isPublic, p.createdBy, p.creatorName, p.trackIds]);
      }
      console.log("Seeded default playlist.");
    }

  } catch (err) {
    console.error("Failed to initialize database tables:", err);
  }
}

// User helper methods
export async function findUserByUsername(username) {
  const res = await pool.query("SELECT * FROM users WHERE LOWER(username) = LOWER($1)", [username]);
  return res.rows[0] || null;
}

export async function findUserById(id) {
  const res = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
  return res.rows[0] || null;
}

export async function createUser(user) {
  const { id, username, displayName, password, role = 'USER' } = user;
  await pool.query(`
    INSERT INTO users (id, username, display_name, password, role)
    VALUES ($1, $2, $3, $4, $5)
  `, [id, username, displayName, password, role]);
  return user;
}

// Track helper methods
export async function findTrackById(id) {
  const res = await pool.query("SELECT * FROM tracks WHERE id = $1", [id]);
  if (res.rows[0]) {
    return mapTrackFromDb(res.rows[0]);
  }
  return null;
}

export async function addTrack(track) {
  const { id, title, artist, duration, url, thumbnail, source, youtubeId = null, isPublic = false, uploadedBy } = track;
  await pool.query(`
    INSERT INTO tracks (id, title, artist, duration, url, thumbnail, source, youtube_id, is_public, uploaded_by)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
  `, [id, title, artist, duration, url, thumbnail, source, youtubeId, isPublic, uploadedBy]);
  return track;
}

export async function getTracks() {
  const res = await pool.query("SELECT * FROM tracks ORDER BY created_at DESC");
  return res.rows.map(mapTrackFromDb);
}

export async function deleteTrack(trackId) {
  const res = await pool.query("DELETE FROM tracks WHERE id = $1", [trackId]);
  if (res.rowCount > 0) {
    // Remove track from all playlists
    await pool.query(`
      UPDATE playlists
      SET track_ids = array_remove(track_ids, $1)
    `, [trackId]);
    return true;
  }
  return false;
}

// Playlist helper methods
export async function findPlaylistById(id) {
  const res = await pool.query("SELECT * FROM playlists WHERE id = $1", [id]);
  if (res.rows[0]) {
    return mapPlaylistFromDb(res.rows[0]);
  }
  return null;
}

export async function addPlaylist(playlist) {
  const { id, name, description, isPublic = true, createdBy, creatorName, trackIds = [] } = playlist;
  await pool.query(`
    INSERT INTO playlists (id, name, description, is_public, created_by, creator_name, track_ids)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
  `, [id, name, description, isPublic, createdBy, creatorName, trackIds]);
  return playlist;
}

export async function getPlaylists() {
  const res = await pool.query("SELECT * FROM playlists ORDER BY created_at DESC");
  return res.rows.map(mapPlaylistFromDb);
}

export async function updatePlaylist(playlistId, updatedFields) {
  const keys = Object.keys(updatedFields);
  if (keys.length === 0) return null;
  
  const setClauses = [];
  const values = [];
  let index = 1;
  
  for (const key of keys) {
    let columnName = key;
    if (key === 'isPublic') columnName = 'is_public';
    if (key === 'trackIds') columnName = 'track_ids';
    
    setClauses.push(`${columnName} = $${index}`);
    values.push(updatedFields[key]);
    index++;
  }
  
  values.push(playlistId);
  await pool.query(`
    UPDATE playlists 
    SET ${setClauses.join(', ')} 
    WHERE id = $${index}
  `, values);
  
  return await findPlaylistById(playlistId);
}

export async function deletePlaylist(playlistId) {
  const res = await pool.query("DELETE FROM playlists WHERE id = $1", [playlistId]);
  return res.rowCount > 0;
}

// Admin helper methods
export async function getAllUsers() {
  const res = await pool.query("SELECT id, username, display_name, password, role, created_at FROM users ORDER BY created_at DESC");
  return res.rows.map(row => ({
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    password: row.password, // bcrypt hash
    role: row.role,
    createdAt: row.created_at
  }));
}

export async function deleteUser(userId) {
  const res = await pool.query("DELETE FROM users WHERE id = $1", [userId]);
  if (res.rowCount > 0) {
    // Delete tracks uploaded by user
    await pool.query("DELETE FROM tracks WHERE uploaded_by = $1", [userId]);
    // Delete playlists created by user
    await pool.query("DELETE FROM playlists WHERE created_by = $1", [userId]);
    return true;
  }
  return false;
}

// Mappers
function mapTrackFromDb(row) {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    duration: row.duration,
    url: row.url,
    thumbnail: row.thumbnail,
    source: row.source,
    youtubeId: row.youtube_id,
    isPublic: row.is_public,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at
  };
}

function mapPlaylistFromDb(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isPublic: row.is_public,
    createdBy: row.created_by,
    creatorName: row.creator_name,
    trackIds: row.track_ids || [],
    createdAt: row.created_at
  };
}
