/**
 * BlinkDetector.js
 * * This class uses MediaPipe's Face Mesh model to detect blinks in real-time
 * from a webcam feed. It calculates the Eye Aspect Ratio (EAR) and
 * counts blinks, providing an average blinks-per-minute (BPM) for a trial.
 */
export class BlinkDetector {

    constructor(videoElement) {
        this.video = videoElement;
        this.model = null; // The Face Mesh model
        this.startTime = null; // Start time of a trial
        this.blinkCount = 0; // Blinks counted for the current trial
        
        // --- Constants ---
        // These are the specific landmark indices for the eyes from MediaPipe
        this.LEFT_EYE_LANDMARKS = [ 362, 385, 387, 263, 373, 380 ];
        this.RIGHT_EYE_LANDMARKS = [ 33, 160, 158, 133, 153, 144 ];
        
        // This threshold determines if an eye is "closed".
        // You may need to tune this value.
        this.EAR_THRESHOLD = 0.2; 
        
        this.wasBlinking = false; // State variable to count blinks accurately
    }

    /**
     * Initializes the MediaPipe model and starts the webcam.
     * This must be called before the experiment starts.
     */
    async init() {
        console.log("Loading MediaPipe Face Mesh model...");
        // Set up TensorFlow.js backend
        await tf.setBackend('webgl');
        
        // Load the model
        this.model = await faceLandmarksDetection.load(
            faceLandmarksDetection.SupportedPackages.mediapipeFacemesh,
            { maxFaces: 1 }
        );

        console.log("Model loaded. Accessing webcam...");
        
        // Get webcam access
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false
            });
            this.video.srcObject = stream;
            
            // Wait for the video to start playing
            await new Promise((resolve) => {
                this.video.onloadedmetadata = () => resolve();
            });

            console.log("Webcam accessed. Starting detection loop.");
            this.run(); // Start the detection loop
        } catch (err) {
            console.error("Error accessing webcam: ", err);
            alert("Could not access webcam. Please check permissions and reload.");
        }
    }

    /**
     * Calculates the Eye Aspect Ratio (EAR) for a single eye.
     * EAR = (||p2 - p6|| + ||p3 - p5||) / (2 * ||p1 - p4||)
     */
    calculateEAR(eyeLandmarks, allLandmarks) {
        try {
            // Get 3D coordinates for each landmark point
            const p1 = allLandmarks[eyeLandmarks[0]];
            const p2 = allLandmarks[eyeLandmarks[1]];
            const p3 = allLandmarks[eyeLandmarks[2]];
            const p4 = allLandmarks[eyeLandmarks[3]];
            const p5 = allLandmarks[eyeLandmarks[4]];
            const p6 = allLandmarks[eyeLandmarks[5]];

            // Calculate Euclidean distance in 3D
            const dist = (pA, pB) => Math.hypot(pA.x - pB.x, pA.y - pB.y, pA.z - pB.z);

            // Vertical distances
            const v1 = dist(p2, p6);
            const v2 = dist(p3, p5);

            // Horizontal distance
            const h = dist(p1, p4);

            // Calculate EAR
            const ear = (v1 + v2) / (2.0 * h);
            return ear;
        } catch (e) {
            return 0.5; // Return a "neutral" value if landmarks are missing
        }
    }

    /**
     * The main detection loop. Runs continuously using requestAnimationFrame.
     */
    async run() {
        if (this.model) {
            // Get face estimations from the model
            const predictions = await this.model.estimateFaces({
                input: this.video,
                returnTensors: false,
                flipHorizontal: false,
                predictIrises: false // Not needed for blinks
            });

            if (predictions.length > 0) {
                // We only care about the first face detected
                const landmarks = predictions[0].scaledMesh; // This is the array of 468 3D points
                
                // Calculate EAR for both eyes
                const leftEAR = this.calculateEAR(this.LEFT_EYE_LANDMARKS, landmarks);
                const rightEAR = this.calculateEAR(this.RIGHT_EYE_LANDMARKS, landmarks);
                
                // Average the two EARs for a more stable signal
                const avgEAR = (leftEAR + rightEAR) / 2.0;
                
                // --- Blink Detection Logic ---
                if (avgEAR < this.EAR_THRESHOLD) {
                    // Eye is currently closed
                    if (!this.wasBlinking) {
                        // This is the start of a new blink
                        this.blinkCount++;
                    }
                    this.wasBlinking = true;
                } else {
                    // Eye is open
                    this.wasBlinking = false;
                }
            }
        }
        
        // Loop this function for the next frame
        requestAnimationFrame(() => this.run());
    }

    /**
     * Public method to be called by jsPsych at the start of a trial.
     */
    startTrial() {
        this.blinkCount = 0;
        this.startTime = Date.now();
    }

    /**
     * Public method to be called by jsPsych at the end of a trial.
     * @returns {number} The average blinks per minute (BPM) for this trial.
     */
    getTrialBlinkRate() {
        if (this.startTime === null) return 0;

        const endTime = Date.now();
        const elapsedMilliseconds = endTime - this.startTime;
        const elapsedMinutes = elapsedMilliseconds / 60000; // Convert ms to minutes

        if (elapsedMinutes === 0) return 0; // Avoid division by zero
        
        // Calculate and return BPM
        return this.blinkCount / elapsedMinutes;
    }
}
