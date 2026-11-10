
# Real-Time Trade Dashboard

A real-time trade monitoring dashboard built using React, FastAPI, MySQL and WebSockets.

The application simulates a stock exchange trade-data API, fetches trade records in batches, stores them in a MySQL database, and displays live pull progress on an interactive dashboard.

## Problem Statement

Financial applications need to process large volumes of trade data without blocking users or making them wait for long-running API requests.

This project demonstrates background trade-data ingestion, batch processing, persistent storage, duplicate prevention and real-time frontend updates.

## Features

- Mock BSE trade API with 3,000 synthetic trade records.
- Batch-based trade fetching (100 records per batch).
- Background trade-pull processing.
- MySQL database integration.
- Duplicate trade prevention using unique trade IDs.
- Pull job status tracking.
- Real-time progress updates using WebSockets.
- Dashboard statistics and trade table.
- Search and symbol filtering.
- Sorting and pagination.
- Automatic dashboard refresh after successful pulls.
- Error handling for failed pull jobs.

## Technology Stack

### Frontend
- React
- Vite
- JavaScript
- CSS
- WebSocket API

### Backend
- Python
- FastAPI
- SQLAlchemy
- HTTPX

### Database
- MySQL

### Development Tools
- VS Code
- Postman
- MySQL Workbench
- Git and GitHub

## Architecture

The application follows a frontend-backend architecture.

1. React provides the trade monitoring dashboard.
2. FastAPI exposes REST endpoints and a WebSocket endpoint.
3. The background pull service fetches mock trade data in batches.
4. SQLAlchemy stores the fetched records in MySQL.
5. WebSockets notify the frontend about pull progress and completion.

See [Architecture Documentation](docs/architecture.md).

## Project Structure

```text
Real-Time-Trade-Dashboard/
│
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── database.py
│   │   ├── models.py
│   │   ├── routes/
│   │   └── services/
│   ├── data/
│   ├── .env.example
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   ├── public/
│   ├── package.json
│   └── index.html
│
├── docs/
│   └── architecture.md
│
├── README.md
└── .gitignore
```

## Database Setup

1. Install and start MySQL.
2. Create a database:

```sql
CREATE DATABASE trade_dashboard;
```

3. Navigate to the backend directory.
4. Create a `.env` file using `.env.example` as a reference.
5. Configure your MySQL DATABASE_URL.

Example:

```env
DATABASE_URL=mysql+pymysql://YOUR_USERNAME:YOUR_PASSWORD@localhost/trade_dashboard
```

6. Run the database table creation script, if required by the project setup.

## Backend Setup

Open a terminal:

```bash
cd backend
```

Create a virtual environment:

```bash
python -m venv venv
```

Activate it on Windows:

```powershell
venv\Scripts\activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Start FastAPI:

```bash
uvicorn app.main:app --reload
```

Backend URL:

http://127.0.0.1:8000

API documentation:

http://127.0.0.1:8000/docs

## Frontend Setup

Open another terminal:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

Start the React development server:

```bash
npm run dev
```

Frontend URL:

http://localhost:5173

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | / | Backend health check |
| GET | /getTrades | Fetch mock trade records |
| GET | /api/trades | Retrieve stored trades |
| POST | /api/pulls | Start a background trade pull |
| GET | /api/pulls/{id} | Get pull job status |
| WS | /ws/trades | Receive real-time pull notifications |

## Background Processing

Trade data is fetched in batches of 100 records.

A pull request creates a new job and schedules background processing. Each batch is fetched and saved independently, allowing the API to return without waiting for the entire process to finish.

The pull job status is updated during processing.

## WebSocket Communication

The frontend establishes a WebSocket connection with the backend.

The backend broadcasts progress and completion notifications. The frontend uses these notifications to update the pull progress bar and refresh the trade data.

## Screenshots

Add your dashboard screenshots here.

Example:

![Trade Dashboard](docs/screenshots/dashboard.png)

## Configuration

The following environment variables control the pull process:

| Variable | Description |
|----------|-------------|
| PULL_DURATION_SECONDS | Maximum pull duration |
| BATCH_SIZE | Records fetched per batch |
| MOCK_API_DELAY_SECONDS | Mock API response delay |
| MOCK_BSE_API_URL | Mock trade API endpoint |

## Limitations

- Uses synthetic trade data rather than a live stock exchange API.
- Uses a local MySQL database.
- Background jobs run within the FastAPI application process.
- WebSocket notifications are not persisted.

## Future Improvements

- Use Celery and Redis for separate background workers.
- Add automatic retry handling for failed batches.
- Implement authentication and authorization.
- Deploy the application to a cloud environment.
- Integrate a real financial market data provider.

## Author

Developed as a Software Engineering Technical Assessment.
