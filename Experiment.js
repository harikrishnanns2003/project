/**
 * Experiment.js
 * * This module defines the complete jsPsych experiment timeline for the Stroop Task,
 * integrates with the BlinkDetector, and sends the final data to the back-end.
 */
export async function runExperiment(participant_id, jsPsych) {

    const timeline = [];

    // --- Experiment Constants ---
    const WORDS = ['RED', 'GREEN', 'BLUE'];
    const COLORS = ['red', 'green', 'blue'];
    const KEYS = ['r', 'g', 'b']; // 'r' for red, 'g' for green, 'b' for blue
    const NUM_TRIALS = 20; // Total number of Stroop trials to run
    
    // --- 1. Welcome and Instructions ---
    const instructions = {
        type: jsPsychHtmlKeyboardResponse,
        stimulus: `
            <div style='text-align: left; max-width: 600px; margin: auto;'>
                <h2>Welcome to the Stroop Test</h2>
                <p>In this task, you will see a word (e.g., "RED") written in a specific color (e.g., green).</p>
                <p>Your task is to ignore the word and identify the <strong>COLOR</strong> of the ink.</p>
                <ul>
                    <li>Press <strong>R</strong> if the ink color is <span style="color:red;">RED</span>.</li>
                    <li>Press <strong>G</strong> if the ink color is <span style="color:green;">GREEN</span>.</li>
                    <li>Press <strong>B</strong> if the ink color is <span style="color:blue;">BLUE</span>.</li>
                </ul>
                <p>Please respond as quickly and accurately as possible.</p>
                <p style='text-align: center; margin-top: 40px;'>Press any key to begin.</p>
            </div>
        `,
        post_trial_gap: 500 // A brief pause after instructions
    };
    timeline.push(instructions);

    // --- 2. Fixation Cross ---
    const fixation = {
        type: jsPsychHtmlKeyboardResponse,
        stimulus: '<div style="font-size: 60px;">+</div>',
        choices: "NO_KEYS",
        trial_duration: 1000 // Show for 1 second
    };

    // --- 3. Stroop Trial Logic ---
    const stroopTrials = [];
    for (let i = 0; i < NUM_TRIALS; i++) {
        
        // Randomly decide if this trial is congruent or incongruent
        const is_congruent = Math.random() < 0.5;
        
        // Pick a random word and color
        const word_index = Math.floor(Math.random() * WORDS.length);
        const color_index = is_congruent ? word_index : 
                            (word_index + Math.floor(Math.random() * (COLORS.length - 1)) + 1) % COLORS.length;

        const stimulus_word = WORDS[word_index];
        const stimulus_color = COLORS[color_index];
        const correct_key = KEYS[color_index]; // 'r', 'g', or 'b'
        
        const stroop_trial = {
            type: jsPsychHtmlKeyboardResponse,
            // The stimulus is the word, styled with the ink color
            stimulus: `<p style="color: ${stimulus_color}; font-size: 60px; font-weight: bold;">${stimulus_word}</p>`,
            choices: KEYS,
            data: {
                task_type: is_congruent ? 'stroop_congruent' : 'stroop_incongruent',
                stimulus_word: stimulus_word,
                stimulus_color: stimulus_color,
                correct_key: correct_key
            },
            // This function runs right at the start of the trial
            on_start: () => {
                // Tell the blink detector to reset its counter
                window.blinkDetector.startTrial();
            },
            // This function runs as soon as the user presses a key
            on_finish: (data) => {
                // Get the blink rate from our detector
                const trial_bpm = window.blinkDetector.getTrialBlinkRate();
                
                // Add the new data to the trial results
                data.avg_blink_rate = trial_bpm;
                data.was_correct = jsPsych.pluginAPI.compareKeys(data.response, data.correct_key);
                data.response_time = data.rt;
                data.key_press = data.response;
            }
        };
        
        // Add the fixation cross before each trial, and the trial itself
        stroopTrials.push(fixation);
        stroopTrials.push(stroop_trial);
    }
    
    // Add all generated trials to the main timeline
    timeline.push(...stroopTrials);

    // --- 4. Data Submission ---
    const saving_screen = {
        type: jsPsychHtmlKeyboardResponse,
        stimulus: `
            <h2>Saving your data...</h2>
            <p>Please wait a moment. Do not close this window.</p>
        `,
        choices: "NO_KEYS",
        trial_duration: 3000 // Show this for 3 seconds
    };
    timeline.push(saving_screen);

    // --- Run the Experiment ---
    
    await jsPsych.run(timeline);

    // --- 5. After Experiment Finishes ---
    
    // Get all the data from jsPsych
    // We filter out the instruction and fixation trials, we only want Stroop data
    const all_data = jsPsych.data.get().filter({ task_type: ['stroop_congruent', 'stroop_incongruent'] }).trials;
    
    console.log("Experiment finished. Data to be sent:", all_data);

    // Send the data to our back-end
    try {
        const response = await fetch('http://127.0.0.1:5000/api/submit-data', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                participant_id: participant_id,
                trials: all_data
            })
        });

        if (response.ok) {
            // Show final "thank you" message
            jsPsych.getDisplayElement().innerHTML = `
                <div class="main-container">
                    <h1>Thank you!</h1>
                    <p>Your data has been successfully saved.</p>
                    <p>You may now close this window.</p>
                </div>
            `;
        } else {
            throw new Error('Server responded with an error.');
        }
    } catch (err) {
        console.error("Error submitting data:", err);
        jsPsych.getDisplayElement().innerHTML = `
            <div class="main-container">
                <h1>Error</h1>
                <p>There was a problem saving your data. Please check your internet connection and try again.</p>
                <p>Error details: ${err.message}</p>
            </div>
        `;
    }
}
