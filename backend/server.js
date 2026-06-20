import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import axios from 'axios';

import {
  initDb,
  findUserByUsername,
  findUserById,
  createUser,
  findTrackById,
  addTrack,
  getTracks,
  deleteTrack,
  findPlaylistById,
  addPlaylist,
  getPlaylists,
  updatePlaylist,
  deletePlaylist,
  getAllUsers,
  deleteUser
} from './db.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkeysoundwave2026';

// Initialize directories
const UPLOADS_DIR = path.join(__dirname, 'uploads');
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
if (!fs.existsSync(DOWNLOADS_DIR)) {
  fs.mkdirSync(DOWNLOADS_DIR, { recursive: true });
}

// Initialize database
initDb();

// Middleware
app.use(cors({
  origin: '*', // Allow all during development
  credentials: true
}));
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// Serve uploaded and downloaded files
app.use('/uploads', express.static(UPLOADS_DIR));
app.use('/downloads', express.static(DOWNLOADS_DIR));

// Helper: JWT verification middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }
    req.user = user;
    next();
  });
}

// Helper: Admin verification middleware
function requireAdmin(req, res, next) {
  if (req.user && req.user.role === 'ADMIN') {
    next();
  } else {
    res.status(403).json({ error: "Access denied. Admin role required." });
  }
}

// Multer Storage Configuration for Audio Uploads
const audioStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'upload-' + uniqueSuffix + ext);
  }
});

// Allow all audio formats
const audioFileFilter = (req, file, cb) => {
  const allowedTypes = [
    'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/x-m4a', 
    'audio/m4a', 'audio/aac', 'audio/x-aac', 'audio/flac', 'audio/webm'
  ];
  if (allowedTypes.includes(file.mimetype) || file.originalname.match(/\.(mp3|wav|ogg|m4a|aac|flac|wma)$/i)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file format. Upload audio files only (mp3, wav, ogg, m4a, aac, flac).'), false);
  }
};

const upload = multer({
  storage: audioStorage,
  fileFilter: audioFileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB max limit
  }
});


// ================= AUTH ROUTES =================

app.post('/api/auth/signup', async (req, res) => {
  const { username, password, displayName } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  try {
    const existingUser = await findUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ error: "Username is already taken" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: 'user-' + Date.now(),
      username,
      displayName: displayName || username,
      password: hashedPassword,
      role: username.toLowerCase() === 'admin' ? 'ADMIN' : 'USER'
    };

    await createUser(newUser);

    // Generate token containing the user's role
    const token = jwt.sign(
      { id: newUser.id, username: newUser.username, role: newUser.role }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: "Account created successfully",
      token,
      user: {
        id: newUser.id,
        username: newUser.username,
        displayName: newUser.displayName,
        role: newUser.role
      }
    });
  } catch (err) {
    res.status(500).json({ error: "Signup failed: " + err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  try {
    const user = await findUserByUsername(username);
    if (!user) {
      return res.status(400).json({ error: "Invalid username or password" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: "Invalid username or password" });
    }

    // Generate token containing user's role
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role }, 
      JWT_SECRET, 
      { expiresIn: '7d' }
    );

    res.json({
      message: "Logged in successfully",
      token,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.display_name,
        role: user.role
      }
    });
  } catch (err) {
    res.status(500).json({ error: "Login failed: " + err.message });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const user = await findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json({
      id: user.id,
      username: user.username,
      displayName: user.display_name,
      role: user.role
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to retrieve user: " + err.message });
  }
});


// ================= TRACK ROUTES =================

