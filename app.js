const appContainer = document.getElementById('app');

// Load Dashboard
function loadDashboard() {
    appContainer.innerHTML = '';

    if (typeof Dashboard === 'function') { // Claude-generated class
        const dashboard = new Dashboard(appContainer, {
            onCreateSOP: () => {
                loadSOPCreate(); // Open SOP Create module
            },
            onViewChecklists: () => {
                loadChecklist(); // Placeholder for later
            }
        });
        dashboard.render(); // Or init() depending on Claude’s code
    } else {
        appContainer.innerHTML = '<p>Dashboard module not found.</p>';
    }
}

// Load SOP Create/Edit
function loadSOPCreate(sopId = null) {
    appContainer.innerHTML = '';

    if (typeof renderSOPCreate === 'function') {
        renderSOPCreate(appContainer, sopId, loadDashboard);
    } else {
        appContainer.innerHTML = '<p>SOP Create module not found.</p>';
    }
}

// Initialize
loadDashboard();
