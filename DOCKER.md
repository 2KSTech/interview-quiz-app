# Docker Setup for Interview Quiz App

This document explains how to build, run, and publish the Docker containers for the Interview Quiz App (frontend + backend).

## Architecture

The application consists of two services:
- **Backend**: Node.js/Express API server running on port 3010 (internal)
- **Frontend**: React/Vite SPA served by nginx on port 8080

Both services are orchestrated via `docker-compose.yml` and can be run together or separately.

## Prerequisites

- Docker installed on your system
- Docker Compose installed (usually comes with Docker Desktop)
- A Docker Hub account (for publishing)

## Building and Running Locally

### Using Docker Compose (Recommended)

1. **Build and start both services:**
```bash
docker-compose up --build
```

2. **The app will be available at:**
   - Frontend: `http://localhost:8080`
   - Backend API: `http://localhost:3010`

3. **To run in detached mode (background):**
```bash
docker-compose up -d --build
```

4. **View combined logs from both services:**
```bash
docker-compose logs -f
```
Or use the convenience script:
```bash
./docker-logs.sh follow
```

5. **To stop all containers:**
```bash
docker-compose down
```

6. **To stop and remove volumes (clears database):**
```bash
docker-compose down -v
```

### Viewing Logs

**Combined logs (both frontend and backend):**
```bash
docker-compose logs -f
```

**Logs from specific service:**
```bash
docker-compose logs -f backend
docker-compose logs -f frontend
```

**Last 100 lines:**
```bash
docker-compose logs --tail=100
```

**Using the convenience script:**
```bash
./docker-logs.sh          # View all logs
./docker-logs.sh follow   # Follow all logs
```

## Environment Variables

### Backend Environment Variables

The backend service accepts the following environment variables (set in `docker-compose.yml`):

- `PORT` - Server port (default: 3010)
- `CORS_ORIGINS` - Comma-separated list of allowed CORS origins
- `DB_PATH` - Path to SQLite database file (default: `/app/data/quizdb.sqlite`)
- `QUIZ_DB_PATH` - IDIOT-BOT Path to SQLite database file (default: `/app/data/quizdb.sqlite`)
- `RESULTS_DB_PATH` - `/app/data/quiz_results.sqlite`

- `QUIZ_REPO_TARBALL` - `/app/vendor/quizzes.tar.gz`
- `QUIZ_REPO_ROOT` - Path to quiz content repository (default: `/app/vendor/quizzes`)
- `NODE_ENV` - Node environment (production/development)

### Frontend Environment Variables

The frontend is built with the API URL embedded at build time. To change it, rebuild with:

```bash
docker-compose build --build-arg VITE_API_BASE_URL=http://your-api-url/api frontend
```

## Publishing to Docker Hub

### Step 1: Login to Docker Hub

```bash
docker login
```

Enter your Docker Hub username and password when prompted.

### Step 2: Build and Tag Images

**Backend:**
```bash
docker build -t YOUR_DOCKERHUB_USERNAME/quiz-app-backend:latest ./backend
docker tag YOUR_DOCKERHUB_USERNAME/quiz-app-backend:latest YOUR_DOCKERHUB_USERNAME/quiz-app-backend:v1.0.0
```

**Frontend:**
```bash
docker build -t YOUR_DOCKERHUB_USERNAME/quiz-app-frontend:latest .
docker tag YOUR_DOCKERHUB_USERNAME/quiz-app-frontend:latest YOUR_DOCKERHUB_USERNAME/quiz-app-frontend:v1.0.0
```

### Step 3: Push to Docker Hub

```bash
docker push YOUR_DOCKERHUB_USERNAME/quiz-app-backend:latest
docker push YOUR_DOCKERHUB_USERNAME/quiz-app-frontend:latest
```

### Step 4: Test the Published Images

Create a `docker-compose.pull.yml`:

```yaml
version: '3.8'

services:
  backend:
    image: YOUR_DOCKERHUB_USERNAME/quiz-app-backend:latest
    container_name: quiz-app-backend
    ports:
      - "3010:3010"
    environment:
      - PORT=3010
      - CORS_ORIGINS=http://localhost:8080
      - DB_PATH=/app/data/quizdb.sqlite
      - QUIZ_DB_PATH=/app/data/quizdb.sqlite
      - RESULTS_DB_PATH=/app/data/quiz_results.sqlite
      - QUIZ_REPO_TARBALL=/app/vendor/quiz.tar
    volumes:
      - backend-data:/app/data
      - ./backend/vendor:/app/vendor:ro

  frontend:
    image: YOUR_DOCKERHUB_USERNAME/quiz-app-frontend:latest
    container_name: interview-quiz-app
    ports:
      - "8080:8080"
    depends_on:
      - backend

volumes:
  backend-data:
```

Then run:
```bash
docker-compose -f docker-compose.pull.yml up
```

## Running Individual Services

### Backend Only

```bash
cd backend
docker build -t quiz-app-backend .
docker run -p 3010:3010 \
  -e PORT=3010 \
  -e CORS_ORIGINS=http://localhost:8080 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/vendor:/app/vendor:ro \
  quiz-app-backend
```

### Frontend Only

```bash
docker build -t quiz-app-frontend .
docker run -p 8080:8080 quiz-app-frontend
```

Note: If running frontend separately, ensure the backend is accessible at the URL configured during build.

## Troubleshooting

### Container won't start
- Check if ports are already in use: `lsof -i :8080` or `lsof -i :3010`
- Check container logs: `docker-compose logs [service-name]`

### Build fails
- Ensure all dependencies are in `package.json` files
- Clear Docker cache: `docker builder prune`
- Try rebuilding without cache: `docker-compose build --no-cache`

### App can't connect to backend API
- Verify backend is running: `docker-compose ps`
- Check backend logs: `docker-compose logs backend`
- Verify backend health: `curl http://localhost:3010/health`
- Ensure CORS_ORIGINS includes the frontend URL

### Database issues
- Database is stored in a Docker volume (`backend-data`)
- To reset: `docker-compose down -v` (removes volumes)
- Database file location: `/app/data/quizdb.sqlite` inside container

### Combined logs not showing
- Use `docker-compose logs -f` for all services
- Or use the convenience script: `./docker-logs.sh follow`
- Individual service logs: `docker-compose logs -f [service-name]`

## Health Checks

Both services include health check endpoints:

- **Backend**: `http://localhost:3010/health`
- **Frontend**: `http://localhost:8080/health`

Check health status:
```bash
curl http://localhost:3010/health
curl http://localhost:8080/health
```

## Volumes

The backend uses a Docker volume to persist the SQLite database:
- Volume name: `backend-data`
- Mount point: `/app/data` (inside container)
- Contains: `quizdb.sqlite` and other database files

To backup the database:
```bash
docker run --rm -v quiz-app_backend-data:/data -v $(pwd):/backup alpine tar czf /backup/backend-data-backup.tar.gz /data
```

## Network

Both services are on the same Docker network (`quiz-app-network`), allowing them to communicate using service names:
- Frontend can reach backend at: `http://backend:3010` (internal)
- External access: Frontend on `localhost:8080`, Backend on `localhost:3010`

## Notes

- The frontend is built as a static site and served with nginx
- The backend runs Node.js/Express with SQLite
- Both services restart automatically unless stopped
- Health checks ensure services are ready before dependencies start
- Logs from both services are combined when using `docker-compose logs`