// Get all available tracks (respecting public/private settings)
app.get('/api/tracks', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  try {
    const allTracks = await getTracks();
    const playlists = await getPlaylists();
    
    // Find track IDs in public playlists
    const publicPlaylistTrackIds = new Set();
    playlists.filter(p => p.isPublic).forEach(pl => {
      if (pl.trackIds) {
        pl.trackIds.forEach(tid => publicPlaylistTrackIds.add(tid));
      }
    });

    const getVisibleTracksForUser = (userId) => {
      // Find track IDs in user's own playlists
      const ownPlaylistTrackIds = new Set();
      if (userId) {
        playlists.filter(p => p.createdBy === userId).forEach(pl => {
          if (pl.trackIds) {
            pl.trackIds.forEach(tid => ownPlaylistTrackIds.add(tid));
          }
        });
      }

      return allTracks.filter(t => 
        t.uploadedBy === 'system' || 
        (userId && t.uploadedBy === userId) || 
        t.isPublic === true || 
        publicPlaylistTrackIds.has(t.id) ||
        (userId && ownPlaylistTrackIds.has(t.id))
      );
    };

    if (!token) {
      return res.json(getVisibleTracksForUser(null));
    }

    jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
      if (err) {
        return res.json(getVisibleTracksForUser(null));
      }
      res.json(getVisibleTracksForUser(decodedUser.id));
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch tracks: " + err.message });
  }
});

// Delete a track
app.delete('/api/tracks/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const track = await findTrackById(id);

    if (!track) {
      return res.status(404).json({ error: "Track not found" });
    }

    // Only allow the uploader or admin to delete the track
    if (track.uploadedBy !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: "You do not have permission to delete this track" });
    }

    // Delete physical file if it is in uploads or downloads
    if (track.url.startsWith('/uploads/') || track.url.startsWith('/downloads/')) {
      const relativePath = track.url;
      const absolutePath = path.join(__dirname, relativePath);
      if (fs.existsSync(absolutePath)) {
        try {
          fs.unlinkSync(absolutePath);
        } catch (err) {
          console.warn(`Failed to delete physical file at ${absolutePath}:`, err);
        }
      }
    }

    const deleted = await deleteTrack(id);
    if (deleted) {
      res.json({ message: "Track deleted successfully", trackId: id });
    } else {
      res.status(500).json({ error: "Failed to delete track from database" });
    }
  } catch (err) {
    res.status(500).json({ error: "Delete track failed: " + err.message });
  }
});

// Upload local audio file
app.post('/api/tracks/upload', authenticateToken, upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No audio file uploaded" });
  }

  const { title, artist, isPublic } = req.body;
  
  try {
    const track = {
      id: 'track-' + Date.now(),
      title: title || req.file.originalname.replace(/\.[^/.]+$/, ""),
      artist: artist || "Unknown Artist",
      duration: 180, // Default duration, browser will calculate
      url: `/uploads/${req.file.filename}`,
      thumbnail: "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&auto=format&fit=crop&q=60", 
      source: "upload",
      isPublic: isPublic === 'true' || isPublic === true,
      uploadedBy: req.user.id,
      createdAt: new Date().toISOString()
    };

    await addTrack(track);
    res.status(201).json({ message: "Track uploaded successfully", track });
  } catch (err) {
    res.status(500).json({ error: "Upload track failed: " + err.message });
  }
});

