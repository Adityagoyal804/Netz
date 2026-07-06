/* CDMS Configuration — Netz Company Internship Project */
const CDMS_CONFIG = {
    projectName: 'CDMS',
    projectFullName: 'Company Data Management System',
    companyName: 'Netz',
    version: '3.0',
    githubUrl: 'https://github.com/Adityagoyal804/Netz',

    demoUser: { username: 'admin', password: '1234' },
    pageSize: 8,
    sessionTimeoutMinutes: 15,
    alertDaysAhead: 30,

    storageKeys: {
        auth: 'cdms_authenticated',
        data: 'cdms_data',
        columns: 'cdms_columns',
        activity: 'cdms_activity',
        theme: 'cdms_theme',
        remember: 'cdms_remember_user',
        tourDone: 'cdms_tour_done',
        lastActivity: 'cdms_last_activity'
    },

    modules: {
        emp:     { section: 'employees', label: 'Employees', icon: '👥', formId: 'empForm', primaryField: 'Name' },
        machine: { section: 'machines',  label: 'Machinery', icon: '⚙️', formId: 'machineForm', primaryField: 'Name' },
        project: { section: 'projects',  label: 'Projects',  icon: '📋', formId: 'projectForm', primaryField: 'Project' },
        vehicle: { section: 'vehicles',  label: 'Vehicles',  icon: '🚗', formId: 'vehicleForm', primaryField: 'Vehicle Name' }
    },

    defaultColumns: {
        emp:     ['Name', 'Role', 'Contact', 'Salary', 'Department', 'Join Date', 'Status'],
        machine: ['Name', 'Type', 'Purchase Date', 'Maintenance', 'Status', 'Location'],
        project: ['Project', 'Client', 'Budget', 'Deadline', 'Status', 'Manager'],
        vehicle: ['Vehicle Name', 'Reg No', 'Date of Purchase', 'Insurance Expiry', 'Pollution Expiry', 'Driver']
    },

    requiredFields: {
        emp: ['Name', 'Role'],
        machine: ['Name', 'Type'],
        project: ['Project', 'Client'],
        vehicle: ['Vehicle Name', 'Reg No']
    },

    fieldMeta: {
        'Status': { type: 'select', options: ['Active', 'Completed', 'Pending', 'Broken', 'On Hold'] },
        'Role': { type: 'text' },
        'Salary': { type: 'number', min: 0 },
        'Budget': { type: 'number', min: 0 },
        'Contact': { type: 'tel' },
        'Join Date': { type: 'date' },
        'Purchase Date': { type: 'date' },
        'Date of Purchase': { type: 'date' },
        'Maintenance': { type: 'date' },
        'Deadline': { type: 'date' },
        'Insurance Expiry': { type: 'date' },
        'Pollution Expiry': { type: 'date' }
    },

    sectionLabels: {
        home: 'Home',
        login: 'Login',
        dashboard: 'Dashboard',
        employees: 'Employees',
        machines: 'Machinery',
        projects: 'Projects',
        vehicles: 'Vehicles',
        reports: 'Reports',
        settings: 'Settings'
    },

    tourSteps: [
        { section: 'dashboard', title: 'Dashboard', text: 'View live stats, alerts, and company overview at a glance.' },
        { section: 'employees', title: 'Employees', text: 'Manage workforce records with search, sort, and export.' },
        { section: 'machines', title: 'Machinery', text: 'Track equipment status, maintenance, and location.' },
        { section: 'projects', title: 'Projects', text: 'Monitor tenders, budgets, deadlines, and bid status.' },
        { section: 'reports', title: 'Reports', text: 'Generate analytics and printable company summaries.' }
    ]
};
