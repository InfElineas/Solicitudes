/**
 * pages.config.js - Page routing configuration
 * 
 * This file is AUTO-GENERATED. Do not add imports or modify PAGES manually.
 * Pages are auto-registered when you create files in the ./pages/ folder.
 * 
 * THE ONLY EDITABLE VALUE: mainPage
 * This controls which page is the landing page (shown when users visit the app).
 * 
 * Example file structure:
 * 
 *   import HomePage from './pages/HomePage';
 *   import Dashboard from './pages/Dashboard';
 *   import Settings from './pages/Settings';
 *   
 *   export const PAGES = {
 *       "HomePage": HomePage,
 *       "Dashboard": Dashboard,
 *       "Settings": Settings,
 *   }
 *   
 *   export const pagesConfig = {
 *       mainPage: "HomePage",
 *       Pages: PAGES,
 *   };
 * 
 * Example with Layout (wraps all pages):
 *
 *   import Home from './pages/Home';
 *   import Settings from './pages/Settings';
 *   import __Layout from './Layout.jsx';
 *
 *   export const PAGES = {
 *       "Home": Home,
 *       "Settings": Settings,
 *   }
 *
 *   export const pagesConfig = {
 *       mainPage: "Home",
 *       Pages: PAGES,
 *       Layout: __Layout,
 *   };
 *
 * To change the main page from HomePage to Dashboard, use find_replace:
 *   Old: mainPage: "HomePage",
 *   New: mainPage: "Dashboard",
 *
 * The mainPage value must match a key in the PAGES object exactly.
 */
import Panel from './pages/Panel';
import Requests from './pages/Requests';
import Departments from './pages/Departments';
import ManageUsers from './pages/ManageUsers';
import Trash from './pages/Trash';
import SqlScript from './pages/SqlScript';
import Analysis from './pages/Analysis';
import AutomationRules from './pages/AutomationRules';
import Incidents from './pages/Incidents';
import UserHistory from './pages/UserHistory';
import Guards from './pages/Guards';
import Assets from './pages/Assets';
import KnowledgeBase from './pages/KnowledgeBase';
import AuditLogPage from './pages/AuditLog';
import __Layout from './Layout.jsx';


export const PAGES = {
    "Panel": Panel,
    "Requests": Requests,
    "Departments": Departments,
    "ManageUsers": ManageUsers,
    "Trash": Trash,
    "SqlScript": SqlScript,
    "Analysis": Analysis,
    "AutomationRules": AutomationRules,
    "Incidents": Incidents,
    "UserHistory": UserHistory,
    "Guards": Guards,
    "Assets": Assets,
    "KnowledgeBase": KnowledgeBase,
    "AuditLog": AuditLogPage,
}

export const pagesConfig = {
    mainPage: "Panel",
    Pages: PAGES,
    Layout: __Layout,
};