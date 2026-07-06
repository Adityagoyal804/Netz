# Netz

**Company Database Management System (CDMS)** — a modern web dashboard to manage employees, machinery, projects, and vehicles.

## Features

- Login authentication with session persistence
- Dashboard with live stats, charts, and activity feed
- CRUD for Employees, Machinery, Projects, and Vehicles
- Search, sort, pagination, and inline editing
- CSV export and JSON backup/import
- Dark / light theme toggle
- Fully client-side — no backend required

## Quick Start

```bash
cd cdms
python -m http.server 8080
```

Open **http://localhost:8080** in your browser.

## Login

| Field    | Value  |
|----------|--------|
| Username | `admin` |
| Password | `1234`  |

## Project Structure

```
├── index.html      # Main application
├── css/styles.css  # Styles & animations
├── js/app.js       # Application logic
├── favicon.ico
└── favicon.svg
```

## Tech Stack

- HTML5, CSS3, JavaScript (vanilla)
- localStorage for data persistence

## License

MIT
