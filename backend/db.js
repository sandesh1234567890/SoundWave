import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DB_FILE = path.join(__dirname, 'db.json');

// Initial default data structure
const defaultData = {
  users: [],
  playlists: [],
  tracks: []
};

// Seed tracks (royalty-free music from public URLs for instant demo play)
const seedTracks = [
  {
    id: "seed-1",
    title: "Summer Breeze",
    artist: "Lofi Dreamer",
    duration: 145, // in seconds
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    thumbnail: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=300&auto=format&fit=crop&q=60",
    source: "upload",
    uploadedBy: "system",
    createdAt: new Date().toISOString()
  },
  {
    id: "seed-2",
    title: "Cyberpunk Horizon",
    artist: "Synthwave Rider",
    duration: 172,
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    thumbnail: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=300&auto=format&fit=crop&q=60",
    source: "upload",
    uploadedBy: "system",
    createdAt: new Date().toISOString()
  },
  {
    id: "seed-3",
    title: "Acoustic Journey",
    artist: "Guitar Nomad",
    duration: 218,
    url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
    thumbnail: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=300&auto=format&fit=crop&q=60",
    source: "upload",
    uploadedBy: "system",
    createdAt: new Date().toISOString()
  }
];

// Seed playlists
const seedPlaylists = [
  {
    id: "seed-playlist-1",
    name: "System Essentials",
    description: "Welcome to SoundWave! Enjoy this curation of royalty-free beats.",
    isPublic: true,
    createdBy: "system",
    creatorName: "SoundWave System",
    trackIds: ["seed-1", "seed-2", "seed-3"],
    createdAt: new Date().toISOString()
  }
];

export function initDb() {
  if (!fs.existsSync(DB_FILE)) {
    const data = {
      ...defaultData,
      tracks: seedTracks,
      playlists: seedPlaylists
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } else {
    // Verify file is valid JSON
    try {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      // Ensure key arrays exist
      if (!parsed.users) parsed.users = [];
      if (!parsed.playlists) parsed.playlists = [];
      if (!parsed.tracks) parsed.tracks = [];
      
      // Ensure seed tracks and playlists exist if empty
      if (parsed.tracks.length === 0) {
        parsed.tracks = seedTracks;
      }
      if (parsed.playlists.length === 0) {
        parsed.playlists = seedPlaylists;
      }
      fs.writeFileSync(DB_FILE, JSON.stringify(parsed, null, 2), 'utf-8');
    } catch (err) {
      console.error("Failed to parse db.json, recreating", err);
      const data = {
        ...defaultData,
        tracks: seedTracks,
        playlists: seedPlaylists
      };
      fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    }
  }
}

export function readDb() {
  try {
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error("Read DB Error, returning empty defaults:", err);
    return { users: [], playlists: [], tracks: [] };
  }
}

export function writeDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error("Write DB Error:", err);
    return false;
  }
}

// User helper methods
export function findUserByUsername(username) {
  const db = readDb();
  return db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
}

export function findUserById(id) {
  const db = readDb();
  return db.users.find(u => u.id === id);
}

export function createUser(user) {
  const db = readDb();
  db.users.push(user);
  writeDb(db);
  return user;
}

// Track helpers
export function addTrack(track) {
  const db = readDb();
  db.tracks.push(track);
  writeDb(db);
  return track;
}

export function getTracks() {
  const db = readDb();
  return db.tracks;
}

// Playlist helpers
export function addPlaylist(playlist) {
  const db = readDb();
  db.playlists.push(playlist);
  writeDb(db);
  return playlist;
}

export function getPlaylists() {
  const db = readDb();
  return db.playlists;
}

export function updatePlaylist(playlistId, updatedFields) {
  const db = readDb();
  const index = db.playlists.findIndex(p => p.id === playlistId);
  if (index !== -1) {
    db.playlists[index] = { ...db.playlists[index], ...updatedFields };
    writeDb(db);
    return db.playlists[index];
  }
  return null;
}

export function deletePlaylist(playlistId) {
  const db = readDb();
  const index = db.playlists.findIndex(p => p.id === playlistId);
  if (index !== -1) {
    db.playlists.splice(index, 1);
    writeDb(db);
    return true;
  }
  return false;
}

export function deleteTrack(trackId) {
  const db = readDb();
  const index = db.tracks.findIndex(t => t.id === trackId);
  if (index !== -1) {
    db.tracks.splice(index, 1);
    
    // Also remove this track from all playlists
    db.playlists.forEach(pl => {
      pl.trackIds = pl.trackIds.filter(tid => tid !== trackId);
    });
    
    writeDb(db);
    return true;
  }
  return false;
}

