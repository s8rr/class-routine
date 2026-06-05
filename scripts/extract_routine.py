import os
import json
import re
import pdfplumber

PDF_PATH = "routine.pdf"
JSON_PATH = "data/routine_data.json"

def clean_text(text):
    if not text:
        return ""
    return re.sub(r'\s+', ' ', text).strip()

def parse_routine_pdf():
    print("Starting PDF data extraction pipeline...")
    
    # 1. Load or Initialize Data Store
    data_store = {"sections": ["1A", "1B", "1C", "1D", "1E", "1F"], "weekly_routine": {}, "exceptions": {}}
    for sec in data_store["sections"]:
        data_store["weekly_routine"][sec] = {
            "Saturday": [], "Sunday": [], "Monday": [], "Tuesday": [], "Wednesday": []
        }

    if not os.path.exists(PDF_PATH):
        print(f"Error: {PDF_PATH} not found.")
        return

    with pdfplumber.open(PDF_PATH) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if not text: continue
            
            lines = text.split('\n')
            current_day = None
            current_section = None
            
            # Updated Regex to be more robust
            class_pattern = re.compile(r'([A-Z]{2,6})\s*/\s*([A-Za-z0-9.-]+)\s*/\s*([0-9]{3,4})')
            
            for line in lines:
                cleaned = clean_text(line)
                
                # Check for Day
                for day in ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday"]:
                    if day.lower() in cleaned.lower():
                        current_day = day
                
                # Check for Section (e.g., 1A, 1B)
                for sec in data_store["sections"]:
                    if sec == cleaned or (sec in cleaned and len(cleaned) < 5):
                        current_section = sec
                
                # Process matches
                matches = class_pattern.findall(cleaned)
                if matches and current_day and current_section:
                    for sub, teacher, room in matches:
                        entry = {"subject": sub, "teacher": teacher, "room": room}
                        # Avoid duplicate entries if the PDF has repeating headers
                        if entry not in data_store["weekly_routine"][current_section][current_day]:
                            data_store["weekly_routine"][current_section][current_day].append(entry)

    # 3. Save
    os.makedirs(os.path.dirname(JSON_PATH), exist_ok=True)
    with open(JSON_PATH, 'w') as f:
        json.dump(data_store, f, indent=2)
    
    print("Routine extraction pipeline completed successfully.")

if __name__ == "__main__":
    parse_routine_pdf()
