/**
 * main.js
 * * This is the main entry point for the front-end application.
 * It imports the BlinkDetector and Experiment modules and wires up
 * the "Start" button to begin the whole process.
 */

// Import our custom modules
import { BlinkDetector } from './BlinkDetector.js';
import { runExperiment } from './Experiment.js';

// Wait for the DOM (the HTML) to be fully loaded before we do anything
document.addEventListener('DOMContentLoaded', () => {

    // Get the main HTML elements
    const startBtn = document.getElementById('start-btn');
    const video = document.getElementById('webcam');
    const jsPsychTarget = document.getElementById('jspsych-target');

    // 1. Initialize the jsPsych instance
    const jsPsych = initJsPsych({
        // This function will run when the entire experiment is over
        on_finish: () => {
            // We handle the data saving inside Experiment.js
            console.log("jsPsych timeline finished.");
        }
    });

    // 2. Instantiate our BlinkDetector
    // We make it global (window.blinkDetector) so that Experiment.js can access it
    window.blinkDetector = new BlinkDetector(video);

    // 3. Set up the "Start Assessment" button
    startBtn.addEventListener('click', async () => {
        
        // Disable the button to prevent multiple clicks
        startBtn.disabled = true;
        startBtn.textContent = "Loading AI Model... (Please wait)";
        
        try {
            // --- Step 1: Initialize the Blink Detector ---
            // This will load the MediaPipe model and request webcam access
            await window.blinkDetector.init();
            
            // --- Step 2: Prepare the UI ---
            // Hide the start button and show the jsPsych experiment area
            startBtn.style.display = 'none';
            document.querySelector('p').style.display = 'none'; // Hide intro text
            jsPsychTarget.style.display = 'block';

            // --- Step 3: Create a Participant ID ---
            // A simple unique ID based on the current timestamp
            const participant_id = `mceye_user_${Date.now()}`;

            // --- Step 4: Run the Experiment ---
            // This function (from Experiment.js) takes over from here
            runExperiment(participant_id, jsPsych);

        } catch (err) {
            // Handle errors (e.g., user denied webcam)
            console.error("Initialization failed:", err);
            startBtn.disabled = false;
            startBtn.textContent = "Start Assessment";
            alert("Failed to initialize webcam or AI model. Please check permissions and reload.");
        }
    });
});