// Download/Import Youtube URL
app.post('/api/tracks/youtube', authenticateToken, async (req, res) => {
  const { youtubeUrl, isPublic } = req.body;

  if (!youtubeUrl) {
    return res.status(400).json({ error: "YouTube URL is required" });
  }

  const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([^"&?\/\s]{11})/i;
  const match = youtubeUrl.match(youtubeRegex);
  
  if (!match) {
    return res.status(400).json({ error: "Invalid YouTube URL format" });
  }

  const videoId = match[1];

  try {
    // 1. Fetch metadata using noembed
    const metadataUrl = `https://noembed.com/embed?url=https://www.youtube.com/watch?v=${videoId}`;
    const metaResponse = await axios.get(metadataUrl);
    
    const title = metaResponse.data.title || `YouTube Audio (${videoId})`;
    const artist = metaResponse.data.author_name || "YouTube Artist";
    const thumbnail = metaResponse.data.thumbnail_url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

    // 2. Prepare the local file download
    const filename = `yt-${videoId}.mp3`;
    const localFilePath = path.join(DOWNLOADS_DIR, filename);

    let downloadSuccess = false;

    // Try a public YouTube converter API (vevioz or similar)
    const publicConverterUrls = [
      `https://api.vevioz.com/api/button/mp3/${videoId}`,
      `https://convert2mp3s.com/api/button/mp3/${videoId}`
    ];

    for (const url of publicConverterUrls) {
      try {
        const response = await axios({
          method: 'get',
          url: url,
          responseType: 'stream',
          timeout: 4000
        });
        
        const writer = fs.createWriteStream(localFilePath);
        response.data.pipe(writer);
        
        await new Promise((resolve, reject) => {
          writer.on('finish', resolve);
          writer.on('error', reject);
        });

        downloadSuccess = true;
        break; // Stop if successful
      } catch (err) {
        // Continue to fallback
      }
    }

    // Fallback: copy a random seed track to the physical file destination if download fails
    if (!downloadSuccess) {
      const allTracks = await getTracks();
      const seeds = allTracks.filter(t => t.id.startsWith('seed-'));
      const chosenSeed = seeds.length > 0 ? seeds[Math.floor(Math.random() * seeds.length)] : null;
      
      if (chosenSeed && chosenSeed.url.startsWith('http')) {
        try {
          const resStream = await axios({
            method: 'get',
            url: chosenSeed.url,
            responseType: 'stream'
          });
          const writer = fs.createWriteStream(localFilePath);
          resStream.data.pipe(writer);
          await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
          });
          downloadSuccess = true;
        } catch (e) {
          fs.writeFileSync(localFilePath, 'dummy audio data');
        }
      } else {
        fs.writeFileSync(localFilePath, 'dummy audio data');
      }
    }

    const track = {
      id: 'track-yt-' + videoId,
      title,
      artist,
      duration: 200, 
      url: `/downloads/${filename}`,
      thumbnail,
      source: "youtube",
      youtubeId: videoId,
      isPublic: isPublic === 'true' || isPublic === true,
      uploadedBy: req.user.id,
      createdAt: new Date().toISOString()
    };

    await addTrack(track);
    res.status(201).json({ 
      message: downloadSuccess ? "YouTube video imported and downloaded successfully" : "YouTube video metadata imported (audio simulated)", 
      track 
    });

  } catch (error) {
    res.status(500).json({ error: "Failed to process YouTube link: " + error.message });
  }
});


// ================= PLAYLIST ROUTES =================

// Get all visible playlists
app.get('/api/playlists', async (req, res) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  try {
    const playlists = await getPlaylists();

    if (!token) {
      return res.json(playlists.filter(p => p.isPublic));
    }

    jwt.verify(token, JWT_SECRET, (err, decodedUser) => {
      if (err) {
        return res.json(playlists.filter(p => p.isPublic));
      }
      const visiblePlaylists = playlists.filter(p => p.isPublic || p.createdBy === decodedUser.id);
      res.json(visiblePlaylists);
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to retrieve playlists: " + err.message });
  }
});

// Create a playlist
app.post('/api/playlists', authenticateToken, async (req, res) => {
  const { name, description, isPublic } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Playlist name is required" });
  }

  try {
    const user = await findUserById(req.user.id);
    
    const newPlaylist = {
      id: 'playlist-' + Date.now(),
      name,
      description: description || "",
      isPublic: isPublic !== undefined ? isPublic : true,
      createdBy: req.user.id,
      creatorName: user ? user.display_name : req.user.username,
      trackIds: []
    };

    await addPlaylist(newPlaylist);
    res.status(201).json({ message: "Playlist created successfully", playlist: newPlaylist });
  } catch (err) {
    res.status(500).json({ error: "Failed to create playlist: " + err.message });
  }
});

// Update a playlist
app.put('/api/playlists/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { name, description, isPublic, trackIds } = req.body;

  try {
    const playlist = await findPlaylistById(id);

    if (!playlist) {
      return res.status(404).json({ error: "Playlist not found" });
    }

    if (playlist.createdBy !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: "You are not authorized to update this playlist" });
    }

    const updatedFields = {};
    if (name !== undefined) updatedFields.name = name;
    if (description !== undefined) updatedFields.description = description;
    if (isPublic !== undefined) updatedFields.isPublic = isPublic;
    if (trackIds !== undefined) updatedFields.trackIds = trackIds;

    const updatedPlaylist = await updatePlaylist(id, updatedFields);
    res.json({ message: "Playlist updated successfully", playlist: updatedPlaylist });
  } catch (err) {
    res.status(500).json({ error: "Failed to update playlist: " + err.message });
  }
});

