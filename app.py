import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy

# --- Configuration ---

app = Flask(__name__)

# Enable CORS (Cross-Origin Resource Sharing) to allow your front-end
# to communicate with this server.
CORS(app)

# Get the absolute path of the directory where this script is located
basedir = os.path.abspath(os.path.dirname(__file__))

# Configure the SQLite database. It will be created in the same directory.
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(basedir, 'mci_app.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# --- Database Model ---

# This class defines the structure of the "trial_result" table in your database.
# SQLAlchemy will automatically create this table for you.
class TrialResult(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    participant_id = db.Column(db.String(100), nullable=False)
    task_type = db.Column(db.String(50), nullable=False) # e.g., "stroop_congruent"
    stimulus_word = db.Column(db.String(20), nullable=False)
    stimulus_color = db.Column(db.String(20), nullable=False)
    response_time = db.Column(db.Float)
    key_press = db.Column(db.String(10))
    was_correct = db.Column(db.Boolean)
    avg_blink_rate = db.Column(db.Float) # Blinks per minute for this trial

    def __repr__(self):
        return f'<Trial {self.id} for {self.participant_id}>'

# --- API Endpoint ---

# This is the single "door" for your front-end to send data to.
@app.route('/api/submit-data', methods=['POST'])
def submit_data():
    """
    Receives a JSON payload from the front-end containing all trial data
    and saves it to the database.
    """
    try:
        data = request.get_json()

        # Extract the participant ID and the list of trials
        participant_id = data.get('participant_id')
        trials = data.get('trials')

        if not participant_id or not trials:
            return jsonify({"status": "error", "message": "Missing participant_id or trials data"}), 400

        # Loop through each trial sent from the front-end
        for trial_data in trials:
            # Create a new TrialResult object (a new row for the table)
            new_trial = TrialResult(
                participant_id=participant_id,
                task_type=trial_data.get('task_type'),
                stimulus_word=trial_data.get('stimulus_word'),
                stimulus_color=trial_data.get('stimulus_color'),
                response_time=trial_data.get('response_time'),
                key_press=trial_data.get('key_press'),
                was_correct=trial_data.get('was_correct'),
                avg_blink_rate=trial_data.get('avg_blink_rate')
            )
            # Add the new row to the database session
            db.session.add(new_trial)

        # Commit all the new rows to the database at once
        db.session.commit()

        # Send a success response back to the front-end
        return jsonify({"status": "success", "trials_saved": len(trials)}), 201

    except Exception as e:
        db.session.rollback() # Roll back changes if an error occurs
        return jsonify({"status": "error", "message": str(e)}), 500

# --- Initialization ---

if __name__ == '__main__':
    # This block runs only when you execute "python app.py"
    # It creates the database and all tables if they don't exist.
    with app.app_context():
        db.create_all()
    
    # Starts the Flask server.
    # debug=True means it will automatically restart when you save changes.
    app.run(debug=True)
