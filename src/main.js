import { setFrameHandler } from './scene.js';
import * as planner from './plan/planView.js';
import './faceUI.js';
import './sync.js';   // konto i synchronizacja planów (Supabase)   // „Twoja twarz” – zdjęcie tylko w tej przeglądarce

// Aplikacja ma jeden widok: plan treningowy z modelem 3D
// (szczegóły i animacje ćwiczeń otwierają się w panelu obok planu).
planner.start();
setFrameHandler(planner.frame);

// Aplikacja na telefonie (PWA): instalacja na ekranie głównym i działanie bez internetu
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');