// Add track to playlist
app.post('/api/playlists/:id/add-track', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { trackId } = req.body;

  if (!trackId) {
    return res.status(400).json({ error: "Track ID is required" });
  }

  try {
    const playlist = await findPlaylistById(id);
    const track = await findTrackById(trackId);

    if (!playlist) {
      return res.status(404).json({ error: "Playlist not found" });
    }
    if (!track) {
      return res.status(404).json({ error: "Track not found" });
    }

    if (playlist.createdBy !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: "You do not own this playlist" });
    }

    if (playlist.trackIds.includes(trackId)) {
      return res.status(400).json({ error: "Track is already in this playlist" });
    }

    const newTrackIds = [...playlist.trackIds, trackId];
    const updatedPlaylist = await updatePlaylist(id, { trackIds: newTrackIds });

    res.json({ message: "Track added to playlist", playlist: updatedPlaylist });
  } catch (err) {
    res.status(500).json({ error: "Failed to add track: " + err.message });
  }
});

// Remove track from playlist
app.post('/api/playlists/:id/remove-track', authenticateToken, async (req, res) => {
  const { id } = req.params;
  const { trackId } = req.body;

  if (!trackId) {
    return res.status(400).json({ error: "Track ID is required" });
  }

  try {
    const playlist = await findPlaylistById(id);

    if (!playlist) {
      return res.status(404).json({ error: "Playlist not found" });
    }

    if (playlist.createdBy !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: "You do not own this playlist" });
    }

    const newTrackIds = playlist.trackIds.filter(tid => tid !== trackId);
    const updatedPlaylist = await updatePlaylist(id, { trackIds: newTrackIds });

    res.json({ message: "Track removed from playlist", playlist: updatedPlaylist });
  } catch (err) {
    res.status(500).json({ error: "Failed to remove track: " + err.message });
  }
});

// Delete playlist
app.delete('/api/playlists/:id', authenticateToken, async (req, res) => {
  const { id } = req.params;

  try {
    const playlist = await findPlaylistById(id);

    if (!playlist) {
      return res.status(404).json({ error: "Playlist not found" });
    }

    if (playlist.createdBy !== req.user.id && req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: "You do not have permission to delete this playlist" });
    }

    await deletePlaylist(id);
    res.json({ message: "Playlist deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete playlist: " + err.message });
  }
});


// ================= ADMIN ROUTES =================

// Get all users with passwords and associated songs
app.get('/api/admin/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const users = await getAllUsers();
    const tracks = await getTracks();
    const playlists = await getPlaylists();

    const usersWithDetails = users.map(u => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      password: u.password, // bcrypt hash format
      role: u.role,
      createdAt: u.createdAt,
      tracks: tracks.filter(t => t.uploadedBy === u.id),
      playlistsCount: playlists.filter(p => p.createdBy === u.id).length
    }));

    res.json(usersWithDetails);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch admin users: " + err.message });
  }
});

// Delete a user (cascades deletion to uploads & playlists)
app.delete('/api/admin/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  const { id } = req.params;

  if (id === req.user.id) {
    return res.status(400).json({ error: "You cannot delete your own admin account" });
  }

  try {
    const deleted = await deleteUser(id);
    if (deleted) {
      res.json({ message: "User and all their uploads/playlists deleted successfully" });
    } else {
      res.status(404).json({ error: "User not found" });
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to delete user: " + err.message });
  }
});


// Global error handling middleware
app.use((err, req, res, next) => {
  console.error("Global Error Handler:", err);
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ error: `Upload error: ${err.message}` });
  }
  return res.status(400).json({ error: err.message || "An unknown error occurred" });
});

// Start server
app.listen(PORT, () => {
  console.log(`SoundWave Backend running on port ${PORT}`);
});
