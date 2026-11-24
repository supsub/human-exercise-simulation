import { setFrameHandler } from './scene.js';
import * as planner from './plan/planView.js';

// Aplikacja ma jeden widok: plan treningowy z modelem 3D
// (szczegóły i animacje ćwiczeń otwierają się w panelu obok planu).
planner.start();
setFrameHandler(planner.frame);
