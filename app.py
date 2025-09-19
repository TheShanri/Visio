from flask import Flask, render_template, request, redirect, jsonify
from flask_cors import CORS
from process_data import process_uploaded_data
import os
from flask import send_file

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

@app.route('/', methods=['GET', 'POST'])
def index():
    if request.method == 'POST':
        # Check if the file is part of the request
        if 'file' not in request.files:
            return redirect(request.url)

        file = request.files['file']

        # If the user does not select a file, the browser submits an empty file without a filename
        if file.filename == '':
            return redirect(request.url)

        if file:
            # Read the file content
            try:
                file_content = file.read().decode('utf-8')
            except UnicodeDecodeError:
                error_message = 'We could not decode that file. Please upload a UTF-8 encoded text or CSV export.'
                return render_template('index.html', data=None, error=error_message), 400

            try:
                processed_data = process_uploaded_data(file_content)
            except ValueError as exc:
                return render_template('index.html', data=None, error=str(exc)), 400

            # Render the template with the processed data
            return render_template('index.html', data=processed_data, error=None)

    # Render the template without data on GET request
    return render_template('index.html', data=None, error=None)

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['file']

    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    if file:
        try:
            file_content = file.read().decode('utf-8')
        except UnicodeDecodeError:
            return jsonify({'error': 'Unable to decode file. Please ensure it is saved as UTF-8.'}), 400

        try:
            processed_data = process_uploaded_data(file_content)
        except ValueError as exc:
            return jsonify({'error': str(exc)}), 400

        return jsonify({'data': processed_data}), 200

@app.route('/detect-peaks', methods=['POST'])
def detect_peaks():
    request_data = request.json
    parameters = request_data['parameters']
    data = request_data['data']
    
    from detect_peaks import detect_peaks_function
    peaks = detect_peaks_function(parameters, data)
    
    return jsonify({'peaks': peaks}), 200

@app.route('/process-segments', methods=['POST'])
def process_segments():
    request_data = request.json
    
    # Forward the data to post_peak_processor
    from post_peak_processor import process_segments_function
    result = process_segments_function(request_data)
    
    return jsonify(result), 200

@app.route('/generate-report', methods=['POST'])
def generate_report():
    data = request.json
    
    from generate_report import create_report
    filename = create_report(data)
    
    return jsonify({'filename': filename}), 200

@app.route('/download/<filename>')
def download_file(filename):
    try:
        return send_file(filename, as_attachment=True)
    except Exception as e:
        return str(e)


if __name__ == '__main__':
    app.run(debug=True)
