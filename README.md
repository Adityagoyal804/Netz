# CDMS — Company Data Management System

**CDMS** is a web dashboard built as an **internship project at Netz** for managing company data: employees, machinery, projects, and vehicles.

> **Netz** = Company (where I am interning)  
> **CDMS** = Project name (Company Data Management System)

## Features

- Landing page with project overview
- Login with session timeout & remember me
- Dashboard with alerts, recent activity, and charts
- CRUD for Employees, Machinery, Projects, Vehicles
- Search (per module + global), sort, pagination
- Record detail panel with audit trail
- CSV export, JSON backup/import, print/PDF reports
- Dark/light theme, onboarding tour, notifications

## Quick Start

```bash
python -m http.server 8080
```

Open **http://localhost:8080**

## Login (Demo)

| Field    | Value   |
|----------|---------|
| Username | `admin` |
| Password | `1234`  |

## Project Structure

```
├── index.html       # Main application
├── js/
│   ├── config.js    # Configuration & branding
│   └── app.js       # Application logic
├── css/styles.css   # Styles
└── PROJECT_OVERVIEW.md  # Mentor meeting guide
```

## Tech Stack

HTML5 · CSS3 · Vanilla JavaScript · localStorage

## GitHub

[https://github.com/Adityagoyal804/Netz](https://github.com/Adityagoyal804/Netz)
