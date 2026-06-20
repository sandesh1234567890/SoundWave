# SoundWave Deployment Guide

This guide details the steps to deploy the SoundWave playlist application to a production or development environment. 

Since the application utilizes local file persistence (`db.json` for database records, and `uploads/` and `downloads/` directories for media files), **Docker Compose** is the highly recommended deployment strategy. It allows mounting host volumes to retain user data, files, and playlists across container updates and system restarts.

---

## 🚀 Recommended Strategy: Docker Compose (Stateful Deployment)

Deploying with Docker Compose containerizes the React client (under Nginx) and the Express.js API (under Node.js) while saving all user uploads and databases directly on the host server.

### Prerequisites
1. **Docker** and **Docker Compose** installed on the host machine/server.
2. If deploying to a remote host (e.g. AWS EC2, DigitalOcean, GCP VM), ensure ports `80` and `5000` are open in the security group/firewall rules.

### 📋 Steps to Deploy

1. **Clone/Move to Project Directory:**
   ```bash
   cd d:/react/soundwave
   ```

2. **Configure API Hostnames:**
   By default, the app is configured to talk to `localhost:5000`. If deploying to a public cloud VM, open `docker-compose.yml` and replace `localhost` with your public server IP or domain:
   ```yaml
   args:
     - VITE_API_BASE=http://<YOUR_SERVER_IP>:5000/api
     - VITE_BACKEND_HOST=http://<YOUR_SERVER_IP>:5000
   ```

3. **Start the Application:**
   Run the following command to build and launch the containers in background mode:
   ```bash
   docker compose up -d --build
   ```

4. **Verify Application Status:**
   Check the running containers:
   ```bash
   docker compose ps
   ```
   * **Frontend:** Accessible at `http://<YOUR_SERVER_IP>:80`
   * **Backend API:** Accessible at `http://<YOUR_SERVER_IP>:5000`

5. **Stop the Application:**
   ```bash
   docker compose down
   ```

---

## ☁️ Option 2: Stateless Serverless Deployments (e.g. Google Cloud Run)

If you strictly want to deploy on serverless hosting like Google Cloud Run:

> [!WARNING]
> Google Cloud Run is **stateless**. Since containers scale down to zero or restart periodically, any files stored locally in `db.json`, `uploads/`, or `downloads/` will be **lost**.

### Required Architecture Changes for Serverless Hosting:
1. **Database:** Migrating `db.js` file-system logic to an external cloud database (such as Supabase, MongoDB, or PostgreSQL).
2. **Object Storage:** Modifying the audio file upload/download route handlers (`server.js`) to stream files to cloud buckets (like Google Cloud Storage or AWS S3) instead of saving to local directories.

### Cloud Run Deployment Steps (If migration is completed):
1. **Authenticate SDK on your system:**
   ```bash
   gcloud auth login
   gcloud auth application-default login
   ```
2. **Deploy Service:**
   Deploy the backend folder directly (Google Buildpacks will build the runtime container automatically):
   ```bash
   gcloud run deploy soundwave-backend --source ./backend --region <REGION> --allow-unauthenticated
   ```
