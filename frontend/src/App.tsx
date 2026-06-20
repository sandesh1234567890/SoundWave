import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Repeat, Shuffle, 
  Search, Plus, Trash2, Music, Globe, Lock, LogOut, LogIn, 
  Upload, ListMusic, X 
} from 'lucide-react';

const YoutubeIcon = ({ size = 24, className = "" }: { size?: number, className?: string }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
    style={{ fill: 'currentColor' }}
  >
    <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
    <polygon points="10 15 15 12 10 9" />
  </svg>
);

// API Base configuration
const API_BASE = (import.meta.env.VITE_API_BASE as string) || "http://localhost:5000/api";
const BACKEND_HOST = (import.meta.env.VITE_BACKEND_HOST as string) || "http://localhost:5000";


interface Track {
  id: string;
  title: string;
  artist: string;
  duration: number;
  url: string;
  thumbnail: string;
  source: 'upload' | 'youtube';
  youtubeId?: string;
  uploadedBy: string;
  createdAt: string;
}

interface Playlist {
  id: string;
  name: string;
  description: string;
  isPublic: boolean;
  createdBy: string;
  creatorName: string;
  trackIds: string[];
  createdAt: string;
}

interface User {
  id: string;
  username: string;
  displayName: string;
}

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

export default function App() {
  // --- Auth State ---
  const [token, setToken] = useState<string | null>(localStorage.getItem('soundwave_token'));
  const [user, setUser] = useState<User | null>(null);
  
  // --- UI Navigation ---
  const [activeTab, setActiveTab] = useState<'home' | 'my-playlists' | 'upload' | 'playlist-detail'>('home');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  
  // --- Data State ---
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  
  // --- Modals and Popovers ---
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'signup'>('login');
  const [createPlaylistOpen, setCreatePlaylistOpen] = useState(false);
  const [addToPlaylistTrackId, setAddToPlaylistTrackId] = useState<string | null>(null);
  
  // --- Form States ---
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  const [signupUsername, setSignupUsername] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupDisplayName, setSignupDisplayName] = useState('');
  
  const [playlistName, setPlaylistName] = useState('');
  const [playlistDesc, setPlaylistDesc] = useState('');
  const [playlistIsPublic, setPlaylistIsPublic] = useState(true);
  
  const [ytUrl, setYtUrl] = useState('');
  const [isImportingYt, setIsImportingYt] = useState(false);
  const [ytIsPublic, setYtIsPublic] = useState(false);
  const [ytPlaylistId, setYtPlaylistId] = useState<string>('none');
  const [ytNewPlaylistName, setYtNewPlaylistName] = useState<string>('');
  
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadArtist, setUploadArtist] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadIsPublic, setUploadIsPublic] = useState(false);
  const [uploadPlaylistId, setUploadPlaylistId] = useState<string>('none');
  const [uploadNewPlaylistName, setUploadNewPlaylistName] = useState<string>('');
  
  // --- Audio Player States ---
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoop, setIsLoop] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [queue, setQueue] = useState<Track[]>([]);
  const [queueIndex, setQueueIndex] = useState(-1);
  const [showQueue, setShowQueue] = useState(false);
  
  // --- System Toast ---
  const [toasts, setToasts] = useState<Toast[]>([]);
  
  // --- Refs ---
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number | null>(null);
  const dragOverRef = useRef<boolean>(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // --- YouTube Player State & References ---
  const ytPlayerRef = useRef<any>(null);
  const [ytReady, setYtReady] = useState(false);

  // --- Show Toast Helper ---
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Close add-to-playlist popover when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setAddToPlaylistTrackId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- YouTube Script & Player Initialization ---
  useEffect(() => {
    (window as any).onYouTubeIframeAPIReady = () => {
      initYoutubePlayer();
    };

    if (!(window as any).YT) {
      const tag = document.createElement('script');
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    } else {
      initYoutubePlayer();
    }

    function initYoutubePlayer() {
      let playerDiv = document.getElementById('youtube-player-container');
      if (!playerDiv) {
        playerDiv = document.createElement('div');
        playerDiv.id = 'youtube-player-container';
        playerDiv.style.position = 'fixed';
        playerDiv.style.bottom = '-1000px';
        playerDiv.style.left = '-1000px';
        playerDiv.style.width = '200px';
        playerDiv.style.height = '200px';
        playerDiv.style.pointerEvents = 'none';
        document.body.appendChild(playerDiv);
      }

      try {
        ytPlayerRef.current = new (window as any).YT.Player('youtube-player-container', {
          height: '200',
          width: '200',
          videoId: '',
          playerVars: {
            playsinline: 1,
            controls: 0,
            disablekb: 1,
            fs: 0,
            rel: 0
          },
          events: {
            onReady: () => {
              setYtReady(true);
            },
            onStateChange: (event: any) => {
              if (event.data === (window as any).YT.PlayerState.ENDED) {
                handleTrackEnded();
              }
            }
          }
        });
      } catch (err) {
        console.warn("Failed to instantiate YT Player:", err);
      }
    }
  }, []);

  // --- Fetch User Info on Mount/Token change ---
  useEffect(() => {
    if (token) {
      fetch(`${API_BASE}/auth/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      .then(res => {
        if (!res.ok) throw new Error();
        return res.json();
      })
      .then(data => {
        setUser(data);
      })
      .catch(() => {
        // Token invalid, clear it
        localStorage.removeItem('soundwave_token');
        setToken(null);
        setUser(null);
      });
    } else {
      setUser(null);
    }
  }, [token]);

  // --- Fetch Playlists & Tracks ---
  const fetchData = async () => {
    try {
      // Fetch Tracks
      const tracksRes = await fetch(`${API_BASE}/tracks`);
      const tracksData = await tracksRes.json();
      setTracks(tracksData);

      // Fetch Playlists (send Auth token if exists to fetch own private playlists)
      const headers: HeadersInit = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      
      const playlistsRes = await fetch(`${API_BASE}/playlists`, { headers });
      const playlistsData = await playlistsRes.json();
      setPlaylists(playlistsData);
    } catch (err) {
      console.error("Failed to load tracks or playlists:", err);
    }
  };

  useEffect(() => {
    fetchData();
  }, [token]);

  // --- Initialize Audio Element ---
  useEffect(() => {
    const audio = new Audio();
    audio.crossOrigin = "anonymous";
    audioRef.current = audio;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => setDuration(audio.duration || 0);
    const onEnded = () => handleTrackEnded();

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('durationchange', onDurationChange);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('durationchange', onDurationChange);
      audio.removeEventListener('ended', onEnded);
      audio.pause();
    };
  }, [queue, queueIndex, isLoop, isShuffle]);

  // --- YouTube Timer Sync ---
  useEffect(() => {
    if (!isPlaying || !currentTrack || currentTrack.source !== 'youtube' || !ytReady || !ytPlayerRef.current) {
      return;
    }

    const interval = setInterval(() => {
      try {
        const ytCurrent = ytPlayerRef.current.getCurrentTime();
        const ytDuration = ytPlayerRef.current.getDuration();
        
        if (typeof ytCurrent === 'number') {
          setCurrentTime(ytCurrent);
        }
        if (typeof ytDuration === 'number' && ytDuration > 0) {
          setDuration(ytDuration);
        }
      } catch (e) {}
    }, 250);

    return () => clearInterval(interval);
  }, [isPlaying, currentTrack, ytReady]);

  // --- Volume / Mute Synchronization ---
  useEffect(() => {
    const targetVol = isMuted ? 0 : volume;
    if (audioRef.current) {
      audioRef.current.volume = targetVol;
    }
    if (ytPlayerRef.current && ytReady) {
      try {
        ytPlayerRef.current.setVolume(targetVol * 100);
      } catch (e) {}
    }
  }, [volume, isMuted, ytReady]);

  // --- Playing Track State Effect ---
  useEffect(() => {
    if (!currentTrack) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
      if (ytPlayerRef.current && ytReady) {
        try {
          ytPlayerRef.current.pauseVideo();
        } catch (e) {}
      }
      return;
    }

    if (currentTrack.source === 'youtube' && currentTrack.youtubeId) {
      // Pause HTML5 audio
      if (audioRef.current) {
        audioRef.current.pause();
      }

      if (ytPlayerRef.current && ytReady) {
        try {
          const loadedVideoId = ytPlayerRef.current.getVideoData?.()?.video_id;
          if (loadedVideoId !== currentTrack.youtubeId) {
            if (isPlaying) {
              ytPlayerRef.current.loadVideoById(currentTrack.youtubeId);
            } else {
              ytPlayerRef.current.cueVideoById(currentTrack.youtubeId);
            }
          } else {
            if (isPlaying) {
              ytPlayerRef.current.playVideo();
            } else {
              ytPlayerRef.current.pauseVideo();
            }
          }
        } catch (e) {
          console.warn("YouTube player control failed:", e);
        }
      }
    } else {
      // Pause YouTube player
      if (ytPlayerRef.current && ytReady) {
        try {
          ytPlayerRef.current.pauseVideo();
        } catch (e) {}
      }

      if (audioRef.current) {
        const targetUrl = currentTrack.url.startsWith('http') 
          ? currentTrack.url 
          : `${BACKEND_HOST}${currentTrack.url}`;

        if (audioRef.current.src !== targetUrl) {
          audioRef.current.src = targetUrl;
          audioRef.current.load();
        }

        if (isPlaying) {
          audioRef.current.play().catch(err => {
            console.warn("Audio play blocked by browser:", err);
            setIsPlaying(false);
          });
        } else {
          audioRef.current.pause();
        }
      }
    }
  }, [currentTrack, isPlaying, ytReady]);

  // --- Handle Track Completion ---
  const handleTrackEnded = () => {
    if (isLoop) {
      if (currentTrack && currentTrack.source === 'youtube') {
        if (ytPlayerRef.current && ytReady) {
          try {
            ytPlayerRef.current.seekTo(0, true);
            ytPlayerRef.current.playVideo();
          } catch (e) {}
        }
      } else {
        if (audioRef.current) {
          audioRef.current.currentTime = 0;
          audioRef.current.play();
        }
      }
    } else {
      playNext();
    }
  };

  // --- Player controls ---
  const playTrack = (track: Track, newQueue: Track[] = []) => {
    const targetQueue = newQueue.length > 0 ? newQueue : [track];
    const index = targetQueue.findIndex(t => t.id === track.id);
    
    setQueue(targetQueue);
    setQueueIndex(index !== -1 ? index : 0);
    setCurrentTrack(track);
    setIsPlaying(true);
  };

  const togglePlay = () => {
    if (!currentTrack && tracks.length > 0) {
      // If nothing is playing, play first song
      playTrack(tracks[0], tracks);
      return;
    }
    setIsPlaying(prev => !prev);
  };

  const playNext = () => {
    if (queue.length === 0) return;
    
    let nextIndex = queueIndex + 1;
    
    if (isShuffle) {
      nextIndex = Math.floor(Math.random() * queue.length);
    } else if (nextIndex >= queue.length) {
      nextIndex = 0; // Wrap around
    }

    setQueueIndex(nextIndex);
    setCurrentTrack(queue[nextIndex]);
    setIsPlaying(true);
  };

  const playPrev = () => {
    if (queue.length === 0) return;

    let prevIndex = queueIndex - 1;
    if (prevIndex < 0) {
      prevIndex = queue.length - 1; // Wrap around
    }

    setQueueIndex(prevIndex);
    setCurrentTrack(queue[prevIndex]);
    setIsPlaying(true);
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const seekVal = parseFloat(e.target.value);
    setCurrentTime(seekVal);
    
    if (currentTrack && currentTrack.source === 'youtube') {
      if (ytPlayerRef.current && ytReady) {
        try {
          ytPlayerRef.current.seekTo(seekVal, true);
        } catch (err) {}
      }
    } else {
      if (audioRef.current) {
        audioRef.current.currentTime = seekVal;
      }
    }
  };

  // --- Audio Waves procedural canvas animation ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions
    const resizeCanvas = () => {
      canvas.width = canvas.parentElement?.clientWidth || 800;
      canvas.height = 100;
    };
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    let frame = 0;
    const draw = () => {
      frame++;
      animationRef.current = requestAnimationFrame(draw);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (isPlaying) {
        // Wave 1 (Neon Purple)
        ctx.strokeStyle = 'rgba(139, 92, 246, 0.25)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        for (let i = 0; i < canvas.width; i++) {
          const cycle = frame * 0.03;
          const y = canvas.height / 2 + 
                    Math.sin(i * 0.008 + cycle) * 20 * Math.sin(cycle * 0.1) +
                    Math.cos(i * 0.015 - cycle * 1.5) * 10;
          if (i === 0) ctx.moveTo(i, y);
          else ctx.lineTo(i, y);
        }
        ctx.stroke();

        // Wave 2 (Cyan)
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.2)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < canvas.width; i++) {
          const cycle = frame * 0.045;
          const y = canvas.height / 2 + 
                    Math.cos(i * 0.012 - cycle) * 18 * Math.cos(cycle * 0.08) +
                    Math.sin(i * 0.025 + cycle * 1.2) * 8;
          if (i === 0) ctx.moveTo(i, y);
          else ctx.lineTo(i, y);
        }
        ctx.stroke();
      } else {
        // Flatline
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
      }
    };

    draw();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isPlaying]);

  // --- Auth Actions ---
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginUsername || !loginPassword) {
      showToast("Username and password are required", "error");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginUsername, password: loginPassword })
      });
      const data = await res.json();
      
      if (!res.ok) {
        showToast(data.error || "Login failed", "error");
        return;
      }

      localStorage.setItem('soundwave_token', data.token);
      setToken(data.token);
      setUser(data.user);
      setAuthModalOpen(false);
      showToast("Successfully logged in", "success");
      
      // Reset fields
      setLoginUsername('');
      setLoginPassword('');
    } catch (err) {
      showToast("Server connection error", "error");
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signupUsername || !signupPassword) {
      showToast("Username and password are required", "error");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: signupUsername,
          password: signupPassword,
          displayName: signupDisplayName
        })
      });
      const data = await res.json();

      if (!res.ok) {
        showToast(data.error || "Signup failed", "error");
        return;
      }

      localStorage.setItem('soundwave_token', data.token);
      setToken(data.token);
      setUser(data.user);
      setAuthModalOpen(false);
      showToast("Account created successfully", "success");

      // Reset fields
      setSignupUsername('');
      setSignupPassword('');
      setSignupDisplayName('');
    } catch (err) {
      showToast("Server connection error", "error");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('soundwave_token');
    setToken(null);
    setUser(null);
    setActiveTab('home');
    showToast("Logged out successfully", "info");
  };

  // --- Playlist Actions ---
  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playlistName) {
      showToast("Playlist name is required", "error");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/playlists`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: playlistName,
          description: playlistDesc,
          isPublic: playlistIsPublic
        })
      });

      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Failed to create playlist", "error");
        return;
      }

      showToast("Playlist created successfully", "success");
      setCreatePlaylistOpen(false);
      setPlaylistName('');
      setPlaylistDesc('');
      setPlaylistIsPublic(true);
      fetchData(); // Reload playlists
    } catch (err) {
      showToast("Server error", "error");
    }
  };

  const togglePlaylistPrivacy = async (playlist: Playlist) => {
    try {
      const res = await fetch(`${API_BASE}/playlists/${playlist.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ isPublic: !playlist.isPublic })
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Failed to update playlist", "error");
        return;
      }
      showToast(`Playlist is now ${data.playlist.isPublic ? 'Public' : 'Private'}`, "success");
      fetchData();
    } catch (err) {
      showToast("Server error", "error");
    }
  };

  const handleDeletePlaylist = async (playlistId: string) => {
    if (!window.confirm("Are you sure you want to delete this playlist?")) return;
    try {
      const res = await fetch(`${API_BASE}/playlists/${playlistId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json();
        showToast(data.error || "Failed to delete playlist", "error");
        return;
      }
      showToast("Playlist deleted", "success");
      setActiveTab('home');
      fetchData();
    } catch (err) {
      showToast("Server error", "error");
    }
  };

  const handleAddTrackToPlaylist = async (playlistId: string, trackId: string) => {
    try {
      const res = await fetch(`${API_BASE}/playlists/${playlistId}/add-track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ trackId })
      });
      const data = await res.json();

      if (!res.ok) {
        showToast(data.error || "Failed to add track", "error");
        return;
      }

      showToast("Track added to playlist", "success");
      setAddToPlaylistTrackId(null);
      fetchData();
    } catch (err) {
      showToast("Server error", "error");
    }
  };

  const handleRemoveTrackFromPlaylist = async (playlistId: string, trackId: string) => {
    try {
      const res = await fetch(`${API_BASE}/playlists/${playlistId}/remove-track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ trackId })
      });
      const data = await res.json();

      if (!res.ok) {
        showToast(data.error || "Failed to remove track", "error");
        return;
      }

      showToast("Track removed from playlist", "success");
      fetchData();
    } catch (err) {
      showToast("Server error", "error");
    }
  };

  const addTrackToPlaylistOrCreate = async (trackId: string, selectedPlId: string, newPlName: string) => {
    if (selectedPlId === 'none') return;
    
    let targetPlaylistId = selectedPlId;
    
    if (selectedPlId === 'create') {
      if (!newPlName.trim()) {
        showToast("Playlist name is required to create a new playlist", "error");
        return;
      }
      
      try {
        const res = await fetch(`${API_BASE}/playlists`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            name: newPlName,
            description: "Automatically created during upload",
            isPublic: true
          })
        });
        
        const data = await res.json();
        if (!res.ok) {
          showToast(data.error || "Failed to create playlist during upload", "error");
          return;
        }
        
        targetPlaylistId = data.playlist.id;
      } catch (err) {
        showToast("Failed to create playlist", "error");
        return;
      }
    }
    
    // Add track to playlist
    try {
      const res = await fetch(`${API_BASE}/playlists/${targetPlaylistId}/add-track`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ trackId })
      });
      
      if (res.ok) {
        showToast("Added track to playlist!", "success");
      } else {
        const data = await res.json();
        showToast(data.error || "Failed to add track to playlist", "error");
      }
    } catch (err) {
      showToast("Error adding track to playlist", "error");
    }
  };

  // --- Track Import/Upload Actions ---
  const handleYoutubeImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ytUrl) {
      showToast("Please enter a YouTube video URL", "error");
      return;
    }
    
    setIsImportingYt(true);
    showToast("Processing and importing YouTube audio...", "info");

    try {
      const res = await fetch(`${API_BASE}/tracks/youtube`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ youtubeUrl: ytUrl, isPublic: ytIsPublic })
      });
      const data = await res.json();

      setIsImportingYt(false);

      if (!res.ok) {
        showToast(data.error || "Failed to import video", "error");
        return;
      }

      showToast(data.message || "YouTube track imported!", "success");

      // Auto playlist selection action
      if (ytPlaylistId !== 'none') {
        await addTrackToPlaylistOrCreate(data.track.id, ytPlaylistId, ytNewPlaylistName);
      }

      setYtUrl('');
      setYtIsPublic(false);
      setYtPlaylistId('none');
      setYtNewPlaylistName('');
      fetchData();
    } catch (err) {
      setIsImportingYt(false);
      showToast("Connection to server failed", "error");
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      showToast("Please select an audio file to upload", "error");
      return;
    }

    setIsUploading(true);
    showToast("Uploading audio file...", "info");

    const formData = new FormData();
    formData.append('audio', uploadFile);
    formData.append('title', uploadTitle);
    formData.append('artist', uploadArtist);
    formData.append('isPublic', String(uploadIsPublic));

    try {
      const res = await fetch(`${API_BASE}/tracks/upload`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      const data = await res.json();
      
      setIsUploading(false);

      if (!res.ok) {
        showToast(data.error || "Upload failed", "error");
        return;
      }

      showToast("Audio track uploaded successfully!", "success");

      // Auto playlist selection action
      if (uploadPlaylistId !== 'none') {
        await addTrackToPlaylistOrCreate(data.track.id, uploadPlaylistId, uploadNewPlaylistName);
      }

      setUploadTitle('');
      setUploadArtist('');
      setUploadFile(null);
      setUploadIsPublic(false);
      setUploadPlaylistId('none');
      setUploadNewPlaylistName('');
      fetchData();
    } catch (err) {
      setIsUploading(false);
      showToast("Server upload failed", "error");
    }
  };

  const handleDeleteTrack = async (trackId: string) => {
    if (!window.confirm("Are you sure you want to delete this track? This will remove it from all playlists.")) return;
    try {
      const res = await fetch(`${API_BASE}/tracks/${trackId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json();
        showToast(data.error || "Failed to delete track", "error");
        return;
      }
      showToast("Track deleted successfully", "success");
      // Stop playback if current track is deleted
      if (currentTrack && currentTrack.id === trackId) {
        setIsPlaying(false);
        setCurrentTrack(null);
      }
      fetchData();
    } catch (err) {
      showToast("Server error", "error");
    }
  };

  // --- Filtering Tracks for Search Query ---
  const filteredTracks = tracks.filter(t => 
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.artist.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get active playlist object if detail tab open
  const activePlaylist = playlists.find(p => p.id === selectedPlaylistId);
  const activePlaylistTracks = activePlaylist 
    ? activePlaylist.trackIds.map(tid => tracks.find(t => t.id === tid)).filter(Boolean) as Track[]
    : [];

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragOverRef.current = false;
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type.startsWith('audio/') || file.name.match(/\.(mp3|wav|ogg|m4a|aac|flac)$/i)) {
        setUploadFile(file);
        // Autopopulate title if blank
        if (!uploadTitle) {
          setUploadTitle(file.name.replace(/\.[^/.]+$/, ""));
        }
        showToast(`Selected file: ${file.name}`, "info");
      } else {
        showToast("Unsupported file format. Please upload audio files only.", "error");
      }
    }
  };

  // Helper to convert seconds to MM:SS
  const formatTime = (secs: number) => {
    if (isNaN(secs)) return "0:00";
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  return (
    <div id="root">
      
      {/* Toast Notification Container */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            <span>{toast.message}</span>
          </div>
        ))}
      </div>

      <div className="app-container">
        
        {/* SIDEBAR SIDE */}
        <div className="sidebar">
          <div className="logo-container">
            <div className="logo-icon">♬</div>
            <div className="logo-text">SoundWave</div>
          </div>

          <div className="sidebar-nav">
            <div 
              className={`nav-item ${activeTab === 'home' ? 'active' : ''}`}
              onClick={() => { setActiveTab('home'); setSelectedPlaylistId(null); }}
            >
              <Music size={18} />
              <span>Browse Music</span>
            </div>

            {user && (
              <div 
                className={`nav-item ${activeTab === 'upload' ? 'active' : ''}`}
                onClick={() => { setActiveTab('upload'); setSelectedPlaylistId(null); }}
              >
                <Upload size={18} />
                <span>Upload & Import</span>
              </div>
            )}
          </div>

          <div className="sidebar-section">
            <div className="section-header" style={{ marginBottom: '8px', paddingRight: '4px' }}>
              <span className="section-title">Playlists</span>
              {user && (
                <button 
                  className="btn-row-action" 
                  title="Create Playlist"
                  onClick={() => setCreatePlaylistOpen(true)}
                >
                  <Plus size={16} />
                </button>
              )}
            </div>

            <div className="playlist-list">
              {playlists.map(pl => (
                <div 
                  key={pl.id} 
                  className={`playlist-nav-item ${selectedPlaylistId === pl.id && activeTab === 'playlist-detail' ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedPlaylistId(pl.id);
                    setActiveTab('playlist-detail');
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {pl.isPublic ? <Globe size={13} style={{ flexShrink: 0 }} /> : <Lock size={13} style={{ flexShrink: 0 }} />}
                    {pl.name}
                  </span>
                  <span className="playlist-track-count">{pl.trackIds.length}</span>
                </div>
              ))}
              {playlists.length === 0 && (
                <div style={{ fontSize: '12px', color: 'var(--text-dim)', paddingLeft: '16px' }}>
                  No playlists available.
                </div>
              )}
            </div>
          </div>

          {/* User Profile Widget */}
          <div className="user-profile-widget">
            {user ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div className="user-info">
                  <div className="user-avatar">
                    {user.displayName.substring(0, 1).toUpperCase()}
                  </div>
                  <div className="user-meta">
                    <span className="user-name">{user.displayName}</span>
                    <span className="user-role">@{user.username}</span>
                  </div>
                </div>
                <button className="btn btn-secondary" style={{ width: '100%' }} onClick={handleLogout}>
                  <LogOut size={14} />
                  <span>Log Out</span>
                </button>
              </div>
            ) : (
              <button className="btn btn-primary" style={{ width: '100%' }} onClick={() => { setAuthTab('login'); setAuthModalOpen(true); }}>
                <LogIn size={14} />
                <span>Sign In / Create Account</span>
              </button>
            )}
          </div>
        </div>

        {/* MAIN BODY AREA */}
        <div className="main-content">
          
          <header className="main-header">
            <div className="search-bar">
              <Search size={18} className="text-dim" />
              <input 
                type="text" 
                className="search-input" 
                placeholder="Search tracks, artists..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="header-actions">
              {user && activeTab !== 'upload' && (
                <button className="btn btn-accent" onClick={() => setActiveTab('upload')}>
                  <Upload size={14} />
                  <span>Import Track</span>
                </button>
              )}
            </div>
          </header>

          <canvas ref={canvasRef} className="canvas-waveform-container" />

          {/* PAGE CONTENT CONTAINER */}
          <div className="content-body" style={{ zIndex: 2 }}>
            
            {/* 1. BROWSE / HOME TAB */}
            {activeTab === 'home' && (
              <>
                <div className="hero-banner">
                  <span className="hero-tagline">Premium Music Streaming</span>
                  <h1 className="hero-title">Your Ultimate Music Hub & Downloader</h1>
                  <p className="hero-desc">
                    Create your profile, publish playlists, upload local files, or directly paste a YouTube video link to download and add it into your library instantly.
                  </p>
                  <div>
                    {!user && (
                      <button className="btn btn-primary" onClick={() => { setAuthTab('signup'); setAuthModalOpen(true); }}>
                        Get Started Free
                      </button>
                    )}
                  </div>
                </div>

                <div>
                  <div className="section-header">
                    <h2>Available Tracks</h2>
                    <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                      Showing {filteredTracks.length} song{filteredTracks.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  <div className="grid-cols-4">
                    {filteredTracks.map(track => (
                      <div key={track.id} className="music-card" onClick={() => playTrack(track, filteredTracks)}>
                        <div className="card-img-container">
                          <img 
                            src={track.thumbnail.startsWith('http') ? track.thumbnail : `${BACKEND_HOST}${track.thumbnail}`} 
                            className="card-img" 
                            alt={track.title} 
                          />
                          <button className="play-hover-btn">
                            <Play fill="white" size={18} />
                          </button>
                        </div>
                        <div className="card-info">
                          <div className="card-title">{track.title}</div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div className="card-desc">{track.artist}</div>
                            <span className={`badge-source ${track.source}`} style={{ fontSize: '9px', padding: '1px 6px' }}>
                              {track.source}
                            </span>
                          </div>
                        </div>
                        
                        {user && (
                          <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '4px', zIndex: 10 }}>
                            {track.uploadedBy === user.id && (
                              <button 
                                className="btn-row-action delete" 
                                style={{ backgroundColor: 'rgba(239, 68, 68, 0.8)', borderRadius: '50%', padding: '6px', color: 'white', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                                title="Delete Track"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteTrack(track.id);
                                }}
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                            <button 
                              className="btn-row-action" 
                              style={{ backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: '50%', padding: '6px', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                setAddToPlaylistTrackId(addToPlaylistTrackId === track.id ? null : track.id);
                              }}
                            >
                              <Plus size={13} />
                            </button>

                            {/* Card-specific Popover */}
                            {addToPlaylistTrackId === track.id && (
                              <div 
                                className="add-playlist-popover"
                                style={{ 
                                  position: 'absolute', 
                                  top: '32px', 
                                  right: '0', 
                                  backgroundColor: 'var(--bg-dark)', 
                                  border: '1px solid var(--border-color)', 
                                  borderRadius: '8px', 
                                  padding: '8px', 
                                  width: '200px', 
                                  zIndex: 50, 
                                  boxShadow: '0 10px 25px rgba(0,0,0,0.6)' 
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="popover-header" style={{ borderBottom: '1px solid var(--border-color)', marginBottom: '4px' }}>Add to Playlist</div>
                                {playlists.filter(p => user && p.createdBy === user.id).map(pl => (
                                  <div 
                                    key={pl.id} 
                                    className="popover-item"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAddTrackToPlaylist(pl.id, track.id);
                                    }}
                                  >
                                    <Plus size={12} />
                                    <span>{pl.name}</span>
                                  </div>
                                ))}
                                {playlists.filter(p => user && p.createdBy === user.id).length === 0 && (
                                  <div style={{ fontSize: '11px', color: 'var(--text-dim)', padding: '8px 12px' }}>
                                    No playlists. Go to playlists tab to create one!
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                    
                    {filteredTracks.length === 0 && (
                      <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>
                        No songs found matching your search.
                      </div>
                    )}
                  </div>
                </div>

                {/* Public Playlists Section */}
                <div>
                  <div className="section-header">
                    <h2>Featured Playlists</h2>
                  </div>
                  <div className="grid-cols-4">
                    {playlists.filter(p => p.isPublic).map(pl => (
                      <div 
                        key={pl.id} 
                        className="music-card"
                        onClick={() => {
                          setSelectedPlaylistId(pl.id);
                          setActiveTab('playlist-detail');
                        }}
                      >
                        <div className="card-img-container">
                          <img 
                            src="https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&auto=format&fit=crop&q=60" 
                            className="card-img" 
                            alt={pl.name} 
                          />
                          <button className="play-hover-btn">
                            <ListMusic size={18} />
                          </button>
                        </div>
                        <div className="card-info">
                          <div className="card-title">{pl.name}</div>
                          <div className="card-desc">Created by {pl.creatorName}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '4px' }}>
                            {pl.trackIds.length} track{pl.trackIds.length !== 1 ? 's' : ''} • Public
                          </div>
                        </div>
                      </div>
                    ))}
                    {playlists.filter(p => p.isPublic).length === 0 && (
                      <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '20px', color: 'var(--text-dim)' }}>
                        No public playlists available.
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* 2. PLAYLIST DETAIL VIEW */}
            {activeTab === 'playlist-detail' && activePlaylist && (
              <div>
                <div className="playlist-banner">
                  <img 
                    src="https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&auto=format&fit=crop&q=60" 
                    className="playlist-cover-art" 
                    alt={activePlaylist.name} 
                  />
                  <div className="playlist-details">
                    <span className="playlist-badge">Playlist</span>
                    <h1 className="playlist-title-large">{activePlaylist.name}</h1>
                    <p className="playlist-meta-desc">{activePlaylist.description || "No description provided."}</p>
                    <div className="playlist-statistics">
                      <span>Created by <b>{activePlaylist.creatorName}</b></span>
                      <span>•</span>
                      <span>{activePlaylistTracks.length} song{activePlaylistTracks.length !== 1 ? 's' : ''}</span>
                      <span>•</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        {activePlaylist.isPublic ? <Globe size={14} /> : <Lock size={14} />}
                        {activePlaylist.isPublic ? 'Public' : 'Private'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="playlist-actions-row">
                  {activePlaylistTracks.length > 0 && (
                    <button className="btn btn-primary" onClick={() => playTrack(activePlaylistTracks[0], activePlaylistTracks)}>
                      <Play fill="white" size={16} />
                      Play Playlist
                    </button>
                  )}
                  
                  {user && activePlaylist.createdBy === user.id && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', flex: 1 }}>
                      <button className="btn btn-secondary" onClick={() => togglePlaylistPrivacy(activePlaylist)}>
                        {activePlaylist.isPublic ? <Lock size={14} /> : <Globe size={14} />}
                        Make {activePlaylist.isPublic ? 'Private' : 'Public'}
                      </button>
                      
                      <button className="btn btn-secondary btn-icon-only delete" title="Delete Playlist" onClick={() => handleDeletePlaylist(activePlaylist.id)}>
                        <Trash2 size={16} />
                      </button>

                      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <select 
                          className="form-input"
                          style={{ height: '36px', padding: '0 12px', background: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '6px', color: 'var(--text-main)', fontSize: '13px', cursor: 'pointer', minWidth: '220px' }}
                          onChange={async (e) => {
                            if (e.target.value && e.target.value !== 'none') {
                              await handleAddTrackToPlaylist(activePlaylist.id, e.target.value);
                              e.target.value = 'none'; // Reset dropdown
                            }
                          }}
                        >
                          <option value="none">+ Add Song to Playlist...</option>
                          {tracks
                            .filter(t => !activePlaylist.trackIds.includes(t.id))
                            .map(t => (
                              <option key={t.id} value={t.id}>{t.title} - {t.artist}</option>
                            ))
                          }
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* Track list table */}
                <table className="track-table">
                  <thead>
                    <tr>
                      <th className="track-cell-number">#</th>
                      <th>Title</th>
                      <th>Source</th>
                      <th>Date Added</th>
                      <th className="track-cell-actions"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {activePlaylistTracks.map((track, idx) => {
                      const isCurrent = currentTrack?.id === track.id;
                      return (
                        <tr key={track.id} className={`track-row ${isCurrent ? 'playing' : ''}`}>
                          <td className="track-cell-number">
                            {isCurrent && isPlaying ? (
                              <div className="visualizer-overlay" style={{ height: '14px', margin: '0 auto' }}>
                                <div className="visualizer-bar" style={{ width: '2px', animationDuration: '0.6s' }}></div>
                                <div className="visualizer-bar" style={{ width: '2px', animationDuration: '0.7s' }}></div>
                                <div className="visualizer-bar" style={{ width: '2px', animationDuration: '0.5s' }}></div>
                              </div>
                            ) : (
                              idx + 1
                            )}
                          </td>
                          <td className="track-cell-title">
                            <img 
                              src={track.thumbnail.startsWith('http') ? track.thumbnail : `${BACKEND_HOST}${track.thumbnail}`} 
                              className="track-mini-thumb" 
                              alt="" 
                            />
                            <div className="track-info-texts">
                              <span className="track-name-bold" onClick={() => playTrack(track, activePlaylistTracks)}>
                                {track.title}
                              </span>
                              <span className="track-artist-sub">{track.artist}</span>
                            </div>
                          </td>
                          <td className="track-cell-source">
                            <span className={`badge-source ${track.source}`}>
                              {track.source}
                            </span>
                          </td>
                          <td>
                            {new Date(track.createdAt).toLocaleDateString()}
                          </td>
                          <td className="track-cell-actions">
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                              {user && activePlaylist.createdBy === user.id && (
                                <button 
                                  className="btn-row-action delete" 
                                  title="Remove from Playlist"
                                  onClick={() => handleRemoveTrackFromPlaylist(activePlaylist.id, track.id)}
                                >
                                  <X size={15} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {activePlaylistTracks.length === 0 && (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-dim)' }}>
                          This playlist is empty. Add songs from the "Browse Music" page.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* 3. UPLOAD & IMPORT TAB */}
            {activeTab === 'upload' && user && (
              <div className="creator-container">
                
                {/* File Upload Panel */}
                <div className="creator-panel">
                  <div className="panel-header">
                    <h3>Upload Local Audio</h3>
                    <p>Upload files from your computer. Supports MP3, WAV, M4A, OGG, and AAC formats.</p>
                  </div>

                  <form onSubmit={handleFileUpload} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div 
                      className="upload-dropzone"
                      onDragOver={(e) => { e.preventDefault(); dragOverRef.current = true; }}
                      onDrop={handleDrop}
                    >
                      <div className="upload-icon-wrapper">
                        <Upload size={24} />
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <p style={{ fontWeight: 600 }}>{uploadFile ? uploadFile.name : "Drag & Drop Audio File Here"}</p>
                        <p className="upload-limits-text">or click to browse from explorer</p>
                      </div>
                      <input 
                        type="file" 
                        accept="audio/*" 
                        className="file-input-hidden" 
                        id="audio-uploader-input" 
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            const file = e.target.files[0];
                            setUploadFile(file);
                            if (!uploadTitle) setUploadTitle(file.name.replace(/\.[^/.]+$/, ""));
                          }
                        }}
                      />
                      <label htmlFor="audio-uploader-input" className="btn btn-secondary">
                        Browse Files
                      </label>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Track Title (Optional)</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="e.g. Chill Vibrations"
                        value={uploadTitle}
                        onChange={e => setUploadTitle(e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Artist (Optional)</label>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="e.g. DJ Lofi"
                        value={uploadArtist}
                        onChange={e => setUploadArtist(e.target.value)}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Add to Playlist (Optional)</label>
                      <select 
                        className="form-input" 
                        value={uploadPlaylistId}
                        onChange={e => setUploadPlaylistId(e.target.value)}
                        style={{ background: 'var(--card-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', height: '40px', padding: '0 12px', cursor: 'pointer' }}
                      >
                        <option value="none">-- Select Playlist --</option>
                        <option value="create">+ Create New Playlist</option>
                        {playlists.filter(p => user && p.createdBy === user.id).map(pl => (
                          <option key={pl.id} value={pl.id}>{pl.name}</option>
                        ))}
                      </select>
                    </div>

                    {uploadPlaylistId === 'create' && (
                      <div className="form-group">
                        <label className="form-label">New Playlist Name</label>
                        <input 
                          type="text" 
                          className="form-input" 
                          placeholder="e.g. My Uploads"
                          value={uploadNewPlaylistName}
                          onChange={e => setUploadNewPlaylistName(e.target.value)}
                          required
                        />
                      </div>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input 
                        type="checkbox" 
                        id="upload-public-checkbox"
                        checked={uploadIsPublic}
                        onChange={e => setUploadIsPublic(e.target.checked)}
                        style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                      />
                      <label htmlFor="upload-public-checkbox" style={{ fontSize: '14px', cursor: 'pointer', color: 'var(--text-main)' }}>
                        Make Track Public (visible in Browse Music feed)
                      </label>
                    </div>

                    <button 
                      type="submit" 
                      className="btn btn-primary" 
                      style={{ width: '100%', justifyContent: 'center' }}
                      disabled={isUploading}
                    >
                      {isUploading ? "Uploading file..." : "Upload Audio Track"}
                    </button>
                  </form>
                </div>

                {/* YouTube Import Panel */}
                <div className="creator-panel">
                  <div className="panel-header">
                    <h3>Import YouTube Link</h3>
                    <p>Paste a YouTube video URL. We will download the audio and convert it to play in your browser.</p>
                  </div>

                  <form onSubmit={handleYoutubeImport} style={{ display: 'flex', flexDirection: 'column', gap: '20px', justifyContent: 'space-between', height: '100%' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'center', color: '#ef4444', padding: '20px 0' }}>
                        <YoutubeIcon size={64} />
                      </div>
                      
                      <div className="form-group">
                        <label className="form-label">YouTube Video URL</label>
                        <input 
                          type="url" 
                          className="form-input" 
                          placeholder="e.g. https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                          value={ytUrl}
                          onChange={e => setYtUrl(e.target.value)}
                        />
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '10px' }}>
                        <input 
                          type="checkbox" 
                          id="yt-public-checkbox"
                          checked={ytIsPublic}
                          onChange={e => setYtIsPublic(e.target.checked)}
                          style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                        />
                        <label htmlFor="yt-public-checkbox" style={{ fontSize: '14px', cursor: 'pointer', color: 'var(--text-main)' }}>
                          Make Track Public (visible in Browse Music feed)
                        </label>
                      </div>

                      <div className="form-group" style={{ marginTop: '10px' }}>
                        <label className="form-label">Add to Playlist (Optional)</label>
                        <select 
                          className="form-input" 
                          value={ytPlaylistId}
                          onChange={e => setYtPlaylistId(e.target.value)}
                          style={{ background: 'var(--card-bg)', color: 'var(--text-main)', border: '1px solid var(--border-color)', borderRadius: '6px', height: '40px', padding: '0 12px', cursor: 'pointer' }}
                        >
                          <option value="none">-- Select Playlist --</option>
                          <option value="create">+ Create New Playlist</option>
                          {playlists.filter(p => user && p.createdBy === user.id).map(pl => (
                            <option key={pl.id} value={pl.id}>{pl.name}</option>
                          ))}
                        </select>
                      </div>

                      {ytPlaylistId === 'create' && (
                        <div className="form-group">
                          <label className="form-label">New Playlist Name</label>
                          <input 
                            type="text" 
                            className="form-input" 
                            placeholder="e.g. YouTube Vibes"
                            value={ytNewPlaylistName}
                            onChange={e => setYtNewPlaylistName(e.target.value)}
                            required
                          />
                        </div>
                      )}
                    </div>

                    <button 
                      type="submit" 
                      className="btn btn-accent" 
                      style={{ width: '100%', justifyContent: 'center' }}
                      disabled={isImportingYt}
                    >
                      {isImportingYt ? "Downloading/Converting..." : "Download & Import Audio"}
                    </button>
                  </form>
                </div>

              </div>
            )}

          </div>



        </div>

      </div>

      {/* BOTTOM MUSIC PLAYER BAR */}
      <div className="audio-player-bar">
        
        {/* Track Details */}
        <div className="player-now-playing">
          {currentTrack ? (
            <>
              <img 
                src={currentTrack.thumbnail.startsWith('http') ? currentTrack.thumbnail : `${BACKEND_HOST}${currentTrack.thumbnail}`} 
                className="player-thumb" 
                alt="" 
              />
              <div className="player-track-meta">
                <span className="player-track-title">{currentTrack.title}</span>
                <span className="player-track-artist">{currentTrack.artist}</span>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div className="player-thumb" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)' }}>
                ♬
              </div>
              <div className="player-track-meta">
                <span className="player-track-title" style={{ color: 'var(--text-dim)' }}>No Song Selected</span>
                <span className="player-track-artist" style={{ color: 'var(--text-dim)' }}>-</span>
              </div>
            </div>
          )}
        </div>

        {/* Center Player Controls */}
        <div className="player-controls-container">
          <div className="player-buttons">
            <button 
              className={`btn-player-ctrl ${isShuffle ? 'active' : ''}`}
              title="Shuffle"
              onClick={() => setIsShuffle(prev => !prev)}
            >
              <Shuffle size={16} />
            </button>

            <button className="btn-player-ctrl" title="Previous" onClick={playPrev}>
              <SkipBack size={18} />
            </button>

            <button className="btn-player-ctrl play-pause" onClick={togglePlay}>
              {isPlaying ? <Pause fill="black" size={18} /> : <Play fill="black" size={18} />}
            </button>

            <button className="btn-player-ctrl" title="Next" onClick={playNext}>
              <SkipForward size={18} />
            </button>

            <button 
              className={`btn-player-ctrl ${isLoop ? 'active' : ''}`}
              title="Repeat"
              onClick={() => setIsLoop(prev => !prev)}
            >
              <Repeat size={16} />
            </button>
          </div>

          <div className="player-seekbar-container">
            <span className="time-display">{formatTime(currentTime)}</span>
            
            <div className="slider-container">
              <div 
                className="slider-progress" 
                style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              ></div>
              <div 
                className="slider-thumb"
                style={{ left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
              ></div>
              <input 
                type="range" 
                min={0} 
                max={duration || 100} 
                step={0.1}
                value={currentTime} 
                onChange={handleSeek} 
                className="slider-input-raw"
              />
            </div>

            <span className="time-display">{formatTime(duration)}</span>
          </div>
        </div>

        {/* Right Player Extra Controls */}
        <div className="player-extra-controls">
          <button 
            className={`btn-player-ctrl ${showQueue ? 'active' : ''}`} 
            title="Up Next"
            onClick={() => setShowQueue(!showQueue)}
          >
            <ListMusic size={18} />
          </button>

          <div className="volume-control-wrapper">
            <button className="btn-player-ctrl" onClick={() => setIsMuted(!isMuted)}>
              {isMuted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
            </button>
            
            <div className="slider-container" style={{ width: '80px', flex: 'none' }}>
              <div className="slider-progress" style={{ width: `${isMuted ? 0 : volume * 100}%` }}></div>
              <div className="slider-thumb" style={{ left: `${isMuted ? 0 : volume * 100}%` }}></div>
              <input 
                type="range" 
                min={0} 
                max={1} 
                step={0.01}
                value={isMuted ? 0 : volume} 
                onChange={e => {
                  setVolume(parseFloat(e.target.value));
                  setIsMuted(false);
                }} 
                className="slider-input-raw"
              />
            </div>
          </div>
        </div>

      </div>

      {/* Up Next Queue Panel */}
      {showQueue && (
        <div style={{
          position: 'fixed', bottom: '90px', right: '24px', width: '300px', maxHeight: '400px',
          backgroundColor: 'var(--bg-dark)', border: '1px solid var(--border-color)', borderRadius: '8px',
          padding: '16px', zIndex: 30, display: 'flex', flexDirection: 'column', gap: '12px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)', overflowY: 'auto'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h4 style={{ fontSize: '15px' }}>Up Next</h4>
            <button className="btn-row-action" onClick={() => setShowQueue(false)}><X size={14} /></button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {queue.map((track, idx) => (
              <div 
                key={track.id + '-' + idx} 
                style={{
                  display: 'flex', alignItems: 'center', gap: '8px', padding: '6px', borderRadius: '4px',
                  backgroundColor: idx === queueIndex ? 'rgba(139,92,246,0.1)' : 'transparent',
                  cursor: 'pointer'
                }}
                onClick={() => {
                  setQueueIndex(idx);
                  setCurrentTrack(track);
                  setIsPlaying(true);
                }}
              >
                <img 
                  src={track.thumbnail.startsWith('http') ? track.thumbnail : `${BACKEND_HOST}${track.thumbnail}`} 
                  style={{ width: '32px', height: '32px', borderRadius: '4px', objectFit: 'cover' }} 
                  alt="" 
                />
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: idx === queueIndex ? 'var(--secondary)' : 'white', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{track.title}</div>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{track.artist}</div>
                </div>
              </div>
            ))}
            {queue.length === 0 && (
              <div style={{ fontSize: '12px', color: 'var(--text-dim)', textAlign: 'center', padding: '20px' }}>Queue is empty</div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: AUTHENTICATION */}
      {authModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3 style={{ textTransform: 'capitalize' }}>{authTab}</h3>
              <button className="modal-close-btn" onClick={() => setAuthModalOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="auth-tabs">
              <div className={`auth-tab ${authTab === 'login' ? 'active' : ''}`} onClick={() => setAuthTab('login')}>Log In</div>
              <div className={`auth-tab ${authTab === 'signup' ? 'active' : ''}`} onClick={() => setAuthTab('signup')}>Sign Up</div>
            </div>

            {authTab === 'login' ? (
              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Enter username" 
                    value={loginUsername}
                    onChange={e => setLoginUsername(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input 
                    type="password" 
                    className="form-input" 
                    placeholder="Enter password" 
                    value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '10px' }}>
                  Sign In
                </button>
              </form>
            ) : (
              <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Username</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Choose a username" 
                    value={signupUsername}
                    onChange={e => setSignupUsername(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Display Name</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g. Jane Doe" 
                    value={signupDisplayName}
                    onChange={e => setSignupDisplayName(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Password</label>
                  <input 
                    type="password" 
                    className="form-input" 
                    placeholder="Create password" 
                    value={signupPassword}
                    onChange={e => setSignupPassword(e.target.value)}
                  />
                </div>
                <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: '10px' }}>
                  Create Account
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: CREATE PLAYLIST */}
      {createPlaylistOpen && (
        <div className="modal-overlay">
          <form onSubmit={handleCreatePlaylist} className="modal-content">
            <div className="modal-header">
              <h3>Create Playlist</h3>
              <button type="button" className="modal-close-btn" onClick={() => setCreatePlaylistOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <div className="form-group">
              <label className="form-label">Playlist Name</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="e.g. Late Night Vibes" 
                value={playlistName}
                onChange={e => setPlaylistName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Description (Optional)</label>
              <textarea 
                className="form-input form-textarea" 
                placeholder="Describe your playlist..." 
                value={playlistDesc}
                onChange={e => setPlaylistDesc(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="switch-label">
                <span className="form-label" style={{ marginBottom: 0 }}>Public Playlist (visible to others)</span>
                <input 
                  type="checkbox" 
                  className="switch-inner-checkbox"
                  checked={playlistIsPublic}
                  onChange={e => setPlaylistIsPublic(e.target.checked)}
                />
                <div className="switch-wrapper">
                  <div className="switch-dot"></div>
                </div>
              </label>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setCreatePlaylistOpen(false)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">
                Create Playlist
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
}
